import type { Address } from "viem";

import { ApprovalGateABI, IntentVaultABI, MockERC20ABI, StrategyRegistryABI } from "./abi";

const ZERO = "0x0000000000000000000000000000000000000000" as const;

function address(value: string | undefined): Address {
  return (value && value.startsWith("0x") ? value : ZERO) as Address;
}

export const INTENT_VAULT_ADDRESS = address(process.env.NEXT_PUBLIC_INTENT_VAULT);
export const STRATEGY_REGISTRY_ADDRESS = address(process.env.NEXT_PUBLIC_STRATEGY_REGISTRY);
export const APPROVAL_GATE_ADDRESS = address(process.env.NEXT_PUBLIC_APPROVAL_GATE);
export const TEST_TOKEN_ADDRESS = address(process.env.NEXT_PUBLIC_TEST_TOKEN);

export const TOKEN_DECIMALS = 18;
export const TOKEN_SYMBOL = "BOT";

/** True once the deploy script's addresses are in .env.local. */
export const CONTRACTS_CONFIGURED = INTENT_VAULT_ADDRESS !== ZERO;

export const INTENT_VAULT_ABI = IntentVaultABI;
export const STRATEGY_REGISTRY_ABI = StrategyRegistryABI;
export const APPROVAL_GATE_ABI = ApprovalGateABI;
export const ERC20_ABI = MockERC20ABI;
