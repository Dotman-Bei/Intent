import { defineChain } from "viem";

/**
 * Defaults are BOT Chain MAINNET (677). They used to be testnet, which meant a missing or
 * unloaded env silently produced an app that called itself "BOT Chain Testnet" and pointed at
 * a hostname that does not resolve — failing towards a claim about which chain the user's funds
 * are on is the wrong direction to fail in. Testnet is now the explicit opt-in.
 */
const CHAIN_ID = Number(process.env.NEXT_PUBLIC_CHAIN_ID || 677);
const RPC_URL = process.env.NEXT_PUBLIC_RPC_URL || "https://rpc.botchain.ai";
const EXPLORER = process.env.NEXT_PUBLIC_EXPLORER_URL || "https://scan.botchain.ai";
const CHAIN_NAME = process.env.NEXT_PUBLIC_CHAIN_NAME || "BOT Chain";
const IS_TESTNET = (process.env.NEXT_PUBLIC_IS_TESTNET || "false") === "true";

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
