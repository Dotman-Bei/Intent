import Link from "next/link";

import { Footer } from "@/components/Footer";
import {
  AgentGlyph,
  ArrowRight,
  ChainGlyph,
  ChartGlyph,
  ChatGlyph,
  CodeGlyph,
  ShieldGlyph,
  VaultGlyph,
} from "@/components/Icons";
import { Nav } from "@/components/Nav";
import { Cell, Note, Pill, SectionHead, StatementRows, Steps, TextLink } from "@/components/Primitives";
import { Reveal } from "@/components/Reveal";
import { Rule, Section, Shell } from "@/components/Shell";
import { Challenge, Ln, Sp, Term } from "@/components/Terminal";
import { botChain } from "@/config/chains";
import { CONTRACTS_CONFIGURED } from "@/constants/contracts";

const STACK = [
  { label: "BOT Chain", glyph: <ChainGlyph size={15} /> },
  { label: "LangGraph", glyph: <AgentGlyph size={15} /> },
  { label: "Claude", glyph: <ChatGlyph size={15} /> },
  { label: "Solidity 0.8.24", glyph: <CodeGlyph size={15} /> },
  { label: "Next.js", glyph: <ChartGlyph size={15} /> },
  { label: "wagmi + viem", glyph: <VaultGlyph size={15} /> },
];

const STEPS = [
  {
    title: "It parses, then restates.",
    body: "Your sentence becomes a typed intent — asset, amount, goal, risk band, horizon. The restatement is shown back to you before anything is priced.",
  },
  {
    title: "It ranks what it is allowed to touch.",
    body: "Only strategies whitelisted in StrategyRegistry are considered, filtered to your risk band and ordered by risk-adjusted return, not headline APY.",
  },
  {
    title: "It stops at your threshold.",
    body: "Under your auto-approve ceiling it executes. Over it, the transaction reverts until you sign that exact intent hash in ApprovalGate.",
  },
];

const STATEMENTS = [
  {
    lead: "A whitelist is not a suggestion.",
    body: "IntentVault reads the strategy from StrategyRegistry and reverts if it is inactive. An agent that hallucinates an address cannot route to it, because the address is never taken from the model.",
  },
  {
    lead: "The approval is scoped to one intent.",
    body: "Signing approves a single keccak hash of a single intent — user, strategy, token, amount, horizon — and it expires after 30 minutes. It is not a standing permission.",
  },
  {
    lead: "An intent runs once.",
    body: "Executed hashes are recorded per user. A replayed intent reverts, so a retry in the UI or a duplicate agent call cannot double-deploy your funds.",
  },
  {
    lead: "The vault keeps its own books.",
    body: "Deposits credit a per-user, per-token balance. A withdrawal can only ever pay out that balance, so one user's position is not another user's exit liquidity.",
  },
  {
    lead: "No standing allowance is left behind.",
    body: "Execution approves exactly the amount, calls the protocol, then drops the allowance back to zero in the same transaction.",
  },
];

export default function LandingPage() {
  return (
    <Shell>
      <Reveal />
      <Nav />

      {/* ---------------------------------------------------------------- hero */}
      <section className="in hero">
        <div className="hero-grid">
          <div className="hero-copy rv">
            <Pill>Built on {botChain.name} · AI Native track</Pill>

            <h1>
              Say it once, in English.{" "}
              <span className="b">Approve it before it moves.</span>
            </h1>

            <p className="lead measure-50">
              IntentFlow turns a sentence into a ranked, simulated, whitelisted transaction on BOT
              Chain — then stops at your threshold and waits for your signature.
            </p>

            <div style={{ display: "flex", alignItems: "center", gap: 18, flexWrap: "wrap" }}>
              <Link href="/app" className="btn">
                Open the executor
                <ArrowRight />
              </Link>
              <TextLink href="/docs">Read the docs</TextLink>
            </div>
          </div>

          <div className="rv" style={{ minWidth: 0 }}>
            <Term title="intentflow — session 0x7a3f" className="min-w-[560px]">
              <Ln who="you ›" you>
                I have 50 BOT. Earn yield on it, low risk, next 30 days.
              </Ln>
              <Sp />
              <Ln who="agent ›">
                <span className="dim">parsed</span> goal=yield risk=low horizon=30d amount=50 BOT
              </Ln>
              <Ln who="">
                <span className="dim">read 2 whitelisted strategies from StrategyRegistry</span>
              </Ln>
              <Ln who="">
                <span className="dim">1 inside the low-risk band (scores 1–3)</span>
              </Ln>
              <Sp />
              <Ln who="agent ›">
                BOTSwap Stable Pool · <span className="ok">8.50% APY</span> · risk 3/10
              </Ln>
              <Ln who="">
                <span className="dim">30d projection</span> +0.3446 BOT{" "}
                <span className="dim">· gas 0.0059 BOT · break-even 1d</span>
              </Ln>
              <Sp />
              <Challenge>
                <span className="warn">⚠ 12.40% was available</span> at risk 5/10. Excluded: you
                asked for low risk.
              </Challenge>
              <Sp />
              <Ln who="agent ›">
                <span className="dim">50 BOT is under your 100 BOT threshold —</span>{" "}
                <span className="ok">✓ auto-approved</span>
              </Ln>
              <Ln who="you ›" you>
                execute
              </Ln>
              <Ln who="agent ›">
                <span className="ok">✓ position #0 opened</span>{" "}
                <span className="dim">tx 0x9c2e…41ab</span>
              </Ln>
            </Term>
          </div>
        </div>
      </section>

      {/* --------------------------------------------------------------- stack */}
      <div className="in">
        <div className="strip rv">
          {STACK.map((item) => (
            <span className="strip-item" key={item.label}>
              {item.glyph}
              {item.label}
            </span>
          ))}
        </div>
      </div>

      {/* --------------------------------------------------------- the numbers */}
      <Section>
        <SectionHead
          kicker="The judgement"
          title={
            <>
              A good answer is mostly the ones it threw away.
            </>
          }
          sub="The agent proposes one strategy. What matters is the set it was allowed to choose from, and what it refused."
        />

        <div className="grid3" style={{ marginTop: 30 }}>
          <Cell kicker="Whitelisted venues" value="2">
            Both live on testnet as registry entries. Nothing outside the registry can be routed to,
            whatever the model returns.
          </Cell>
          <Cell kicker="Default threshold" value="100 BOT">
            Above this, execution reverts until you sign the intent hash. Set your own ceiling
            on-chain in ApprovalGate; unset means ask every time.
          </Cell>
          <Cell kicker="Gas per execution" value="295,607">
            Gas units for one executeIntent, measured by{" "}
            <span className="icode">scripts/measure-gas.ts</span>. Priced live from the chain — BOT
            Chain quotes 20–50 gwei, so 0.006–0.015 BOT — and subtracted from every projection
            before you see it.
          </Cell>
        </div>

        <div className="rv" style={{ marginTop: 22 }}>
          <Note>
            <strong>Read the caveat with the number.</strong> APY is what the protocol publishes in
            its registry entry, compounded daily over your stated horizon, minus a haircut derived
            from the venue&apos;s risk score and minus measured gas. It is a projection, not a quote.
          </Note>
        </div>
      </Section>

      <Rule />

      {/* ------------------------------------------------------------------ how */}
      <Section id="how">
        <SectionHead
          kicker="How it works"
          title="Four contracts, one sentence, no surprises."
          sub="The agent orchestrates. The chain decides. Every step below is a node in the LangGraph workflow and a matching guard in Solidity."
        />
        <div style={{ marginTop: 30 }}>
          <Steps items={STEPS} />
        </div>

        {/* product bed — the only gradient in the system */}
        <div className="bed rv">
          <div className="float">
            <span className="tile">
              <ChatGlyph />
            </span>
            <span className="arrow">→</span>
            <span className="tile">
              <AgentGlyph />
            </span>
            <span className="arrow">→</span>
            <span className="tile">
              <ShieldGlyph />
            </span>
            <span className="arrow">→</span>
            <span className="tile dark">
              <ChainGlyph />
            </span>
          </div>

          <div
            style={{
              background: "var(--col)",
              border: "1px solid var(--line)",
              borderRadius: 10,
              overflow: "hidden",
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
              }}
            >
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <span className="kicker">Recommended</span>
                <h3>BOTSwap Stable Pool</h3>
              </div>
              <span className="pill">
                <span className="dot" />
                DEX · risk 3/10
              </span>
            </div>

            <div className="grid3" style={{ border: 0, borderRadius: 0 }}>
              <Cell kicker="Projected APY" value="8.50%" tight />
              <Cell kicker="30-day net" value="+0.3446" tight />
              <Cell kicker="Break-even" value="1 day" tight />
            </div>

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
                Under your 100 BOT threshold — executes on one signature.
              </span>
              <span className="btn btn-sm">Execute strategy</span>
            </div>
          </div>
        </div>
      </Section>

      <Rule />

      {/* ---------------------------------------------------------- guarantees */}
      <Section>
        <SectionHead
          kicker="Proof"
          title="An agent you have to trust is not a feature."
          sub="Every claim here is a contract-level guard with a test behind it, not a prompt instruction."
        />
        <div style={{ marginTop: 24 }}>
          <StatementRows rows={STATEMENTS} />
        </div>
        <div className="rv" style={{ marginTop: 22 }}>
          <TextLink href="/docs#contracts">See the contract that enforces each one</TextLink>
        </div>
      </Section>

      <Rule />

      {/* ------------------------------------------------------------------ cta */}
      <Section>
        <div
          className="rv"
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 16,
            alignItems: "center",
            textAlign: "center",
          }}
        >
          <span className="kicker">Try it</span>
          <h2 className="measure-58">
            Connect a wallet, type a sentence.{" "}
            <span className="b">Nothing moves until you sign.</span>
          </h2>
          <p className="sub measure-50">
            {CONTRACTS_CONFIGURED
              ? `Runs against ${botChain.name}. The test token has an open faucet, so a full deposit → intent → approve → execute → withdraw loop costs nothing but gas.`
              : "This build has no contract addresses configured, so the executor runs in analysis-only mode: the agent parses, ranks and simulates, but there is nothing to sign against yet."}
          </p>
          <div style={{ display: "flex", gap: 18, alignItems: "center", flexWrap: "wrap", justifyContent: "center" }}>
            <Link href="/app" className="btn">
              Open the executor
              <ArrowRight />
            </Link>
            <TextLink href="/docs#quickstart">Run it locally</TextLink>
          </div>
        </div>
      </Section>

      <Footer />
    </Shell>
  );
}
