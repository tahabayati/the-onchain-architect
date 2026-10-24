# Smart Contracts (Hardhat & FEVM)

This folder contains the Solidity contract and Hardhat setup for **The Onchain Architect**.

The contract (`ArchitectRegistry.sol`) is an append-only registry deployed on the Filecoin Calibration testnet. When an architect uploads a 3D model, its IPFS CID and SHA-256 hash are recorded here against the architect's wallet address.

---

## Deployed Address (Filecoin Calibration)

| Contract | Network | Chain ID | Address | Block Explorer |
| :--- | :--- | :--- | :--- | :--- |
| `ArchitectRegistry` | Filecoin Calibration Testnet | `314159` | `0xE91f75b580d1aF8CaFA42cB7d4Bf17830666112c` | [View on Filfox](https://calibration.filfox.info/en/address/0xE91f75b580d1aF8CaFA42cB7d4Bf17830666112c) |

Deployment history and logs live in [`ignition/deployments/chain-314159/`](./ignition/deployments/chain-314159/).

---

## How It Works

- **`anchorBlueprint(fileCID, fileHash)`:** Takes the IPFS CID returned by Lighthouse and the file's SHA-256 hash, and stores them with `block.timestamp` under `msg.sender`.
- **Append-only:** There is no delete function, no pause switch, and no admin key. Once anchored, the record stays there.
- **Gas-friendly reads:** In addition to fetching all models for an address (`getArchitectBlueprints`), it supports index-based lookups (`getBlueprintCount` and `getBlueprint(index)`) so you don't blow up RPC memory if an account has many uploads.
- **Custom errors:** Uses `EmptyCID()`, `EmptyHash()`, and `IndexOutOfBounds()` to keep gas costs low on reverts.

---

## Quickstart

### 1. Install dependencies

```bash
npm install
```

### 2. Run the tests

We use Hardhat v3 with Node's native test runner (`node:test`) and Viem:

```bash
npm test
```

All 6 tests run against a local in-memory EVM and cover single anchoring, multi-record ordering, address separation, event emissions, empty inputs, and bounds checking.

### 3. Deploy your own copy to Calibration

1. Copy `.env.example`:
   ```bash
   cp .env.example .env
   ```
2. Put your testnet wallet's private key in `.env`:
   ```env
   PRIVATE_KEY=0x...your_testnet_private_key
   ```
   *(Make sure the wallet has test FIL from the [Calibration Faucet](https://faucet.calibnet.chainsafe-fil.io/))*.

3. Compile and deploy using Hardhat Ignition:
   ```bash
   npm run compile
   npm run deploy:calibration
   ```
   Ignition will output the deployed contract address. If you deploy a new one, set `NEXT_PUBLIC_ARCHITECT_REGISTRY_ADDRESS` in `frontend/.env.local`.
