"use client";

import React, { ReactNode, useState, useEffect } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WagmiProvider } from "wagmi";
import { createAppKit } from "@reown/appkit/react";
import { WagmiAdapter } from "@reown/appkit-adapter-wagmi";
import { bohrTestnet } from "@/config/bohr";

export const projectId =
  process.env.NEXT_PUBLIC_PROJECT_ID || "d9690df1851903b53a4f8c440127edec";

const metadata = {
  name: "TraceBOT",
  description: "On-Chain Transaction & Wallet Investigator on Bohr Network",
  url: "https://tracebot.bohr.life",
  icons: ["https://avatars.githubusercontent.com/u/179229932"],
};

export const wagmiAdapter = new WagmiAdapter({
  networks: [bohrTestnet],
  projectId,
  ssr: true,
});

if (typeof window !== "undefined") {
  createAppKit({
    adapters: [wagmiAdapter],
    networks: [bohrTestnet],
    projectId,
    metadata,
    themeMode: "light",
    themeVariables: {
      "--w3m-accent": "#2563eb",
      "--w3m-border-radius-master": "8px",
    },
    features: {
      analytics: false,
    },
  });
}

export default function Web3Provider({
  children,
}: {
  children: ReactNode;
}) {
  const [queryClient] = useState(() => new QueryClient());
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const config = wagmiAdapter.wagmiConfig as any;

  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        {mounted ? children : null}
      </QueryClientProvider>
    </WagmiProvider>
  );
}
