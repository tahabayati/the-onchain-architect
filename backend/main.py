"""
main.py - "The Storage Engine" for The Onchain Architect

WHAT it does:
    A FastAPI service exposing POST /upload-model/. It receives a building
    model file (e.g. .ifc), computes a SHA-256 hash, runs a (currently mocked)
    IFC validation step, uploads the file to IPFS/Filecoin via Lighthouse, and
    returns the filename, hash, and IPFS CID.

WHY it exists:
    Architectural models are valuable, tamper-sensitive assets. By storing them
    on Filecoin/IPFS and returning both a local SHA-256 hash and the network's
    content identifier (CID), anyone can later verify the file was not altered.

HOW it connects to Filecoin:
    The Lighthouse SDK (lighthouseweb3) pins the file to IPFS and backs it with
    Filecoin storage deals. The returned CID is the permanent, content-addressed
    pointer that a FEVM smart contract can later record on-chain.

Run locally:
    export LIGHTHOUSE_API_KEY="your-key"   # never hardcode this
    uvicorn main:app --reload --port 8000
"""

import hashlib
import logging
import os
import tempfile

from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
from lighthouseweb3 import Lighthouse
from pydantic import BaseModel, Field


class UploadResponse(BaseModel):
    """
    Structured metadata returned upon successful model ingestion and IPFS pinning.
    Used by FastAPI to generate explicit OpenAPI schemas for /docs.
    """
    filename: str = Field(..., description="Sanitized original filename of the architectural model")
    file_hash: str = Field(..., description="Deterministic SHA-256 hex digest of the raw file bytes")
    ipfs_cid: str = Field(..., description="Content Identifier (CID) returned by Lighthouse on Filecoin/IPFS")

# ---------------------------------------------------------------------------
# Environment: load secrets from local env files so the API key never lives in
# source code. Paths are resolved relative to this file, so it works no matter
# which directory uvicorn is launched from. A plain load_dotenv() would only
# look for ".env", so we explicitly load ".env.local" first. Values already set
# in the real environment are never overridden (override=False by default).
# ---------------------------------------------------------------------------
_BASE_DIR = os.path.dirname(os.path.abspath(__file__))
load_dotenv(os.path.join(_BASE_DIR, ".env.local"))
load_dotenv(os.path.join(_BASE_DIR, ".env"))

# ---------------------------------------------------------------------------
# Logging: gives reviewers and operators a visible trail of each pipeline step.
# ---------------------------------------------------------------------------
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("storage-engine")

app = FastAPI(
    title="The Onchain Architect - Storage Engine",
    description="Hashes, validates and uploads building models to Filecoin via Lighthouse.",
    version="0.1.0",
)

# ---------------------------------------------------------------------------
# Maximum upload size guard (50 MB) to prevent out-of-memory (OOM) attacks.
# ---------------------------------------------------------------------------
MAX_FILE_SIZE = 50 * 1024 * 1024  # 50 MB

# ---------------------------------------------------------------------------
# CORS: the browser blocks cross-origin requests by default. The Next.js dev
# server runs on a different port (3000), so we explicitly allow it.
# Additional origins can be configured via the ALLOWED_ORIGINS env variable.
# ---------------------------------------------------------------------------
default_origins = ["http://localhost:3000", "http://127.0.0.1:3000"]
env_origins = [o.strip() for o in os.getenv("ALLOWED_ORIGINS", "").split(",") if o.strip()]
allowed_origins = list(dict.fromkeys(default_origins + env_origins))

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health_check():
    """
    Standard health check endpoint for uptime probes and monitoring.
    """
    return {
        "status": "ok",
        "service": "The Onchain Architect - Storage Engine",
        "version": "0.1.0",
    }


def compute_sha256(contents: bytes) -> str:
    """
    Return the hex SHA-256 digest of the file bytes.

    Why: an independent hash lets anyone re-hash a downloaded file and compare
    it to this value, proving the data is byte-for-byte unchanged.
    """
    return hashlib.sha256(contents).hexdigest()

# ---------------------------------------------------------------------------
# // POC NOTE: Currently a mocked placeholder. Full IfcOpenShell schema parsing is slated for Grant Milestone 1.
# ---------------------------------------------------------------------------
def validate_ifc_model(contents: bytes, filename: str) -> bool:
    """
    PLACEHOLDER for ifcopenshell validation.

    Why: we want to reject malformed models BEFORE paying for permanent
    storage. The real implementation will parse `contents` with ifcopenshell
    and check schema/geometry. For now it only logs that validation passed.
    """
    logger.info("Mock IFC validation passed for '%s' (%d bytes).", filename, len(contents))
    return True


def upload_to_lighthouse(contents: bytes, filename: str) -> str:
    """
    Upload bytes to Lighthouse (IPFS/Filecoin) and return the CID.

    Raises HTTPException(500) with a human-readable message on any failure,
    so errors are never swallowed silently.
    Uses tempfile.TemporaryDirectory for guaranteed filesystem cleanup.
    """
    # The API key is read from the environment so it never lands in git.
    api_key = os.getenv("LIGHTHOUSE_API_KEY")
    if not api_key:
        logger.error("LIGHTHOUSE_API_KEY is not set.")
        raise HTTPException(
            status_code=500,
            detail="Server misconfiguration: LIGHTHOUSE_API_KEY environment variable is not set.",
        )

    try:
        lighthouse = Lighthouse(token=api_key)
        safe_name = os.path.basename(filename) or "model.ifc"

        with tempfile.TemporaryDirectory() as tmp_dir:
            tmp_path = os.path.join(tmp_dir, safe_name)
            with open(tmp_path, "wb") as tmp_file:
                tmp_file.write(contents)

            response = lighthouse.upload(source=tmp_path)
            logger.info("Lighthouse response: %s", response)

            # Expected shape: {"data": {"Name": ..., "Hash": <CID>, "Size": ...}}
            cid = response.get("data", {}).get("Hash") if isinstance(response, dict) else None
            if not cid:
                raise ValueError("Lighthouse returned an empty CID.")
            return cid

    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("Lighthouse upload failed.")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to upload file to Lighthouse/Filecoin: {exc}",
        )


@app.post("/upload-model/", response_model=UploadResponse)
async def upload_model(file: UploadFile = File(...)):
    """
    Pipeline: validate size -> read chunks -> hash -> validate -> upload -> respond.
    """
    # Guard against declared large content
    if file.size and file.size > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=413,
            detail=f"File too large. Maximum supported file size is {MAX_FILE_SIZE // (1024 * 1024)}MB.",
        )

    # Step 1: read uploaded chunks into memory with strict size limit.
    try:
        contents_buf = bytearray()
        chunk_size = 1024 * 1024  # 1MB buffer chunks
        while chunk := await file.read(chunk_size):
            contents_buf.extend(chunk)
            if len(contents_buf) > MAX_FILE_SIZE:
                raise HTTPException(
                    status_code=413,
                    detail=f"File exceeds maximum allowed size of {MAX_FILE_SIZE // (1024 * 1024)}MB.",
                )
        contents = bytes(contents_buf)
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("Could not read uploaded file.")
        raise HTTPException(status_code=400, detail=f"Could not read uploaded file: {exc}")

    if not contents:
        raise HTTPException(status_code=400, detail="Uploaded file is empty.")

    filename = file.filename or "unnamed_model"

    # Step 2: hash first, so the fingerprint reflects exactly what we received.
    file_hash = compute_sha256(contents)
    logger.info("SHA-256 for '%s': %s", filename, file_hash)

    # Step 3: validate before spending storage resources.
    if not validate_ifc_model(contents, filename):
        raise HTTPException(status_code=422, detail="IFC validation failed.")

    # Step 4: push to IPFS/Filecoin; raises HTTP 500 on failure.
    ipfs_cid = upload_to_lighthouse(contents, filename)
    logger.info("Uploaded '%s' -> CID %s", filename, ipfs_cid)

    # Step 5: return everything the frontend needs for verification.
    return {
        "filename": filename,
        "file_hash": file_hash,
        "ipfs_cid": ipfs_cid,
    }
