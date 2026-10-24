/**
 * ArchitectRegistry.ts — Smart Contract Test Suite
 *
 * WHAT it does:
 *     Integration tests for ArchitectRegistry.sol deployed on local Hardhat EVM.
 *     Verifies single-record anchoring, multi-record append semantics, address
 *     segregation, event emission, input validation reverts (EmptyCID, EmptyHash),
 *     and zero-state pagination bounds.
 *
 * WHY it exists:
 *     Permanent on-chain architectural records cannot be patched after deployment.
 *     High-coverage tests ensure that contract storage invariants and gas-efficient
 *     pagination work reliably for developers and grant reviewers.
 *
 * FILECOIN / FEVM:
 *     Simulates the exact bytecode that runs on Filecoin Calibration (Chain ID 314159),
 *     validating on-chain proof anchoring for IPFS CIDs produced by Lighthouse.
 */

import { describe, it } from "node:test";
import assert from "node:assert";
import { network } from "hardhat";

// Hardhat v3 ESM setup: creates an isolated test network connection with helpers built-in
const { viem, networkHelpers } = await network.create();

describe("ArchitectRegistry", function () {
    async function deployRegistryFixture() {
        const [owner, otherAccount] = await viem.getWalletClients();
        const registry = await viem.deployContract("ArchitectRegistry");
        const publicClient = await viem.getPublicClient();
        return { registry, owner, otherAccount, publicClient };
    }

    it("Should anchor a blueprint and retrieve it successfully", async function () {
        const { registry, owner } = await networkHelpers.loadFixture(deployRegistryFixture);

        const testCID = "bafybeig...testcid";
        const testHash = "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855";

        await registry.write.anchorBlueprint([testCID, testHash]);

        // @ts-ignore
        const blueprints = await registry.read.getArchitectBlueprints([owner.account.address]);

        assert.strictEqual(blueprints.length, 1);
        assert.strictEqual(blueprints[0].fileCID, testCID);
        assert.strictEqual(blueprints[0].fileHash, testHash);
        assert.strictEqual(blueprints[0].architect.toLowerCase(), owner.account.address.toLowerCase());
    });

    it("Test 1: Multi-Record Append — maintains upload ordering and count", async function () {
        const { registry, owner } = await networkHelpers.loadFixture(deployRegistryFixture);

        const cid1 = "bafybeig_model_v1";
        const hash1 = "hash_v1_sha256";
        const cid2 = "bafybeig_model_v2";
        const hash2 = "hash_v2_sha256";

        await registry.write.anchorBlueprint([cid1, hash1]);
        await registry.write.anchorBlueprint([cid2, hash2]);

        const count = await registry.read.getBlueprintCount([owner.account.address]);
        assert.strictEqual(count, 2n);

        // @ts-ignore
        const bp1 = await registry.read.getBlueprint([owner.account.address, 0n]);
        // @ts-ignore
        const bp2 = await registry.read.getBlueprint([owner.account.address, 1n]);

        assert.strictEqual(bp1.fileCID, cid1);
        assert.strictEqual(bp1.fileHash, hash1);
        assert.strictEqual(bp2.fileCID, cid2);
        assert.strictEqual(bp2.fileHash, hash2);
    });

    it("Test 2: Address Isolation — strictly segregates blueprints across accounts", async function () {
        const { registry, owner, otherAccount } = await networkHelpers.loadFixture(deployRegistryFixture);

        const ownerCID = "bafybeig_owner_model";
        const ownerHash = "owner_hash_sha256";
        const otherCID = "bafybeig_other_model";
        const otherHash = "other_hash_sha256";

        await registry.write.anchorBlueprint([ownerCID, ownerHash], { account: owner.account });
        await registry.write.anchorBlueprint([otherCID, otherHash], { account: otherAccount.account });

        const ownerCount = await registry.read.getBlueprintCount([owner.account.address]);
        const otherCount = await registry.read.getBlueprintCount([otherAccount.account.address]);

        assert.strictEqual(ownerCount, 1n);
        assert.strictEqual(otherCount, 1n);

        // @ts-ignore
        const ownerBp = await registry.read.getBlueprint([owner.account.address, 0n]);
        // @ts-ignore
        const otherBp = await registry.read.getBlueprint([otherAccount.account.address, 0n]);

        assert.strictEqual(ownerBp.fileCID, ownerCID);
        assert.strictEqual(otherBp.fileCID, otherCID);
        assert.strictEqual(ownerBp.architect.toLowerCase(), owner.account.address.toLowerCase());
        assert.strictEqual(otherBp.architect.toLowerCase(), otherAccount.account.address.toLowerCase());
    });

    it("Test 3: Event Emission — emits BlueprintAnchored with correct arguments", async function () {
        const { registry, owner, publicClient } = await networkHelpers.loadFixture(deployRegistryFixture);

        const testCID = "bafybeig_event_test_cid";
        const testHash = "event_test_sha256_digest";

        const hash = await registry.write.anchorBlueprint([testCID, testHash]);
        const receipt = await publicClient.waitForTransactionReceipt({ hash });

        const logs = await publicClient.getContractEvents({
            address: registry.address,
            abi: registry.abi,
            eventName: "BlueprintAnchored",
            fromBlock: receipt.blockNumber,
            toBlock: receipt.blockNumber,
        });

        assert.strictEqual(logs.length, 1);
        // @ts-ignore
        assert.strictEqual(logs[0].args.architect.toLowerCase(), owner.account.address.toLowerCase());
        // @ts-ignore
        assert.strictEqual(logs[0].args.fileCID, testCID);
        // @ts-ignore
        assert.strictEqual(logs[0].args.fileHash, testHash);
    });

    it("Test 4: Input Rejection — reverts with EmptyCID / EmptyHash on blank inputs", async function () {
        const { registry } = await networkHelpers.loadFixture(deployRegistryFixture);

        await assert.rejects(
            async () => {
                await registry.write.anchorBlueprint(["", "valid_hash"]);
            },
            /EmptyCID/
        );

        await assert.rejects(
            async () => {
                await registry.write.anchorBlueprint(["valid_cid", ""]);
            },
            /EmptyHash/
        );
    });

    it("Test 5: Zero-State & Bounds — returns 0 for empty account and reverts out-of-bounds queries", async function () {
        const { registry, otherAccount } = await networkHelpers.loadFixture(deployRegistryFixture);

        const count = await registry.read.getBlueprintCount([otherAccount.account.address]);
        assert.strictEqual(count, 0n);

        // @ts-ignore
        const all = await registry.read.getArchitectBlueprints([otherAccount.account.address]);
        assert.strictEqual(all.length, 0);

        await assert.rejects(
            async () => {
                await registry.read.getBlueprint([otherAccount.account.address, 0n]);
            },
            /IndexOutOfBounds/
        );
    });
});