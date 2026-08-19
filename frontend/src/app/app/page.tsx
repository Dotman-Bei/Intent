"use client";

import { useCallback, useEffect, useState } from "react";
import { useAccount, useSwitchChain } from "wagmi";

import { ConnectWallet } from "@/components/ConnectWallet";
import { Footer } from "@/components/Footer";
import { Nav } from "@/components/Nav";
import { Note, Pill } from "@/components/Primitives";
import { Rule, Section, Shell } from "@/components/Shell";
import { IntentChat } from "@/components/app/IntentChat";
import { PortfolioTracker } from "@/components/app/PortfolioTracker";
import { StrategyCard } from "@/components/app/StrategyCard";
import { VaultPanel } from "@/components/app/VaultPanel";
import { botChain } from "@/config/chains";
import { CONTRACTS_CONFIGURED } from "@/constants/contracts";
import { useOnCorrectChain, useVaultBalances } from "@/hooks/useVault";
import { getHealth, type HealthResponse, type IntentResponse } from "@/lib/api";

export default function ExecutorPage() {
  const { isConnected } = useAccount();
  const onCorrectChain = useOnCorrectChain();
  const { switchChain } = useSwitchChain();

  const [result, setResult] = useState<IntentResponse | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [healthError, setHealthError] = useState(false);

  const { freeBalance, refetch: refetchBalances } = useVaultBalances();

  useEffect(() => {
    getHealth()
      .then(setHealth)
      .catch(() => setHealthError(true));
  }, []);

  const refresh = useCallback(() => {
    setRefreshKey((key) => key + 1);
    void refetchBalances();
  }, [refetchBalances]);

  return (
    <Shell>
      <Nav sticky wallet active="app" />

      <Section small>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-end",
            gap: 20,
            flexWrap: "wrap",
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <span className="kicker">The executor</span>
            <h1 className="measure-58" style={{ fontSize: "clamp(24px, 2.8vw, 30px)" }}>
              Type the outcome. <span className="b">Sign the transaction.</span>
            </h1>
          </div>

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <Pill tone={health?.llm === "claude" ? "gold" : "faint"}>
              {healthError
                ? "agent offline"
                : health
                  ? health.llm === "claude"
                    ? `parser: ${health.model}`
                    : "parser: rule-based"
                  : "checking agent…"}
            </Pill>
            <Pill tone={health?.chain_connected ? "gold" : "faint"}>
              {health?.chain_connected ? "agent RPC live" : "agent RPC offline"}
            </Pill>
          </div>
        </div>
      </Section>

      <Rule />

      {!isConnected ? (
        <Section>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 14,
              alignItems: "flex-start",
              maxWidth: "58ch",
            }}
          >
            <h2>Connect a wallet to begin.</h2>
            <p className="sub">
              IntentFlow never holds your keys. The agent returns a plan; your wallet signs it, on{" "}
              {botChain.name}.
            </p>
            <ConnectWallet />
          </div>
        </Section>
      ) : (
        <>
          {!onCorrectChain ? (
            <Section small>
              <Note>
                <strong>Wrong network.</strong> This app runs on {botChain.name} (chain id{" "}
                {botChain.id}).{" "}
                <button
                  type="button"
                  className="link"
                  onClick={() => switchChain({ chainId: botChain.id })}
                >
                  Switch network →
                </button>
              </Note>
            </Section>
          ) : null}

          {!CONTRACTS_CONFIGURED ? (
            <Section small>
              <Note>
                <strong>Contracts not configured.</strong> Deploy with{" "}
                <span className="icode">npx hardhat run scripts/deploy-testnet.ts</span> and paste
                the printed addresses into <span className="icode">frontend/.env.local</span>. The
                chat still works — execution stays disabled until then.
              </Note>
            </Section>
          ) : null}

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "minmax(0, 1fr) 320px",
              alignItems: "start",
            }}
            className="executor-grid"
          >
            <div className="in" style={{ paddingBlock: 30, minWidth: 0 }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                <IntentChat onResult={setResult} onReset={() => setResult(null)} />
                {result?.recommended ? (
                  <StrategyCard response={result} freeBalance={freeBalance} onExecuted={refresh} />
                ) : null}
              </div>
            </div>

            <aside
              className="in executor-rail"
              style={{
                paddingBlock: 30,
                borderLeft: "1px solid var(--line)",
                position: "sticky",
                top: 58,
              }}
            >
              <VaultPanel onChange={refresh} />
            </aside>
          </div>

          <Rule />

          <Section>
            <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 16 }}>
              <span className="kicker">Portfolio</span>
              <h2>Positions, read back from the vault.</h2>
              <p className="sub measure-58">
                Not a cache of what the agent did — this is <span className="icode">getPositions</span>{" "}
                on {botChain.name}, refreshed every 15 seconds.
              </p>
            </div>
            <PortfolioTracker refreshKey={refreshKey} />
          </Section>
        </>
      )}

      <Footer />

      <style jsx global>{`
        @media (max-width: 980px) {
          .executor-grid {
            grid-template-columns: 1fr !important;
          }
          .executor-rail {
            border-left: 0 !important;
            border-top: 1px solid var(--line);
            position: static !important;
          }
        }
      `}</style>
    </Shell>
  );
}
