"""
test_main.py — Storage Engine API Test Suite

WHAT it does:
    Automated integration and unit test suite for the FastAPI storage engine.
    Validates health monitoring, file hashing, size guards, Lighthouse upload
    orchestration (via mocking), and error handling for missing credentials.

WHY it exists:
    Decentralized storage workflows require deterministic guarantees: files must
    be hashed correctly, malformed or empty payloads must be rejected before spending
    storage funds, and SDK interactions must handle edge cases cleanly.

HOW it connects to Filecoin:
    Tests verify that the pipeline produces the exact SHA-256 fingerprint and IPFS
    CID needed to anchor immutable proofs on Filecoin's FEVM via the smart contract.
"""

import hashlib
import os
from unittest.mock import patch

import pytest
from fastapi.testclient import TestClient

from main import app, compute_sha256, MAX_FILE_SIZE

client = TestClient(app)


def test_health_check():
    """
    Test 1: GET /health returns 200 OK with service metadata.
    Ensures container and uptime probes can verify backend availability.
    """
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert data["service"] == "The Onchain Architect - Storage Engine"
    assert "version" in data


def test_upload_empty_payload():
    """
    Test 2: POST /upload-model/ with an empty payload returns 400 Bad Request.
    Prevents allocating storage or anchoring empty records on Filecoin.
    """
    files = {"file": ("empty.ifc", b"", "application/octet-stream")}
    response = client.post("/upload-model/", files=files)
    assert response.status_code == 400
    assert "empty" in response.json()["detail"].lower()


def test_upload_valid_mock_file():
    """
    Test 3: POST /upload-model/ with a valid mock file.
    Mocks the Lighthouse SDK upload response to verify the end-to-end hashing
    and metadata extraction pipeline without making external network calls.
    """
    test_content = b"ISO-10303-21; HEADER; FILE_DESCRIPTION(('Test IFC Model'), '2;1');"
    expected_hash = hashlib.sha256(test_content).hexdigest()
    mock_cid = "bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi"

    mock_lighthouse_response = {
        "data": {
            "Name": "sample.ifc",
            "Hash": mock_cid,
            "Size": len(test_content),
        }
    }

    with patch("main.Lighthouse") as MockLighthouse, \
         patch.dict(os.environ, {"LIGHTHOUSE_API_KEY": "test-mock-key"}):
        instance = MockLighthouse.return_value
        instance.upload.return_value = mock_lighthouse_response

        files = {"file": ("sample.ifc", test_content, "application/octet-stream")}
        response = client.post("/upload-model/", files=files)

        assert response.status_code == 200
        data = response.json()
        assert data["filename"] == "sample.ifc"
        assert data["file_hash"] == expected_hash
        assert data["ipfs_cid"] == mock_cid


def test_upload_missing_lighthouse_api_key():
    """
    Test 4: POST /upload-model/ returns HTTP 500 when LIGHTHOUSE_API_KEY is not set.
    Ensures missing configuration is caught with a clear diagnostic message.
    """
    test_content = b"Mock building blueprint content"
    files = {"file": ("blueprint.ifc", test_content, "application/octet-stream")}

    with patch.dict(os.environ, {"LIGHTHOUSE_API_KEY": ""}):
        response = client.post("/upload-model/", files=files)
        assert response.status_code == 500
        assert "LIGHTHOUSE_API_KEY" in response.json()["detail"]


def test_upload_file_size_exceeded():
    """
    Test 5: POST /upload-model/ returns HTTP 413 when file size exceeds MAX_FILE_SIZE.
    Protects against memory exhaustion and OOM vulnerabilities.
    """
    oversized_content = b"X" * (MAX_FILE_SIZE + 1024)
    files = {"file": ("huge_model.ifc", oversized_content, "application/octet-stream")}

    response = client.post("/upload-model/", files=files)
    assert response.status_code == 413
    assert "too large" in response.json()["detail"].lower() or "exceeds" in response.json()["detail"].lower()
