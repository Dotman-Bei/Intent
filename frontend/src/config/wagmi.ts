import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { http } from "wagmi";
import { botChain } from "./chains";

export const wagmiConfig = getDefaultConfig({
  appName: "IntentFlow",
  // Injected wallets (MetaMask) work without a WalletConnect project id; set one to enable
  // the mobile/QR connectors.
  projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || "intentflow-local",
  chains: [botChain],
  transports: { [botChain.id]: http() },
  ssr: true,
});
