import { defineChain } from "viem";

const CHAIN_ID = Number(process.env.NEXT_PUBLIC_CHAIN_ID || 12345);
const RPC_URL = process.env.NEXT_PUBLIC_RPC_URL || "https://testnet-rpc.botchain.ai";
const EXPLORER = process.env.NEXT_PUBLIC_EXPLORER_URL || "https://testnet-explorer.botchain.ai";
const CHAIN_NAME = process.env.NEXT_PUBLIC_CHAIN_NAME || "BOT Chain Testnet";
const IS_TESTNET = (process.env.NEXT_PUBLIC_IS_TESTNET || "true") === "true";

/**
 * One chain object, driven entirely by env. Switching the whole app from testnet to mainnet is an
 * env change and a redeploy — no code edit, which is what keeps the mainnet cutover boring.
 */
export const botChain = defineChain({
  id: CHAIN_ID,
  name: CHAIN_NAME,
  nativeCurrency: { name: "BOT", symbol: "BOT", decimals: 18 },
  rpcUrls: { default: { http: [RPC_URL] } },
  blockExplorers: { default: { name: "BOT Explorer", url: EXPLORER } },
  testnet: IS_TESTNET,
});

export const EXPLORER_URL = EXPLORER;

export function txUrl(hash: string) {
  return `${EXPLORER}/tx/${hash}`;
}

export function addressUrl(address: string) {
  return `${EXPLORER}/address/${address}`;
}
