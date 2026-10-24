"use client";

/**
 * page.tsx — Main dashboard of "The Onchain Architect"
 *
 * WHAT: Header with wallet connection, a drag-and-drop zone for .ifc/.gltf
 *       architectural files, a 3D viewport, and an "Anchor on Filecoin" button.
 * WHY:  This is the user's single entry point: pick a design file, preview it,
 *       then anchor it permanently.
 * FILECOIN: "Anchor on Filecoin" uploads the file to the FastAPI backend
 *       (which pins it to IPFS/Filecoin via Lighthouse and hashes it), then
 *       stores the returned CID + hash on-chain via the ArchitectRegistry
 *       FEVM smart contract (cryptographic proof of the file).
 */

import { useCallback, useRef, useState, type DragEvent } from "react";
import {
  useAccount,
  useWriteContract,
  useWaitForTransactionReceipt,
  useSwitchChain,
} from "wagmi";
import { filecoinCalibration } from "wagmi/chains";
import { ConnectWalletButton } from "@/components/ConnectWalletButton";
import { ModelCanvas } from "@/components/ModelCanvas";
import {
  ARCHITECT_REGISTRY_ABI,
  ARCHITECT_REGISTRY_ADDRESS,
} from "@/config/contract";
import {
  ACCEPTED_EXTENSIONS,
  formatSize,
  isSupportedFileName,
} from "@/utils/formatters";

// FastAPI backend endpoint (override with NEXT_PUBLIC_API_URL in .env.local).
const UPLOAD_URL = `${
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000"
}/upload-model/`;

// Shape of the JSON returned by the FastAPI /upload-model/ endpoint.
interface UploadResponse {
  filename: string;
  file_hash: string;
  ipfs_cid: string;
}

// Which step of the anchoring pipeline we are in.
type AnchorStatus = "idle" | "uploading" | "awaitingWallet" | "confirming";

/** Returns true when the file name ends with an accepted extension. */
function isSupportedFile(file: File): boolean {
  return isSupportedFileName(file.name);
}

export default function Home() {
  const { isConnected, chainId } = useAccount();
  const { switchChain, isPending: isSwitching } = useSwitchChain();
  const { writeContractAsync } = useWriteContract();
  const inputRef = useRef<HTMLInputElement>(null);

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);

  // Anchoring pipeline state (drives button label, disabled state and messages).
  const [status, setStatus] = useState<AnchorStatus>("idle");
  const [anchorError, setAnchorError] = useState<string | null>(null);
  const [result, setResult] = useState<UploadResponse | null>(null);
  const [txHash, setTxHash] = useState<`0x${string}` | undefined>();

  // Watches the submitted transaction until it is mined on Calibration.
  const { isSuccess: isMined } = useWaitForTransactionReceipt({
    hash: txHash,
    chainId: filecoinCalibration.id,
  });

  // Derive status from transaction lifecycle without cascading effect renders
  const effectiveStatus: AnchorStatus = isMined ? "idle" : status;
  const isBusy = effectiveStatus !== "idle";
  const isWrongNetwork = isConnected && chainId !== filecoinCalibration.id;

  /** Validates a chosen file and stores it in state, or reports an error. */
  const handleFile = useCallback((file: File | undefined) => {
    if (!file) return;
    if (!isSupportedFile(file)) {
      setSelectedFile(null);
      setFileError(
        `"${file.name}" is not supported. Please use ${ACCEPTED_EXTENSIONS.join(" or ")} files.`,
      );
      return;
    }
    setFileError(null);
    setSelectedFile(file);
    setResult(null);
    setTxHash(undefined);
  }, []);

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragging(false);
    handleFile(event.dataTransfer.files[0]);
  };

  /**
   * End-to-end anchoring flow: Browser -> FastAPI -> IPFS/Filecoin -> FEVM.
   *
   *  STEP 1 (off-chain storage): POST the raw file to FastAPI. The backend
   *         pushes it to IPFS through Lighthouse (producing a content-derived
   *         CID) and computes a hash of the file bytes.
   *  STEP 2 (bridge): Read `ipfs_cid` and `file_hash` from the JSON response.
   *         These two values are the cryptographic fingerprints of the file.
   *  STEP 3 (on-chain proof): Ask the user's wallet to sign a transaction
   *         calling `anchorBlueprint(cid, hash)` on ArchitectRegistry (FEVM,
   *         Filecoin Calibration). Anyone can later re-hash the file and
   *         compare it with the immutable on-chain record.
   *
   * Every step is wrapped in try/catch so failures (backend down, upload
   * rejected, wallet rejection, reverted tx) surface as readable UI errors.
   */
  const handleAnchor = async () => {
    if (!selectedFile) return;

    setAnchorError(null);
    setResult(null);
    setTxHash(undefined);

    try {
      // ---- STEP 1: upload to FastAPI (which pins to IPFS via Lighthouse) ----
      setStatus("uploading"); // UI: "Uploading to IPFS via Lighthouse..."

      const formData = new FormData();
      formData.append("file", selectedFile); // field name must match FastAPI param

      let response: Response;
      try {
        response = await fetch(UPLOAD_URL, { method: "POST", body: formData });
      } catch {
        // fetch only rejects on network-level problems (server down, CORS...).
        throw new Error(
          `Cannot reach the backend at ${UPLOAD_URL}. Is FastAPI running (and CORS enabled)?`,
        );
      }

      if (!response.ok) {
        const detail = await response.text().catch(() => "");
        throw new Error(
          `Upload failed (HTTP ${response.status}). ${detail.slice(0, 200)}`,
        );
      }

      // ---- STEP 2: extract the CID + hash returned by the backend ----
      const data = (await response.json()) as UploadResponse;
      if (!data.ipfs_cid || !data.file_hash) {
        throw new Error("Backend response is missing `ipfs_cid` or `file_hash`.");
      }
      setResult(data);

      // ---- STEP 3: anchor CID + hash on the FEVM smart contract ----
      setStatus("awaitingWallet"); // UI: "Awaiting Wallet Approval..."

      const hash = await writeContractAsync({
        address: ARCHITECT_REGISTRY_ADDRESS,
        abi: ARCHITECT_REGISTRY_ABI,
        functionName: "anchorBlueprint",
        args: [data.ipfs_cid, data.file_hash],
        chainId: filecoinCalibration.id,
      });

      // Wallet approved and broadcast the tx; now wait for it to be mined.
      setTxHash(hash);
      setStatus("confirming");
    } catch (err) {
      console.error("Anchoring failed:", err);
      const message = err instanceof Error ? err.message : String(err);
      // Wallet rejections get a friendlier message than the raw viem error.
      setAnchorError(
        /user rejected|denied/i.test(message)
          ? "Transaction was rejected in your wallet. The file is uploaded to IPFS but not yet anchored on-chain."
          : message.split("\n")[0],
      );
      setStatus("idle");
    }
  };

  const canAnchor = Boolean(selectedFile) && isConnected && !isWrongNetwork && !isBusy;

  const buttonLabel: Record<AnchorStatus, string> = {
    idle: "Anchor on Filecoin",
    uploading: "Uploading to IPFS via Lighthouse...",
    awaitingWallet: "Awaiting Wallet Approval...",
    confirming: "Confirming on Filecoin...",
  };

  return (
    <div className="flex min-h-screen flex-col bg-slate-950 text-slate-200">
      {/* ---------- Header ---------- */}
      <header className="flex items-center justify-between border-b border-slate-800 px-6 py-4">
        <div>
          <h1 className="text-lg font-semibold tracking-tight text-white">
            The Onchain Architect
          </h1>
          <p className="font-mono text-xs text-slate-500">
            Verifiable architectural files on Filecoin
          </p>
        </div>
        <ConnectWalletButton />
      </header>

      {/* ---------- Main content ---------- */}
      <main className="grid flex-1 gap-6 p-6 lg:grid-cols-2">
        {/* Left column: upload + anchor */}
        <section className="flex flex-col gap-4">
          <div
            role="button"
            tabIndex={0}
            onClick={() => inputRef.current?.click()}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") inputRef.current?.click();
            }}
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            className={`flex min-h-64 cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-8 text-center transition ${
              isDragging
                ? "border-sky-400 bg-sky-500/10"
                : "border-slate-700 bg-slate-900/50 hover:border-slate-500"
            }`}
          >
            <input
              ref={inputRef}
              type="file"
              accept={ACCEPTED_EXTENSIONS.join(",")}
              className="hidden"
              onChange={(e) => handleFile(e.target.files?.[0])}
            />
            <p className="text-base font-medium text-white">
              Drag &amp; drop your 3D model here
            </p>
            <p className="mt-1 text-sm text-slate-500">
              or click to browse ({ACCEPTED_EXTENSIONS.join(", ")})
            </p>

            {selectedFile && (
              <div className="mt-6 rounded-md border border-slate-700 bg-slate-900 px-4 py-2 font-mono text-sm text-sky-300">
                {selectedFile.name}{" "}
                <span className="text-slate-500">
                  ({formatSize(selectedFile.size)})
                </span>
              </div>
            )}
            {fileError && (
              <p className="mt-4 text-sm text-red-400">{fileError}</p>
            )}
          </div>

          {isWrongNetwork ? (
            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={() => switchChain({ chainId: filecoinCalibration.id })}
                disabled={isSwitching}
                className="rounded-md bg-amber-500 px-5 py-3 font-semibold text-slate-950 transition hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isSwitching ? "Switching Network..." : "Switch to Filecoin Calibration"}
              </button>
              <p className="text-xs text-amber-400">
                Wallet is connected to an unsupported network. Please switch to Filecoin Calibration (Chain ID 314159) to anchor blueprints.
              </p>
            </div>
          ) : (
            <>
              <button
                type="button"
                onClick={handleAnchor}
                disabled={!canAnchor}
                className="rounded-md bg-sky-500 px-5 py-3 font-semibold text-slate-950 transition hover:bg-sky-400 disabled:cursor-not-allowed disabled:bg-slate-800 disabled:text-slate-500"
              >
                {buttonLabel[effectiveStatus]}
              </button>
              {!canAnchor && !isBusy && (
                <p className="text-xs text-slate-500">
                  {!isConnected
                    ? "Connect your wallet to enable anchoring."
                    : "Select a .ifc or .gltf file to enable anchoring."}
                </p>
              )}
            </>
          )}

          {anchorError && (
            <p role="alert" className="rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-300">
              {anchorError}
            </p>
          )}

          {result && (
            <div className="rounded-md border border-slate-700 bg-slate-900 px-4 py-3 font-mono text-xs text-slate-300">
              <p className="mb-1 text-sm font-semibold text-white">
                {isMined ? "Anchored on Filecoin ✓" : "Uploaded to IPFS"}
              </p>
              <p className="break-all">CID: {result.ipfs_cid}</p>
              <p className="break-all">Hash: {result.file_hash}</p>
              {txHash && (
                <a
                  href={`https://calibration.filfox.info/en/message/${txHash}`}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-1 block break-all text-sky-400 hover:underline"
                >
                  Tx: {txHash}
                </a>
              )}
            </div>
          )}
        </section>

        {/* Right column: 3D viewport */}
        <section className="min-h-96 overflow-hidden rounded-lg border border-slate-800 bg-slate-900">
          <ModelCanvas selectedFile={selectedFile} />
        </section>
      </main>
    </div>
  );
}
