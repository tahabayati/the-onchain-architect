# Contributing to The Onchain Architect

Hey! Thanks for checking out the project. 

The Onchain Architect is an open-source boilerplate built to show how you can store heavy 3D architectural models (.ifc, .gltf) on Filecoin via IPFS and anchor proofs on FEVM with smart contracts.

Whether you're fixing a typo, improving 3D rendering performance, adding proper IFC parsing, or writing tests, contributions are welcome.

---

## How the Monorepo Works

The codebase is split into three independent directories so each part can be run and tested on its own:

- `frontend/`: Next.js 16 app with React-Three-Fiber for 3D previews and Wagmi/Viem for MetaMask.
- `backend/`: FastAPI service that receives the file, checks its size, hashes it with SHA-256, and uploads it to Lighthouse (IPFS/Filecoin).
- `contracts/`: Hardhat v3 project with `ArchitectRegistry.sol` (deployed on Filecoin Calibration testnet).

Keep them decoupled: don't import frontend packages into the contracts or backend logic into the frontend.

---

## Setting Up Locally

You'll need Node.js (>= 20), Python (>= 3.10), and MetaMask installed.

### 1. Clone the repo

```bash
git clone https://github.com/<your-username>/the-onchain-architect.git
cd the-onchain-architect
```

### 2. Contracts

```bash
cd contracts
npm install
npm test
```
If you want to deploy your own copy to Calibration, copy `.env.example` to `.env` and add a testnet private key with some test FIL from the [Calibration Faucet](https://faucet.calibnet.chainsafe-fil.io/).

### 3. Backend

```bash
cd ../backend
python3 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env
# Put your Lighthouse API key in .env (get one for free at files.lighthouse.storage)
pytest backend/tests
uvicorn main:app --reload --port 8000
```

### 4. Frontend

```bash
cd ../frontend
npm install
cp .env.example .env.local
npm run dev
```

Open `http://localhost:3000`, connect your wallet on Calibration, and try uploading a model.

---

## Ground Rules for PRs

Nothing bureaucratic here, just practical habits that keep the repo clean:

1. **No hardcoded secrets:** Never commit private keys, `.env` files, or API keys. Always use `.env.example`.
2. **AI assistants & secret hygiene:** If you use AI tools (Cursor, Copilot, ChatGPT, Claude) while coding, double-check that they don't accidentally read or paste your local `.env` values, testnet private keys, or Lighthouse tokens into committed code or public prompts.
3. **Clear errors:** If something fails (backend down, file too large, rejected transaction), catch it and show a clear message instead of failing silently.
4. **Keep comments human:** When adding a new file or modifying existing logic, add a short comment at the top explaining what it does and why it exists.
5. **Run tests before pushing:**
   - Contracts: `npm test` in `/contracts`
   - Backend: `pytest` in `/backend`
   - Frontend: `npm test` and `npm run lint` in `/frontend`
6. **MIT Licensed:** Make sure any library or code you add is compatible with our MIT license.

---

## Submitting Changes

1. Fork the repo and make your changes in a branch:
   ```bash
   git checkout -b fix-viewer-rotation
   ```
2. Commit with a plain, clear message:
   ```bash
   git commit -m "Improve 3D wireframe camera controls"
   ```
3. Push to your fork and open a Pull Request against `main`. Explain briefly what changed and how you tested it.

If you find a security bug or have a question, feel free to open an issue or start a GitHub discussion!
