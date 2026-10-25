"use client";

/**
 * VerifyFile.tsx — "Verify a file" box
 *
 * WHAT it does:
 *     Lets anyone drop a file, enter the architect's wallet address (and
 *     optionally the CID), and checks the file's SHA-256 against the records
 *     stored in the ArchitectRegistry contract.
 *
 * WHY it exists:
 *     It shows the project's main claim from the UI: the hash is recomputed in
 *     the browser and compared with the on-chain anchor, with no backend call.
 *
 * HOW it connects to Filecoin:
 *     Reads getArchitectBlueprints from the FEVM registry on Calibration with a
 *     public RPC client, so no wallet connection or gas is needed to verify.
 */

import { useState } from "react";
import { isAddress } from "viem";
import { useAccount, usePublicClient } from "wagmi";
import { filecoinCalibration } from "wagmi/chains";
import {
  ARCHITECT_REGISTRY_ABI,
  ARCHITECT_REGISTRY_ADDRESS,
} from "@/config/contract";
import { formatSize } from "@/utils/formatters";
import {
  findBlueprint,
  sha256Hex,
  type BlueprintRecord,
  type VerifyOutcome,
} from "@/utils/verify";

export function VerifyFile() {
  const { address: connectedAddress } = useAccount();
  const publicClient = usePublicClient({ chainId: filecoinCalibration.id });

  const [file, setFile] = useState<File | null>(null);
  const [architect, setArchitect] = useState("");
  const [cid, setCid] = useState("");
  const [isChecking, setIsChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [localHash, setLocalHash] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<VerifyOutcome | null>(null);

  // Default to the connected wallet when the user has not typed an address.
  const architectToCheck = architect.trim() || connectedAddress || "";

  const handleVerify = async () => {
    if (!file) return;
    setError(null);
    setOutcome(null);
    setLocalHash(null);

    if (!isAddress(architectToCheck)) {
      setError("Enter the architect's wallet address (0x...) or connect that wallet.");
      return;
    }
    if (!publicClient) {
      setError("Could not create a Filecoin Calibration RPC client.");
      return;
    }

    setIsChecking(true);
    try {
      const hash = await sha256Hex(await file.arrayBuffer());
      setLocalHash(hash);

      const records = (await publicClient.readContract({
        address: ARCHITECT_REGISTRY_ADDRESS,
        abi: ARCHITECT_REGISTRY_ABI,
        functionName: "getArchitectBlueprints",
        args: [architectToCheck],
      })) as readonly BlueprintRecord[];

      setOutcome(findBlueprint(records, hash, cid));
    } catch (err) {
      console.error("Verification failed:", err);
      const message = err instanceof Error ? err.message : String(err);
      setError(`Verification failed: ${message.split("\n")[0]}`);
    } finally {
      setIsChecking(false);
    }
  };

  return (
    <div className="rounded-md border border-slate-700 bg-slate-900 p-4 text-sm">
      <h2 className="mb-1 font-medium text-white">Verify a file</h2>
      <p className="mb-3 text-xs text-slate-500">
        The SHA-256 is computed in your browser and compared with the record on
        the Calibration registry. The file is not uploaded anywhere.
      </p>

      <div className="space-y-2">
        <input
          type="file"
          aria-label="File to verify"
          onChange={(e) => {
            setFile(e.target.files?.[0] ?? null);
            setOutcome(null);
            setLocalHash(null);
          }}
          className="block w-full text-xs text-slate-400 file:mr-3 file:rounded file:border-0 file:bg-slate-800 file:px-3 file:py-1.5 file:text-slate-200"
        />
        {file && (
          <p className="font-mono text-xs text-slate-500">
            {file.name} ({formatSize(file.size)})
          </p>
        )}
        <input
          type="text"
          aria-label="Architect wallet address"
          value={architect}
          onChange={(e) => setArchitect(e.target.value)}
          placeholder={connectedAddress ?? "Architect wallet address (0x...)"}
          className="w-full rounded border border-slate-700 bg-slate-950 px-3 py-1.5 font-mono text-xs text-slate-200 placeholder:text-slate-600"
        />
        <input
          type="text"
          aria-label="IPFS CID (optional)"
          value={cid}
          onChange={(e) => setCid(e.target.value)}
          placeholder="IPFS CID (optional)"
          className="w-full rounded border border-slate-700 bg-slate-950 px-3 py-1.5 font-mono text-xs text-slate-200 placeholder:text-slate-600"
        />
        <button
          type="button"
          onClick={handleVerify}
          disabled={!file || isChecking}
          className="w-full rounded bg-slate-800 px-3 py-2 text-xs font-medium text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isChecking ? "Checking..." : "Verify against on-chain record"}
        </button>
      </div>

      {error && (
        <p role="alert" className="mt-3 text-xs text-red-300">
          {error}
        </p>
      )}

      {localHash && (
        <p className="mt-3 break-all font-mono text-xs text-slate-400">
          <span className="text-slate-500">Computed SHA-256: </span>
          {localHash}
        </p>
      )}

      {outcome?.status === "match" && (
        <p role="status" className="mt-2 text-xs text-emerald-300">
          Match. This file is what was anchored with CID {outcome.record.fileCID} on{" "}
          {new Date(Number(outcome.record.timestamp) * 1000).toUTCString()}.
        </p>
      )}
      {outcome?.status === "hash-mismatch" && (
        <p role="status" className="mt-2 text-xs text-red-300">
          No match. The registry has CID {outcome.record.fileCID} with a
          different hash ({outcome.record.fileHash}), so this file differs from
          the one anchored.
        </p>
      )}
      {outcome?.status === "not-found" && (
        <p role="status" className="mt-2 text-xs text-amber-300">
          Not found. This wallet has no record with{" "}
          {cid.trim() ? "that CID" : "this file's hash"}.
        </p>
      )}
    </div>
  );
}
