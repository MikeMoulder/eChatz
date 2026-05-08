"use client";

import "@rainbow-me/rainbowkit/styles.css";
import { getDefaultConfig, RainbowKitProvider, darkTheme } from "@rainbow-me/rainbowkit";
import { WagmiProvider, http, useAccount } from "wagmi";
import { mainnet, sepolia, defineChain } from "wagmi/chains";
import { QueryClientProvider, QueryClient } from "@tanstack/react-query";
import { ReactNode, useEffect } from "react";
import { getRelayerInstance } from "@/lib/relayer";

const queryClient = new QueryClient();
const INFURA_KEY = process.env.NEXT_PUBLIC_INFURA_API_KEY;

// Explicitly define Sepolia for clarity (already in wagmi but being explicit)
const sepoliaChain = sepolia;

const config = getDefaultConfig({
  appName: "echatz",
  projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID ?? "echatz-local",
  chains: [sepoliaChain, mainnet],
  transports: {
    [sepoliaChain.id]: http(
      INFURA_KEY ? `https://sepolia.infura.io/v3/${INFURA_KEY}` : "https://rpc.sepolia.org",
    ),
    [mainnet.id]: http(
      INFURA_KEY ? `https://mainnet.infura.io/v3/${INFURA_KEY}` : "https://cloudflare-eth.com",
    ),
  },
  ssr: true,
});

const echatzTheme = darkTheme({
  accentColor: "#D4A017",
  accentColorForeground: "#0B0B0B",
  borderRadius: "none",
  fontStack: "system",
  overlayBlur: "small",
});

/**
 * Pre-warms the relayer SDK singleton as soon as a wallet is connected.
 * This eliminates the cold-start latency (~1-2 s) on the first sendMessage call.
 */
function RelayerPrewarm() {
  const { isConnected } = useAccount();
  useEffect(() => {
    if (!isConnected) return;
    // Fire-and-forget — ignore errors (wallet may not have ethereum injected yet)
    getRelayerInstance().catch(() => {});
  }, [isConnected]);
  return null;
}

export function Providers({ children }: { children: ReactNode }) {
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider theme={echatzTheme} modalSize="compact">
          <RelayerPrewarm />
          {children}
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
