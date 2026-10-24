"use client";

/**
 * ConnectWalletButton.tsx — MetaMask connect / disconnect control
 *
 * WHAT: Shows "Connect Wallet" when disconnected, or the shortened address
 *       plus a Disconnect action when connected.
 * WHY:  A wallet connection is required to sign the Filecoin anchoring tx.
 * FILECOIN: Connects to the user's EVM wallet, which works with FEVM chains.
 */

import { useAccount, useConnect, useDisconnect } from "wagmi";
import { shortenAddress } from "@/utils/formatters";

export function ConnectWalletButton() {
  const { address, isConnected } = useAccount();
  const { connect, connectors, isPending, error } = useConnect();
  const { disconnect } = useDisconnect();

  if (isConnected && address) {
    return (
      <div className="flex items-center gap-3">
        <span className="rounded-md border border-slate-700 bg-slate-900 px-3 py-1.5 font-mono text-sm text-sky-300">
          {shortenAddress(address)}
        </span>
        <button
          onClick={() => disconnect()}
          className="rounded-md border border-slate-700 px-3 py-1.5 text-sm text-slate-300 transition hover:border-slate-500 hover:text-white"
        >
          Disconnect
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        onClick={() => connect({ connector: connectors[0] })}
        disabled={isPending || connectors.length === 0}
        className="rounded-md bg-sky-500 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-sky-400 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isPending ? "Connecting..." : "Connect Wallet"}
      </button>
      {/* Surface connection failures (e.g. user rejected, no wallet installed). */}
      {error && <span className="text-xs text-red-400">{error.message}</span>}
    </div>
  );
}
