"use client";

import { useEffect, useRef, useState } from "react";
import { useAccount } from "wagmi";

import { Ln, Sp, Term } from "@/components/Terminal";
import { submitIntent, type IntentResponse } from "@/lib/api";
import { num } from "@/lib/format";

type Entry =
  | { kind: "you"; text: string }
  | { kind: "trace"; lines: string[] }
  | { kind: "answer"; response: IntentResponse }
  | { kind: "error"; text: string }
  | { kind: "note"; text: string };

const SUGGESTIONS = [
  "Earn yield on 50 BOT with low risk for 30 days",
  "Put 500 BOT to work, aggressive, highest APY you can find",
  "I want stable income on 120 BOT over the next quarter",
];

export function IntentChat({
  onResult,
  onReset,
}: {
  onResult: (response: IntentResponse) => void;
  onReset: () => void;
}) {
  const { address, isConnected } = useAccount();
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [entries, setEntries] = useState<Entry[]>([
    {
      kind: "note",
      text: "Describe what you want in plain English. Nothing is signed until you approve it.",
    },
  ]);
  const bodyRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const node = bodyRef.current?.querySelector(".term-body");
    if (node) node.scrollTop = node.scrollHeight;
  }, [entries]);

  const send = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || busy || !address) return;

    setEntries((prev) => [...prev, { kind: "you", text: trimmed }]);
    setInput("");
    setBusy(true);
    onReset();

    try {
      const response = await submitIntent(trimmed, address);
      setEntries((prev) => [
        ...prev,
        { kind: "trace", lines: response.trace },
        response.ok && response.recommended
          ? { kind: "answer", response }
          : { kind: "error", text: response.error ?? "The agent returned no strategy." },
      ]);
      if (response.ok && response.recommended) onResult(response);
    } catch (error) {
      setEntries((prev) => [
        ...prev,
        {
          kind: "error",
          text:
            error instanceof Error
              ? `${error.message} — is the agent API running on ${process.env.NEXT_PUBLIC_AGENT_API || "http://localhost:8000"}?`
              : "The agent API is unreachable.",
        },
      ]);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }} ref={bodyRef}>
      <Term title={`intentflow — ${address ? `session ${address.slice(0, 6)}` : "not connected"}`} maxHeight={430}>
        {entries.map((entry, index) => (
          <EntryView key={index} entry={entry} />
        ))}
        {busy ? (
          <>
            <Sp />
            <Ln who="agent ›">
              <span className="dim">thinking…</span>
            </Ln>
          </>
        ) : null}
      </Term>

      <form
        onSubmit={(event) => {
          event.preventDefault();
          void send(input);
        }}
        style={{ display: "flex", gap: 8 }}
      >
        <input
          className="field field-mono"
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder="e.g. earn yield on 50 BOT with low risk for 30 days"
          disabled={!isConnected || busy}
          aria-label="Describe your intent"
        />
        <button type="submit" className="btn" disabled={!isConnected || busy || !input.trim()}>
          {busy ? "Analysing…" : "Send"}
        </button>
      </form>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        {SUGGESTIONS.map((suggestion) => (
          <button
            key={suggestion}
            type="button"
            className="pill"
            style={{ cursor: "pointer" }}
            disabled={!isConnected || busy}
            onClick={() => void send(suggestion)}
          >
            <span className="dot dot-faint" />
            {suggestion}
          </button>
        ))}
      </div>
    </div>
  );
}

function EntryView({ entry }: { entry: Entry }) {
  if (entry.kind === "note") {
    return (
      <Ln who="">
        <span className="dim">{entry.text}</span>
      </Ln>
    );
  }

  if (entry.kind === "you") {
    return (
      <>
        <Sp />
        <Ln who="you ›" you>
          {entry.text}
        </Ln>
      </>
    );
  }

  if (entry.kind === "trace") {
    return (
      <>
        {entry.lines.map((line, index) => (
          <Ln who={index === 0 ? "agent ›" : ""} key={index}>
            <span className="dim">{line}</span>
          </Ln>
        ))}
      </>
    );
  }

  if (entry.kind === "error") {
    return (
      <>
        <Ln who="agent ›">
          <span className="warn">⚠ {entry.text}</span>
        </Ln>
      </>
    );
  }

  const { response } = entry;
  const strategy = response.recommended!;
  const simulation = response.simulation!;
  const parsed = response.parsed_intent!;
  // The best thing the agent turned down — shown for the same reason the landing page argues for:
  // a recommendation is only legible next to what it refused.
  const rejected = response.excluded.find((s) => s.projected_apy > strategy.projected_apy);

  return (
    <>
      <Sp />
      <Ln who="agent ›">
        {strategy.name} · <span className="ok">{num(strategy.projected_apy)}% APY</span> · risk{" "}
        {strategy.risk_score}/10
      </Ln>
      <Ln who="">
        <span className="dim">
          {simulation.horizon_days}d projection {simulation.projected_return >= 0 ? "+" : "−"}
          {num(Math.abs(simulation.projected_return), 4)} {parsed.asset} · gas{" "}
          {simulation.gas_cost_bot} BOT · break-even {simulation.break_even_days}d
        </span>
      </Ln>
      {rejected ? (
        <div className="challenge">
          <span className="warn">⚠ {num(rejected.projected_apy)}% was available</span> on{" "}
          {rejected.name} at risk {rejected.risk_score}/10. Excluded: you asked for{" "}
          {parsed.risk_tolerance} risk.
        </div>
      ) : null}
      <Ln who="">
        {!response.threshold_configured ? (
          <span className="warn">
            ⚠ no auto-approve threshold set — every intent needs your signature
          </span>
        ) : response.requires_approval ? (
          <span className="warn">
            ⚠ {num(parsed.amount, 0)} {parsed.asset} is over your{" "}
            {num(response.approval_threshold, 0)} threshold — signature required
          </span>
        ) : (
          <span className="ok">
            ✓ under your {num(response.approval_threshold, 0)} {parsed.asset} threshold —
            auto-approved
          </span>
        )}
      </Ln>
    </>
  );
}
