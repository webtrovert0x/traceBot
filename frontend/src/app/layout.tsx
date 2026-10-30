import type { Metadata } from "next";
import "./globals.css";
import Web3Provider from "@/context/Web3Provider";

export const metadata: Metadata = {
  title: "TraceBOT — Transaction & Wallet Investigator | BOT Chain",
  description:
    "Forensic blockchain explorer for BOT Chain (Chain ID: 677). Inspect transaction failures, trace fund flows, verify counterparty contracts, and attest investigations on-chain.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <Web3Provider>{children}</Web3Provider>
      </body>
    </html>
  );
}
