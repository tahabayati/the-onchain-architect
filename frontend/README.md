# Frontend (Next.js & Web3)

This is the web UI for **The Onchain Architect**.

It lets you drop in an architectural model (`.ifc` or `.gltf`), previews it with a simple 3D wireframe canvas, sends it to the backend to get pinned to IPFS, and lets you anchor the resulting CID and SHA-256 hash on Filecoin using your MetaMask wallet.

Built with Next.js 16 (App Router), React 19, React-Three-Fiber, Tailwind CSS, and Wagmi / Viem.

---

## What's in Here

```text
src/
├── app/
│   ├── globals.css          # Tailwind dark theme styles
│   ├── layout.tsx           # Root layout wrapping the app in Web3Provider
│   └── page.tsx             # Dropzone, upload pipeline, and transaction button
├── components/
│   ├── ConnectWalletButton.tsx # Connect/disconnect button and address shortener
│   ├── ModelCanvas.tsx      # React-Three-Fiber 3D canvas (idle state + rotating preview)
│   └── Web3Provider.tsx     # Sets up Wagmi and TanStack Query
└── config/
    ├── contract.ts          # Deployed ArchitectRegistry address and ABI
    └── wagmi.ts             # Filecoin Calibration and Mainnet network config
```

---

## Running Locally

### 1. Install dependencies

```bash
npm install
```

### 2. Environment variables

Copy `.env.example` to `.env.local`:

```bash
cp .env.example .env.local
```

Default contents:

```env
# Point to your local FastAPI backend
NEXT_PUBLIC_API_URL=http://localhost:8000

# Optional: override contract address if you deploy your own to Calibration
# NEXT_PUBLIC_ARCHITECT_REGISTRY_ADDRESS=0xE91f75b580d1aF8CaFA42cB7d4Bf17830666112c
```

### 3. Start the dev server

```bash
npm run dev
```

Open `http://localhost:3000`.

### 4. Running tests

```bash
npm test
```

Runs the client validation and Web3 configuration test suite using Node's native test runner.

### 5. Code quality & linting

```bash
npm run lint
```

---

## Tips & Troubleshooting

- **Switching Networks:** Anchoring happens on the Filecoin Calibration testnet (Chain ID `314159`). If your wallet is on Ethereum or another chain, a yellow "Switch to Filecoin Calibration" button will appear.
- **RPC Issues:** If Chainlist fails to add Calibration to MetaMask, use the public Glif RPC: `https://api.calibration.node.glif.io/rpc/v1`.
- **Chain ID mismatch error:** If you just switched networks in MetaMask and the app throws a mismatch error, disconnect via the button in the top right, refresh the page, and reconnect.
