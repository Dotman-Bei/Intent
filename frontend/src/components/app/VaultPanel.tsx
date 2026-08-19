"use client";

import { useEffect, useState } from "react";
import { formatUnits, parseUnits } from "viem";
import { useWaitForTransactionReceipt, useWriteContract } from "wagmi";

import {
  APPROVAL_GATE_ABI,
  APPROVAL_GATE_ADDRESS,
  ERC20_ABI,
  INTENT_VAULT_ABI,
  INTENT_VAULT_ADDRESS,
  TEST_TOKEN_ADDRESS,
  TOKEN_DECIMALS,
  TOKEN_SYMBOL,
} from "@/constants/contracts";
import { useApprovalConfig, useVaultBalances } from "@/hooks/useVault";
import { num, tokens } from "@/lib/format";

/**
 * Custody + policy controls. Deposit is two transactions on purpose (ERC20 approve, then deposit)
 * — the allowance is scoped to the exact amount rather than left unbounded.
 */
export function VaultPanel({ onChange }: { onChange: () => void }) {
  const { walletBalance, allowance, freeBalance, deployedBalance, refetch } = useVaultBalances();
  const { threshold, enabled, refetch: refetchConfig } = useApprovalConfig();

  const [amount, setAmount] = useState("100");
  const [thresholdInput, setThresholdInput] = useState("100");

  const write = useWriteContract();
  const receipt = useWaitForTransactionReceipt({ hash: write.data });

  useEffect(() => {
    if (!receipt.isSuccess) return;
    void refetch();
    void refetchConfig();
    onChange();
  }, [receipt.isSuccess, refetch, refetchConfig, onChange]);

  const busy = write.isPending || receipt.isLoading;
  const parsed = (() => {
    try {
      return parseUnits(amount || "0", TOKEN_DECIMALS);
    } catch {
      return 0n;
    }
  })();
  const needsAllowance = parsed > allowance;

  const faucet = () =>
    write.writeContract({ address: TEST_TOKEN_ADDRESS, abi: ERC20_ABI, functionName: "faucet" });

  const approveToken = () =>
    write.writeContract({
      address: TEST_TOKEN_ADDRESS,
      abi: ERC20_ABI,
      functionName: "approve",
      args: [INTENT_VAULT_ADDRESS, parsed],
    });

  const deposit = () =>
    write.writeContract({
      address: INTENT_VAULT_ADDRESS,
      abi: INTENT_VAULT_ABI,
      functionName: "deposit",
      args: [TEST_TOKEN_ADDRESS, parsed],
    });

  const withdraw = () =>
    write.writeContract({
      address: INTENT_VAULT_ADDRESS,
      abi: INTENT_VAULT_ABI,
      functionName: "withdraw",
      args: [TEST_TOKEN_ADDRESS, parsed],
    });

  const saveThreshold = () => {
    let value = 0n;
    try {
      value = parseUnits(thresholdInput || "0", TOKEN_DECIMALS);
    } catch {
      return;
    }
    write.writeContract({
      address: APPROVAL_GATE_ADDRESS,
      abi: APPROVAL_GATE_ABI,
      functionName: "setConfig",
      args: [value],
    });
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <div className="grid2">
        <div className="cell cell-tight">
          <span className="kicker">In vault, idle</span>
          <span className="n">{tokens(freeBalance)}</span>
          <span className="small" style={{ color: "var(--faint)" }}>
            {TOKEN_SYMBOL} ready to deploy
          </span>
        </div>
        <div className="cell cell-tight">
          <span className="kicker">Deployed</span>
          <span className="n">{tokens(deployedBalance)}</span>
          <span className="small" style={{ color: "var(--faint)" }}>
            principal in open positions
          </span>
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
          <span className="kicker">Move funds</span>
          <span className="small" style={{ color: "var(--faint)" }}>
            wallet {tokens(walletBalance)} {TOKEN_SYMBOL}
          </span>
        </div>

        <div style={{ display: "flex", gap: 8 }}>
          <input
            className="field field-mono"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            inputMode="decimal"
            aria-label={`Amount in ${TOKEN_SYMBOL}`}
          />
          {needsAllowance ? (
            <button type="button" className="btn" onClick={approveToken} disabled={busy || parsed === 0n}>
              Approve
            </button>
          ) : (
            <button type="button" className="btn" onClick={deposit} disabled={busy || parsed === 0n}>
              Deposit
            </button>
          )}
        </div>

        <div style={{ display: "flex", gap: 14, alignItems: "center", flexWrap: "wrap" }}>
          <button type="button" className="link-quiet" onClick={withdraw} disabled={busy}>
            Withdraw idle balance
          </button>
          <button type="button" className="link-quiet" onClick={faucet} disabled={busy}>
            Testnet faucet (+1,000 {TOKEN_SYMBOL})
          </button>
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <span className="kicker">Auto-approve threshold</span>
        <p className="small">
          {enabled
            ? `Anything at or under ${num(Number(formatUnits(threshold, TOKEN_DECIMALS)), 0)} ${TOKEN_SYMBOL} executes without a second signature.`
            : "Unset — every intent asks for your signature. That is the safe default."}
        </p>
        <div style={{ display: "flex", gap: 8 }}>
          <input
            className="field field-mono"
            value={thresholdInput}
            onChange={(event) => setThresholdInput(event.target.value)}
            inputMode="decimal"
            aria-label="Auto-approve threshold"
          />
          <button type="button" className="btn" onClick={saveThreshold} disabled={busy}>
            Save
          </button>
        </div>
      </div>

      {busy ? (
        <p className="small" style={{ color: "var(--faint)" }}>
          {write.isPending ? "Confirm in your wallet…" : "Waiting for confirmation…"}
        </p>
      ) : null}
      {write.error ? (
        <p className="small" style={{ color: "var(--gold)" }}>
          ⚠ {write.error.message.split("\n")[0].slice(0, 140)}
        </p>
      ) : null}
    </div>
  );
}
