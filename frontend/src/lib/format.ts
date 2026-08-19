import { formatUnits } from "viem";

import { TOKEN_DECIMALS } from "@/constants/contracts";

export function shortAddress(address?: string) {
  if (!address) return "";
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

export function shortHash(hash?: string, size = 10) {
  if (!hash) return "";
  return `${hash.slice(0, size)}…`;
}

export function tokens(value: bigint | undefined, decimals = TOKEN_DECIMALS, dp = 4) {
  if (value === undefined) return "0";
  const asNumber = Number(formatUnits(value, decimals));
  return asNumber.toLocaleString("en-US", { maximumFractionDigits: dp });
}

export function num(value: number, dp = 2) {
  return value.toLocaleString("en-US", {
    minimumFractionDigits: dp,
    maximumFractionDigits: dp,
  });
}

export function signed(value: number, dp = 4) {
  const formatted = num(Math.abs(value), dp);
  return `${value < 0 ? "−" : "+"}${formatted}`;
}

export function pct(value: number, dp = 2) {
  return `${num(value, dp)}%`;
}

export function relativeTime(timestamp: number) {
  if (!timestamp) return "—";
  const seconds = Math.floor(Date.now() / 1000) - timestamp;
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export function riskLabel(score: number) {
  if (score <= 3) return "low";
  if (score <= 6) return "medium";
  return "high";
}
