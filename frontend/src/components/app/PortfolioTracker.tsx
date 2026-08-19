"use client";

import { useEffect } from "react";
import { useAccount, useWaitForTransactionReceipt, useWriteContract } from "wagmi";

import { INTENT_VAULT_ABI, INTENT_VAULT_ADDRESS, TOKEN_SYMBOL } from "@/constants/contracts";
import { usePositions, useRegistryStrategies } from "@/hooks/useVault";
import { relativeTime, shortHash, tokens } from "@/lib/format";

/** Positions come from `IntentVault.getPositions` — chain state, never backend memory. */
export function PortfolioTracker({ refreshKey }: { refreshKey: number }) {
  const { address } = useAccount();
  const { positions, isLoading, refetch } = usePositions();
  const { ids, list } = useRegistryStrategies();

  const close = useWriteContract();
  const receipt = useWaitForTransactionReceipt({ hash: close.data });

  useEffect(() => {
    void refetch();
  }, [refreshKey, refetch]);

  useEffect(() => {
    if (receipt.isSuccess) void refetch();
  }, [receipt.isSuccess, refetch]);

  const nameFor = (strategyId: bigint) => {
    const index = ids.findIndex((id) => id === strategyId);
    return index >= 0 ? list[index]?.name : `Strategy #${strategyId.toString()}`;
  };

  if (isLoading) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <div className="skeleton" style={{ height: 58 }} />
        <div className="skeleton" style={{ height: 58 }} />
      </div>
    );
  }

  if (positions.length === 0) {
    return (
      <div className="empty">
        No positions yet. Send an intent above, approve it, and it will appear here as soon as the
        transaction confirms.
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      {positions.map((position, index) => (
        <div
          key={index}
          className="row-i"
          style={{ display: "flex", justifyContent: "space-between", gap: 16, alignItems: "center" }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <span style={{ fontSize: 13, fontWeight: 500 }}>{nameFor(position.strategyId)}</span>
              <span className="pill" style={{ height: 22, fontSize: 11 }}>
                <span className={`dot${position.active ? "" : " dot-faint"}`} />
                {position.active ? "active" : "closed"}
              </span>
            </div>
            <span className="small" style={{ color: "var(--faint)", fontFamily: "var(--mono)" }}>
              {tokens(position.amount)} {TOKEN_SYMBOL} · opened{" "}
              {relativeTime(Number(position.entryTimestamp))} · {shortHash(position.intentHash, 10)}
            </span>
          </div>

          {position.active ? (
            <button
              type="button"
              className="btn btn-sm"
              disabled={close.isPending || receipt.isLoading}
              onClick={() =>
                close.writeContract({
                  address: INTENT_VAULT_ADDRESS,
                  abi: INTENT_VAULT_ABI,
                  functionName: "closePosition",
                  args: [address as `0x${string}`, BigInt(index)],
                })
              }
            >
              {close.isPending || receipt.isLoading ? "Closing…" : "Close"}
            </button>
          ) : (
            <span className="small" style={{ color: "var(--faint)" }}>
              settled {relativeTime(Number(position.exitTimestamp))}
            </span>
          )}
        </div>
      ))}

      {close.error ? (
        <p className="small" style={{ color: "var(--gold)", marginTop: 10 }}>
          ⚠ {close.error.message.split("\n")[0].slice(0, 140)}
        </p>
      ) : null}
    </div>
  );
}
