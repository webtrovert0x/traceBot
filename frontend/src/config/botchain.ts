import { defineChain } from "viem";

export const botchain = defineChain({
  id: 677,
  name: "BOT Chain",
  nativeCurrency: {
    name: "BOT",
    symbol: "BOT",
    decimals: 18,
  },
  rpcUrls: {
    default: {
      http: [process.env.NEXT_PUBLIC_RPC_URL || "https://rpc.botchain.ai"],
    },
  },
  blockExplorers: {
    default: {
      name: "BotScan",
      url: process.env.NEXT_PUBLIC_EXPLORER_URL || "https://scan.botchain.ai",
    },
  },
  testnet: false,
});

// Backward compatibility alias
export const bohrTestnet = botchain;
export default botchain;

