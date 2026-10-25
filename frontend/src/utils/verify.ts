/**
 * verify.ts — Browser-side file verification helpers
 *
 * WHAT it does:
 *     Computes the SHA-256 of a file with the Web Crypto API and compares it
 *     with the records stored in the ArchitectRegistry contract.
 *
 * WHY it exists:
 *     The central claim of this project is that anyone can check a file against
 *     the on-chain anchor without trusting our backend. The hash is recomputed
 *     in the user's browser, so the file never leaves their machine.
 *
 * HOW it connects to Filecoin:
 *     The records come from the FEVM registry contract (getArchitectBlueprints).
 *     A match means the file is byte-for-byte what was anchored with that CID.
 */

export interface BlueprintRecord {
  architect: string;
  fileCID: string;
  fileHash: string;
  timestamp: bigint;
}

export type VerifyOutcome =
  | { status: "match"; record: BlueprintRecord }
  | { status: "hash-mismatch"; record: BlueprintRecord }
  | { status: "not-found" };

/** Returns the lowercase hex SHA-256 digest of the given bytes. */
export async function sha256Hex(data: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Looks for the file in a list of on-chain records.
 * With a CID, the record with that CID must exist and its hash must match.
 * Without a CID, any record with the same hash counts as a match.
 */
export function findBlueprint(
  records: readonly BlueprintRecord[],
  fileHash: string,
  cid?: string,
): VerifyOutcome {
  const wanted = fileHash.toLowerCase();
  const trimmedCid = cid?.trim();

  if (trimmedCid) {
    const record = records.find((r) => r.fileCID === trimmedCid);
    if (!record) return { status: "not-found" };
    return record.fileHash.toLowerCase() === wanted
      ? { status: "match", record }
      : { status: "hash-mismatch", record };
  }

  const record = records.find((r) => r.fileHash.toLowerCase() === wanted);
  return record ? { status: "match", record } : { status: "not-found" };
}
