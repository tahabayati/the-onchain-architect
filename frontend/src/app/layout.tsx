/**
 * layout.tsx — Root layout of "The Onchain Architect"
 *
 * WHAT: Defines the HTML shell, fonts, and metadata for every page, and wraps
 *       the app in Web3Provider so all components can access the user's wallet.
 * WHY:  A single provider at the root avoids re-creating wallet state per page.
 * FILECOIN: Wallet context here enables signing FEVM transactions app-wide.
 */

import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Web3Provider } from "@/components/Web3Provider";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "The Onchain Architect",
  description:
    "Open-source boilerplate for anchoring architectural 3D files on Filecoin with verifiable CIDs.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <Web3Provider>{children}</Web3Provider>
      </body>
    </html>
  );
}
