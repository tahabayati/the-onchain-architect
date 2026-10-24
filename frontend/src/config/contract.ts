/**
 * contract.ts — ArchitectRegistry contract address + ABI
 *
 * WHAT: Exposes the deployed ArchitectRegistry address and a minimal ABI.
 * WHY:  The frontend only needs `anchorBlueprint` for now. Keeping the ABI
 *       here (as `const`) lets Wagmi/Viem infer fully-typed arguments.
 * FILECOIN: The contract lives on the Filecoin Calibration testnet (FEVM).
 *       It stores the IPFS CID and SHA-256 hash of an uploaded blueprint,
 *       creating a permanent, verifiable on-chain record of the file.
 */

export const ARCHITECT_REGISTRY_ADDRESS = (process.env
  .NEXT_PUBLIC_ARCHITECT_REGISTRY_ADDRESS ??
  "0xE91f75b580d1aF8CaFA42cB7d4Bf17830666112c") as `0x${string}`;

export const ARCHITECT_REGISTRY_ABI = [
  {
    type: "function",
    name: "anchorBlueprint",
    stateMutability: "nonpayable",
    inputs: [
      { name: "_fileCID", type: "string" },
      { name: "_fileHash", type: "string" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "getBlueprintCount",
    stateMutability: "view",
    inputs: [{ name: "_architect", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "getBlueprint",
    stateMutability: "view",
    inputs: [
      { name: "_architect", type: "address" },
      { name: "_index", type: "uint256" },
    ],
    outputs: [
      {
        name: "",
        type: "tuple",
        components: [
          { name: "architect", type: "address" },
          { name: "fileCID", type: "string" },
          { name: "fileHash", type: "string" },
          { name: "timestamp", type: "uint256" },
        ],
      },
    ],
  },
  {
    type: "function",
    name: "getArchitectBlueprints",
    stateMutability: "view",
    inputs: [{ name: "_architect", type: "address" }],
    outputs: [
      {
        name: "",
        type: "tuple[]",
        components: [
          { name: "architect", type: "address" },
          { name: "fileCID", type: "string" },
          { name: "fileHash", type: "string" },
          { name: "timestamp", type: "uint256" },
        ],
      },
    ],
  },
] as const;
