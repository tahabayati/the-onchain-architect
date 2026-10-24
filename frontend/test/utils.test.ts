/**
 * utils.test.ts — Frontend Client Logic & Web3 Config Test Suite
 *
 * WHAT it does:
 *     Unit tests for client-side file extension filtering, byte-size formatting,
 *     address truncation, and smart contract configuration invariants.
 *
 * WHY it exists:
 *     Verifies that incoming architectural assets are validated before triggering
 *     network calls, and that Web3 contract addresses and ABI definitions match
 *     the deployed FEVM specifications.
 *
 * HOW it connects to Filecoin:
 *     Ensures that only valid architectural models (.ifc, .gltf) are staged for
 *     Lighthouse IPFS pinning, and confirms that the FEVM Calibration contract
 *     interface exposes the exact anchorBlueprint function.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  ACCEPTED_EXTENSIONS,
  formatSize,
  isSupportedFileName,
  shortenAddress,
} from "../src/utils/formatters.ts";
import {
  ARCHITECT_REGISTRY_ABI,
  ARCHITECT_REGISTRY_ADDRESS,
} from "../src/config/contract.ts";

describe("Frontend Utilities & Validation Suite", () => {
  describe("File Extension Filtering (isSupportedFileName)", () => {
    it("should accept valid lowercase architectural models (.ifc, .gltf)", () => {
      assert.deepStrictEqual([...ACCEPTED_EXTENSIONS], [".ifc", ".gltf"]);
      assert.strictEqual(isSupportedFileName("building_plan.ifc"), true);
      assert.strictEqual(isSupportedFileName("structural_model.gltf"), true);
      assert.strictEqual(isSupportedFileName("complex.path/model.v1.ifc"), true);
    });

    it("should accept uppercase and mixed-case extensions (.IFC, .GLTF)", () => {
      assert.strictEqual(isSupportedFileName("OFFICE_TOWER.IFC"), true);
      assert.strictEqual(isSupportedFileName("render.Gltf"), true);
    });

    it("should reject unsupported file extensions (.exe, .pdf, .png, .dwg)", () => {
      assert.strictEqual(isSupportedFileName("malicious_script.exe"), false);
      assert.strictEqual(isSupportedFileName("blueprint_scan.pdf"), false);
      assert.strictEqual(isSupportedFileName("screenshot.png"), false);
      assert.strictEqual(isSupportedFileName("legacy_drawing.dwg"), false);
    });

    it("should reject empty, non-string, or blank file inputs", () => {
      assert.strictEqual(isSupportedFileName(""), false);
      assert.strictEqual(isSupportedFileName("   "), false);
      // @ts-expect-error testing invalid input types
      assert.strictEqual(isSupportedFileName(null), false);
    });
  });

  describe("File Size Formatter (formatSize)", () => {
    it("should format bytes under 1 KB accurately", () => {
      assert.strictEqual(formatSize(512), "512 B");
      assert.strictEqual(formatSize(0), "0 B");
    });

    it("should format kilobytes accurately", () => {
      assert.strictEqual(formatSize(1024), "1.0 KB");
      assert.strictEqual(formatSize(2048), "2.0 KB");
      assert.strictEqual(formatSize(1536), "1.5 KB");
    });

    it("should format megabytes accurately", () => {
      assert.strictEqual(formatSize(1024 * 1024), "1.0 MB");
      assert.strictEqual(formatSize(25 * 1024 * 1024), "25.0 MB");
    });

    it("should handle negative, NaN, or non-numeric values safely", () => {
      assert.strictEqual(formatSize(-500), "0 B");
      assert.strictEqual(formatSize(NaN), "0 B");
    });
  });

  describe("Wallet Address Truncation (shortenAddress)", () => {
    it("should shorten a standard 42-character EVM address into 0x1234...abcd", () => {
      const address = "0xE91f75b580d1aF8CaFA42cB7d4Bf17830666112c";
      assert.strictEqual(shortenAddress(address), "0xE91f...112c");
    });

    it("should return short strings unchanged and handle empty inputs", () => {
      assert.strictEqual(shortenAddress("0x123"), "0x123");
      assert.strictEqual(shortenAddress(""), "");
    });
  });

  describe("Web3 Contract Configuration Invariants", () => {
    it("should specify a valid 42-character hex address on Filecoin Calibration", () => {
      assert.match(ARCHITECT_REGISTRY_ADDRESS, /^0x[a-fA-F0-9]{40}$/);
      assert.strictEqual(
        ARCHITECT_REGISTRY_ADDRESS.toLowerCase(),
        "0xe91f75b580d1af8cafa42cb7d4bf17830666112c"
      );
    });

    it("should include anchorBlueprint in the contract ABI", () => {
      const anchorFunction = ARCHITECT_REGISTRY_ABI.find(
        (item) => item.type === "function" && item.name === "anchorBlueprint"
      );
      assert.ok(anchorFunction, "anchorBlueprint function definition must exist");
      assert.strictEqual(anchorFunction.inputs.length, 2);
      assert.strictEqual(anchorFunction.inputs[0].name, "_fileCID");
      assert.strictEqual(anchorFunction.inputs[1].name, "_fileHash");
    });

    it("should include pagination functions in the contract ABI", () => {
      const countFunction = ARCHITECT_REGISTRY_ABI.find(
        (item) => item.type === "function" && item.name === "getBlueprintCount"
      );
      const getFunction = ARCHITECT_REGISTRY_ABI.find(
        (item) => item.type === "function" && item.name === "getBlueprint"
      );
      assert.ok(countFunction, "getBlueprintCount must exist in ABI");
      assert.ok(getFunction, "getBlueprint must exist in ABI");
    });
  });
});
