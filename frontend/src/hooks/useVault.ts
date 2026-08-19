"use client";

import { useAccount, useChainId, useReadContract, useReadContracts } from "wagmi";

import { botChain } from "@/config/chains";
import {
  APPROVAL_GATE_ABI,
  APPROVAL_GATE_ADDRESS,
  CONTRACTS_CONFIGURED,
  ERC20_ABI,
  INTENT_VAULT_ABI,
  INTENT_VAULT_ADDRESS,
  STRATEGY_REGISTRY_ABI,
  STRATEGY_REGISTRY_ADDRESS,
  TEST_TOKEN_ADDRESS,
} from "@/constants/contracts";

export type Position = {
  strategyId: bigint;
  token: `0x${string}`;
  amount: bigint;
  entryTimestamp: bigint;
  exitTimestamp: bigint;
  intentHash: `0x${string}`;
  active: boolean;
};

export function useOnCorrectChain() {
  const chainId = useChainId();
  return chainId === botChain.id;
}

/** Wallet balance, vault free balance and the current ERC20 allowance, in one multicall. */
export function useVaultBalances() {
  const { address } = useAccount();
  const enabled = Boolean(address) && CONTRACTS_CONFIGURED;

  const { data, refetch, isLoading } = useReadContracts({
    contracts: [
      {
        address: TEST_TOKEN_ADDRESS,
        abi: ERC20_ABI,
        functionName: "balanceOf",
        args: [address ?? "0x0000000000000000000000000000000000000000"],
      },
      {
        address: TEST_TOKEN_ADDRESS,
        abi: ERC20_ABI,
        functionName: "allowance",
        args: [address ?? "0x0000000000000000000000000000000000000000", INTENT_VAULT_ADDRESS],
      },
      {
        address: INTENT_VAULT_ADDRESS,
        abi: INTENT_VAULT_ABI,
        functionName: "freeBalance",
        args: [address ?? "0x0000000000000000000000000000000000000000", TEST_TOKEN_ADDRESS],
      },
      {
        address: INTENT_VAULT_ADDRESS,
        abi: INTENT_VAULT_ABI,
        functionName: "deployedBalance",
        args: [address ?? "0x0000000000000000000000000000000000000000", TEST_TOKEN_ADDRESS],
      },
    ],
    query: { enabled, refetchInterval: 12_000 },
  });

  return {
    walletBalance: (data?.[0]?.result as bigint | undefined) ?? 0n,
    allowance: (data?.[1]?.result as bigint | undefined) ?? 0n,
    freeBalance: (data?.[2]?.result as bigint | undefined) ?? 0n,
    deployedBalance: (data?.[3]?.result as bigint | undefined) ?? 0n,
    isLoading,
    refetch,
  };
}

export function usePositions() {
  const { address } = useAccount();

  const { data, refetch, isLoading } = useReadContract({
    address: INTENT_VAULT_ADDRESS,
    abi: INTENT_VAULT_ABI,
    functionName: "getPositions",
    args: [address ?? "0x0000000000000000000000000000000000000000"],
    query: { enabled: Boolean(address) && CONTRACTS_CONFIGURED, refetchInterval: 15_000 },
  });

  return {
    positions: (data as readonly Position[] | undefined) ?? [],
    isLoading,
    refetch,
  };
}

/** The user's own auto-approve ceiling. `enabled: false` means "ask me every time". */
export function useApprovalConfig() {
  const { address } = useAccount();

  const { data, refetch } = useReadContract({
    address: APPROVAL_GATE_ADDRESS,
    abi: APPROVAL_GATE_ABI,
    functionName: "userConfigs",
    args: [address ?? "0x0000000000000000000000000000000000000000"],
    query: { enabled: Boolean(address) && CONTRACTS_CONFIGURED },
  });

  const [threshold, enabled] = (data as readonly [bigint, boolean] | undefined) ?? [0n, false];
  return { threshold, enabled, refetch };
}

export function useIntentApproved(intentHash?: `0x${string}`) {
  const { address } = useAccount();

  const { data, refetch } = useReadContract({
    address: APPROVAL_GATE_ADDRESS,
    abi: APPROVAL_GATE_ABI,
    functionName: "isIntentApproved",
    args: [address ?? "0x0000000000000000000000000000000000000000", intentHash ?? "0x"],
    query: { enabled: Boolean(address && intentHash) && CONTRACTS_CONFIGURED },
  });

  return { approved: Boolean(data), refetch };
}

/** Registry strategies, read straight from chain — the same list the agent is limited to. */
export function useRegistryStrategies() {
  const { data, isLoading } = useReadContract({
    address: STRATEGY_REGISTRY_ADDRESS,
    abi: STRATEGY_REGISTRY_ABI,
    functionName: "getActiveStrategies",
    query: { enabled: CONTRACTS_CONFIGURED },
  });

  const [ids, list] = (data as
    | readonly [readonly bigint[], readonly { name: string; riskScore: bigint; baseApyBps: bigint; protocolType: string }[]]
    | undefined) ?? [[], []];

  return { ids, list, isLoading };
}
