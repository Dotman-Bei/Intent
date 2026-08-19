"use client";

import { useEffect } from "react";
import { useAccount, useWaitForTransactionReceipt, useWriteContract } from "wagmi";

import { ArrowRight } from "@/components/Icons";
import { CopyInline } from "@/components/Terminal";
import { txUrl } from "@/config/chains";
import {
  APPROVAL_GATE_ABI,
  APPROVAL_GATE_ADDRESS,
  INTENT_VAULT_ABI,
  INTENT_VAULT_ADDRESS,
  TOKEN_SYMBOL,
} from "@/constants/contracts";
import { useIntentApproved } from "@/hooks/useVault";
import type { IntentResponse } from "@/lib/api";
import { num, shortHash, signed } from "@/lib/format";

/** Trims viem's multi-paragraph revert dumps to the first line, which is the part a user can act on. */
function firstLine(error: unknown) {
  if (!error) return null;
  const message = error instanceof Error ? error.message : String(error);
  return message.split("\n")[0].slice(0, 160);
}

export function StrategyCard({
  response,
  freeBalance,
  onExecuted,
}: {
  response: IntentResponse;
  freeBalance: bigint;
  onExecuted: () => void;
}) {
  const { address } = useAccount();
  const strategy = response.recommended;
  const simulation = response.simulation;
  const plan = response.execution_plan;

  const { approved, refetch: refetchApproval } = useIntentApproved(plan?.intent_hash);

  const approval = useWriteContract();
  const approvalReceipt = useWaitForTransactionReceipt({ hash: approval.data });

  const execution = useWriteContract();
  const executionReceipt = useWaitForTransactionReceipt({ hash: execution.data });

  useEffect(() => {
    if (approvalReceipt.isSuccess) void refetchApproval();
  }, [approvalReceipt.isSuccess, refetchApproval]);

  useEffect(() => {
    if (executionReceipt.isSuccess) onExecuted();
  }, [executionReceipt.isSuccess, onExecuted]);

  if (!strategy || !simulation) return null;

  if (!plan) {
    return (
      <div className="note">
        <strong>Analysis only.</strong> The agent has no vault address configured, so it returned a
        recommendation without an executable plan. Set <span className="icode">INTENT_VAULT_ADDRESS</span>{" "}
        in the backend environment to enable execution.
      </div>
    );
  }

  const amountWei = BigInt(plan.amount_wei);
  const fundsShort = freeBalance < amountWei;
  const needsSignature = response.requires_approval && !approved;
  const executed = executionReceipt.isSuccess;

  const execute = () =>
    execution.writeContract({
      address: INTENT_VAULT_ADDRESS,
      abi: INTENT_VAULT_ABI,
      functionName: "executeIntent",
      args: [
        address as `0x${string}`,
        plan.intent_hash,
        BigInt(strategy.strategy_id),
        plan.token_address,
        amountWei,
        plan.strategy_data,
      ],
    });

  const approveIntent = () =>
    approval.writeContract({
      address: APPROVAL_GATE_ADDRESS,
      abi: APPROVAL_GATE_ABI,
      functionName: "approveIntent",
      args: [plan.intent_hash],
    });

  const error =
    firstLine(execution.error) ??
    firstLine(approval.error) ??
    firstLine(executionReceipt.error) ??
    null;

  return (
    <div
      style={{
        border: "1px solid var(--line)",
        borderRadius: 10,
        overflow: "hidden",
        background: "var(--col)",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
          gap: 12,
          padding: "18px 20px",
          borderBottom: "1px solid var(--line)",
          flexWrap: "wrap",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <span className="kicker">Recommended</span>
          <h3>{strategy.name}</h3>
        </div>
        <span className="pill">
          <span className="dot" />
          {strategy.protocol_type} · risk {strategy.risk_score}/10
        </span>
      </div>

      <div className="grid3" style={{ border: 0, borderRadius: 0 }}>
        <div className="cell cell-tight">
          <span className="kicker">Projected APY</span>
          <span className="n">{num(strategy.projected_apy)}%</span>
        </div>
        <div className="cell cell-tight">
          <span className="kicker">{simulation.horizon_days}-day net</span>
          <span className="n">{signed(simulation.projected_return)}</span>
        </div>
        <div className="cell cell-tight">
          <span className="kicker">Break-even</span>
          <span className="n">{simulation.break_even_days}d</span>
        </div>
      </div>

      <div style={{ padding: "16px 20px", borderTop: "1px solid var(--line)" }}>
        <p className="small">{response.rationale}</p>
        <p className="small" style={{ marginTop: 8, color: "var(--faint)" }}>
          Assumes daily compounding at the published APY, a {num(simulation.impermanent_loss_risk * 100, 1)}%
          drawdown haircut for risk {strategy.risk_score}, and {simulation.gas_cost_bot} {TOKEN_SYMBOL} of
          gas. A bad month lands at {signed(simulation.worst_case_return)} {TOKEN_SYMBOL}.
        </p>
        <div style={{ marginTop: 10 }}>
          <CopyInline value={plan.intent_hash} label={`intent ${shortHash(plan.intent_hash, 12)}`} />
        </div>
      </div>

      {fundsShort ? (
        <div style={{ padding: "0 20px 16px" }}>
          <div className="note">
            <strong>Not enough deposited.</strong> This intent needs {num(Number(amountWei) / 1e18, 2)}{" "}
            {TOKEN_SYMBOL} in the vault. Deposit the difference below, then execute.
          </div>
        </div>
      ) : null}

      {needsSignature ? (
        <div style={{ padding: "0 20px 16px" }}>
          <div
            className="note"
            style={{ borderColor: "rgba(200,155,60,.35)", background: "rgba(200,155,60,.07)" }}
          >
            <strong>Approval required.</strong>{" "}
            {response.threshold_configured
              ? `${num(response.parsed_intent?.amount ?? 0, 0)} ${TOKEN_SYMBOL} is over your ${num(response.approval_threshold, 0)} ${TOKEN_SYMBOL} auto-approve threshold.`
              : `You have not set an auto-approve threshold, so ApprovalGate asks for every intent. Set one in the vault panel to skip this step for small amounts.`}{" "}
            Signing approves this one intent hash for 30 minutes — not a standing permission.
          </div>
        </div>
      ) : null}

      {error ? (
        <div style={{ padding: "0 20px 16px" }}>
          <p className="small" style={{ color: "var(--gold)" }}>
            ⚠ {error}
          </p>
        </div>
      ) : null}

      <div
        style={{
          padding: "14px 20px",
          borderTop: "1px solid var(--line)",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <span className="small">
          {executed
            ? "Position opened. The portfolio below is read straight from the vault."
            : needsSignature
              ? "Step 1 of 2 — approve, then execute."
              : "Executes on one wallet signature."}
        </span>

        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          {execution.data ? (
            <a className="link-quiet" href={txUrl(execution.data)} target="_blank" rel="noreferrer">
              View on explorer →
            </a>
          ) : null}

          {needsSignature ? (
            <button
              type="button"
              className="btn"
              style={{ background: "var(--gold)" }}
              onClick={approveIntent}
              disabled={approval.isPending || approvalReceipt.isLoading}
            >
              {approval.isPending
                ? "Confirm in wallet…"
                : approvalReceipt.isLoading
                  ? "Approving…"
                  : "Approve this intent"}
            </button>
          ) : (
            <button
              type="button"
              className="btn"
              onClick={execute}
              disabled={fundsShort || execution.isPending || executionReceipt.isLoading || executed}
            >
              {executed
                ? "Executed ✓"
                : execution.isPending
                  ? "Confirm in wallet…"
                  : executionReceipt.isLoading
                    ? "Executing…"
                    : "Execute strategy"}
              {!executed ? <ArrowRight /> : null}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
