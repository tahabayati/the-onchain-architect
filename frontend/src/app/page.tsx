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
  shortenAddress,
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

  /** Generates a lightweight IFC sample model in memory for reviewer convenience. */
  const handleLoadSample = useCallback(() => {
    const sampleIfcContent = `ISO-10303-21;
HEADER;
FILE_DESCRIPTION(('ViewDefinition [CoordinationView]'),'2;1');
FILE_NAME('sample_villa.ifc','2026-10-24T12:00:00',('Architect'),('Onchain Studio'),'IfcOpenShell','TheOnchainArchitect','Approved');
FILE_SCHEMA(('IFC4'));
ENDSEC;
DATA;
#1=IFCPROJECT('0Yv_4O$EX0h8h9$rJ1v8X$',#2,'Sample Villa Project',$,$,$,$,(#3),#4);
ENDSEC;
END-ISO-10303-21;`;
    const file = new File([sampleIfcContent], "sample_villa.ifc", {
      type: "application/x-step",
    });
    handleFile(file);
  }, [handleFile]);

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragging(false);
    handleFile(event.dataTransfer.files[0]);
  };

  /**
   * End-to-end anchoring flow: Browser -> FastAPI -> IPFS/Filecoin -> FEVM.
   */
  const handleAnchor = async () => {
    if (!selectedFile) return;

    setAnchorError(null);
    setResult(null);
    setTxHash(undefined);

    try {
      // ---- STEP 1: upload to FastAPI (which pins to IPFS via Lighthouse) ----
      setStatus("uploading");

      const formData = new FormData();
      formData.append("file", selectedFile);

      let response: Response;
      try {
        response = await fetch(UPLOAD_URL, { method: "POST", body: formData });
      } catch {
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
      setStatus("awaitingWallet");

      const hash = await writeContractAsync({
        address: ARCHITECT_REGISTRY_ADDRESS,
        abi: ARCHITECT_REGISTRY_ABI,
        functionName: "anchorBlueprint",
        args: [data.ipfs_cid, data.file_hash],
        chainId: filecoinCalibration.id,
      });

      setTxHash(hash);
      setStatus("confirming");
    } catch (err) {
      console.error("Anchoring failed:", err);
      const message = err instanceof Error ? err.message : String(err);
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
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 px-6 py-4">
        <div className="flex items-center gap-4">
          <div>
            <h1 className="text-base font-medium tracking-tight text-white">
              The Onchain Architect
            </h1>
            <p className="text-xs text-slate-500">
              Verifiable architectural models on Filecoin
            </p>
          </div>

          <div className="hidden sm:flex items-center gap-3 border-l border-slate-800 pl-4 font-mono text-xs text-slate-500">
            <span>
              network:{" "}
              <span
                className={
                  isWrongNetwork ? "text-amber-400 font-medium" : "text-slate-300"
                }
              >
                {!isConnected
                  ? "calibration"
                  : isWrongNetwork
                  ? "wrong-network (need 314159)"
                  : "calibration"}
              </span>
            </span>
            <span className="text-slate-700">|</span>
            <a
              href={`https://calibration.filfox.info/en/address/${ARCHITECT_REGISTRY_ADDRESS}`}
              target="_blank"
              rel="noreferrer"
              className="text-slate-500 hover:text-slate-300 transition"
              title="Inspect registry contract on Filfox explorer"
            >
              contract:{" "}
              <span className="text-slate-300 underline underline-offset-2 decoration-slate-700 hover:decoration-slate-400">
                {shortenAddress(ARCHITECT_REGISTRY_ADDRESS)}
              </span>
            </a>
          </div>
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

          {/* Quick-action helper for reviewers without an IFC file on their machine */}
          <div className="flex items-center justify-between px-1 text-xs text-slate-500">
            <span>No model file at hand?</span>
            <button
              type="button"
              onClick={handleLoadSample}
              className="font-medium text-sky-400 hover:text-sky-300 hover:underline"
            >
              Load sample_villa.ifc
            </button>
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
                Connected to an unsupported network. Please switch to Filecoin Calibration (Chain ID 314159). Need RPC details? See the{" "}
                <a
                  href="https://github.com/tahabayati/the-onchain-architect#troubleshooting"
                  target="_blank"
                  rel="noreferrer"
                  className="underline underline-offset-2 hover:text-amber-200"
                >
                  troubleshooting guide
                </a>
                .
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
                <div className="flex flex-col gap-1 text-xs">
                  {!isConnected ? (
                    <>
                      <p className="text-slate-400">
                        Connect your wallet to Filecoin Calibration (tFIL required for gas) to anchor.
                      </p>
                      <p className="text-[11px] text-slate-500">
                        Having issues adding Calibration or need testnet tFIL? Check our{" "}
                        <a
                          href="https://github.com/tahabayati/the-onchain-architect#troubleshooting"
                          target="_blank"
                          rel="noreferrer"
                          className="text-sky-400 underline underline-offset-2 hover:text-sky-300"
                        >
                          troubleshooting guide on GitHub
                        </a>
                        .
                      </p>
                    </>
                  ) : (
                    <p className="text-slate-500">
                      Select a .ifc or .gltf file to enable anchoring.
                    </p>
                  )}
                </div>
              )}
            </>
          )}

          {anchorError && (
            <p role="alert" className="rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-300">
              {anchorError}
            </p>
          )}

          {result && (
            <div className="rounded-md border border-slate-700 bg-slate-900 p-4 font-mono text-xs text-slate-300">
              <div className="mb-3 flex items-center justify-between border-b border-slate-800 pb-2">
                <span className="font-semibold text-white">
                  {isMined ? "Anchored on Filecoin ✓" : "Uploaded to IPFS"}
                </span>
                <span className="text-slate-500">{result.filename}</span>
              </div>

              <div className="space-y-2">
                <div>
                  <span className="text-slate-500">IPFS CID: </span>
                  <a
                    href={`https://gateway.lighthouse.storage/ipfs/${result.ipfs_cid}`}
                    target="_blank"
                    rel="noreferrer"
                    className="break-all text-sky-400 hover:underline"
                    title="Inspect file on Lighthouse IPFS gateway"
                  >
                    {result.ipfs_cid} ↗
                  </a>
                </div>

                <div>
                  <span className="text-slate-500">SHA-256: </span>
                  <span className="break-all text-slate-300">{result.file_hash}</span>
                </div>

                {txHash && (
                  <div className="pt-2 border-t border-slate-800">
                    <span className="text-slate-500">FEVM Tx: </span>
                    <a
                      href={`https://calibration.filfox.info/en/message/${txHash}`}
                      target="_blank"
                      rel="noreferrer"
                      className="break-all text-sky-400 hover:underline"
                      title="View transaction on Filfox Calibration explorer"
                    >
                      {txHash} ↗
                    </a>
                  </div>
                )}
              </div>
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
