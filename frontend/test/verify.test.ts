/**
 * verify.test.ts — Tests for the browser-side file verification helpers
 *
 * WHAT it does:
 *     Checks the SHA-256 helper against a known digest and the record lookup
 *     for match, hash mismatch and not-found cases.
 *
 * WHY it exists:
 *     The "verify a file" box is the user-facing proof of the project's claim,
 *     so a wrong comparison here would be worse than no feature.
 *
 * HOW it connects to Filecoin:
 *     The records are shaped like the ArchitectRegistry entries returned from
 *     the FEVM contract.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { findBlueprint, sha256Hex, type BlueprintRecord } from "../src/utils/verify.ts";

// SHA-256 of the ASCII string "abc" (NIST test vector).
const ABC_HASH = "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad";

const records: BlueprintRecord[] = [
  { architect: "0x1", fileCID: "cid-one", fileHash: ABC_HASH, timestamp: 1n },
  { architect: "0x1", fileCID: "cid-two", fileHash: "00".repeat(32), timestamp: 2n },
];

describe("sha256Hex", () => {
  it("matches the known digest for 'abc'", async () => {
    const bytes = new TextEncoder().encode("abc");
    assert.equal(await sha256Hex(bytes.buffer as ArrayBuffer), ABC_HASH);
  });
});

describe("findBlueprint", () => {
  it("matches by CID and hash", () => {
    assert.equal(findBlueprint(records, ABC_HASH, "cid-one").status, "match");
  });

  it("is case-insensitive on the hash", () => {
    assert.equal(findBlueprint(records, ABC_HASH.toUpperCase(), "cid-one").status, "match");
  });

  it("reports a mismatch when the CID exists but the hash differs", () => {
    assert.equal(findBlueprint(records, ABC_HASH, "cid-two").status, "hash-mismatch");
  });

  it("reports not-found for an unknown CID", () => {
    assert.equal(findBlueprint(records, ABC_HASH, "cid-missing").status, "not-found");
  });

  it("matches by hash alone when no CID is given", () => {
    assert.equal(findBlueprint(records, ABC_HASH).status, "match");
    assert.equal(findBlueprint(records, "ff".repeat(32)).status, "not-found");
  });
});
