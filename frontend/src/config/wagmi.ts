/**
 * wagmi.ts — Web3 configuration for "The Onchain Architect"
 *
 * WHAT: Declares which blockchains the dApp talks to and which wallet
 *       connector is used (the browser-injected wallet, e.g. MetaMask).
 * WHY:  Keeping this in one file means forkers can swap networks or wallets
 *       without touching any UI component.
 * FILECOIN: Both Filecoin Mainnet (FEVM) and the Calibration testnet are
 *       registered. Develop on Calibration (free test FIL), ship on Mainnet.
 *       Smart-contract anchoring of CIDs (see /contracts) will use these chains.
 */

import { createConfig, http } from "wagmi";
import { filecoin, filecoinCalibration } from "wagmi/chains";
import { injected } from "wagmi/connectors";

export const wagmiConfig = createConfig({
  // Order matters: the first chain is the default one the wallet is asked to use.
  chains: [filecoinCalibration, filecoin],

  // `injected` talks to any EIP-1193 browser wallet (MetaMask, Rabby, ...).
  // `target: "metaMask"` makes us prefer MetaMask when several wallets exist.
  connectors: [injected({ target: "metaMask" })],

  // Public RPC endpoints come from each chain's default definition in viem.
  // For production, replace these with your own RPC URL via an env variable.
  transports: {
    [filecoinCalibration.id]: http(),
    [filecoin.id]: http(),
  },

  // Required for Next.js: avoids hydration mismatches with server rendering.
  ssr: true,
});
