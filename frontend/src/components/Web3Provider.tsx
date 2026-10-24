"use client";

/**
 * Web3Provider.tsx — Application-wide wallet + data-fetching context
 *
 * WHAT: Wraps the app with WagmiProvider (wallet state) and
 *       QueryClientProvider (wagmi v2+ requires TanStack Query internally).
 * WHY:  Any component below this one can call hooks like useAccount() or
 *       useConnect() to interact with MetaMask.
 * FILECOIN: This is the gateway through which users sign the transactions
 *       that anchor a file's CID on Filecoin's FEVM.
 *
 * It is a Client Component because wallet state lives in the browser.
 */

import { useState, type ReactNode } from "react";
import { WagmiProvider } from "wagmi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { wagmiConfig } from "@/config/wagmi";

export function Web3Provider({ children }: { children: ReactNode }) {
  // useState ensures one QueryClient per browser session (not shared between
  // server requests), which is the pattern recommended for Next.js.
  const [queryClient] = useState(() => new QueryClient());

  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </WagmiProvider>
  );
}
