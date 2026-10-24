/**
 * layout.tsx — Root layout of "The Onchain Architect"
 *
 * WHAT: Defines the HTML shell, fonts, and metadata for every page, and wraps
 *       the app in Web3Provider so all components can access the user's wallet.
 * WHY:  A single provider at the root avoids re-creating wallet state per page.
 * FILECOIN: Wallet context here enables signing FEVM transactions app-wide.
 */

import type { Metadata } from "next";
import { Web3Provider } from "@/components/Web3Provider";
import "./globals.css";

export const metadata: Metadata = {
  title: "The Onchain Architect",
  description:
    "Open-source boilerplate for anchoring architectural 3D files on Filecoin with verifiable CIDs.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="h-full antialiased">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:ital,opsz,wght@0,14..32,100..900;1,14..32,100..900&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-full flex flex-col font-sans">
        <Web3Provider>{children}</Web3Provider>
      </body>
    </html>
  );
}
