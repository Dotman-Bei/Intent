import type { Metadata } from "next";

import { Footer } from "@/components/Footer";
import { Nav } from "@/components/Nav";
import { DataTable, Note } from "@/components/Primitives";
import { Reveal } from "@/components/Reveal";
import { Shell } from "@/components/Shell";
import { CodeBlock } from "@/components/Terminal";
import { botChain } from "@/config/chains";

export const metadata: Metadata = {
  title: "IntentFlow — documentation",
  description: "Set up, deploy and extend the IntentFlow natural-language DeFi executor.",
};

const RAIL = [
  { id: "quickstart", label: "Quickstart" },
  { id: "architecture", label: "Architecture" },
  { id: "contracts", label: "Contracts" },
  { id: "api", label: "Agent API" },
  { id: "flow", label: "Execution flow" },
  { id: "deploy", label: "Deployment" },
  { id: "troubleshooting", label: "Troubleshooting" },
];

const INSTALL = `<i># contracts — compile, test, deploy, export ABIs</i>
cd contracts &amp;&amp; npm install
npx hardhat <b>test</b>
npx hardhat run scripts/deploy-testnet.ts --network <u>botTestnet</u>
npx hardhat run scripts/export-abi.ts

<i># backend — FastAPI + LangGraph agent</i>
cd ../backend
python -m venv venv &amp;&amp; venv/Scripts/activate   <i># source venv/bin/activate on macOS/Linux</i>
pip install -r requirements.txt
cp .env.example .env                          <i># paste the printed addresses</i>
uvicorn app.main:app --reload

<i># frontend — Next.js app</i>
cd ../frontend
npm install
cp .env.example .env.local                    <i># paste the printed addresses</i>
npm run dev                                   <b># http://localhost:3000</b>`;

const INTENT_CALL = `curl -s http://localhost:8000/intent \\
  -H <u>'Content-Type: application/json'</u> \\
  -d '{"user_input":"earn yield on 50 BOT with low risk","user_address":"0x70997970C51812dc3A010C7d01b50e0d17dc79C8"}'

<i># -&gt; recommended, simulation, requires_approval, execution_plan, trace[]</i>
<b>{"ok": true, "recommended": {"name": "BOTSwap Stable Pool", "projected_apy": 8.5, ...}}</b>`;

const EXECUTE_SNIPPET = `<i>// the frontend signs the plan the agent returned — no backend key involved</i>
writeContract({
  address: <u>INTENT_VAULT_ADDRESS</u>,
  abi: INTENT_VAULT_ABI,
  functionName: <b>'executeIntent'</b>,
  args: [
    address,              <i>// user</i>
    plan.intent_hash,     <i>// bytes32, computed once in the backend</i>
    BigInt(strategy_id),  <i>// index into StrategyRegistry</i>
    plan.token_address,
    BigInt(plan.amount_wei),
    plan.strategy_data,   <i>// calldata for the whitelisted protocol</i>
  ],
});`;

export default function DocsPage() {
  return (
    <Shell docs>
      <Reveal />
      <Nav sticky active="docs" />

      <div className="in" style={{ paddingBlock: "34px 26px" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <span className="kicker kicker-mono">Documentation</span>
          <h1 className="measure-62">
            Everything is on-chain or in one file.{" "}
            <span className="b">Nothing important lives in the agent&apos;s memory.</span>
          </h1>
          <p className="sub measure-62">
            IntentFlow is three deployables: Solidity contracts on {botChain.name}, a FastAPI +
            LangGraph agent, and this Next.js app. They share exactly two things — an ABI export and
            an intent hash.
          </p>
        </div>
      </div>

      <hr className="rule" />

      <div className="layout">
        <div className="rail">
          <span className="kicker kicker-mono">Contents</span>
          <nav>
            {RAIL.map((item) => (
              <a key={item.id} href={`#${item.id}`}>
                {item.label}
              </a>
            ))}
          </nav>
        </div>

        <div className="doc">
          {/* ------------------------------------------------- quickstart */}
          <section id="quickstart">
            <h2>Quickstart</h2>
            <p className="sub" style={{ marginTop: 10 }}>
              Three terminals, in this order. The ABI export is what keeps the backend and frontend
              in step with the contracts — run it after every recompile.
            </p>
            <div style={{ marginTop: 16 }}>
              <CodeBlock title="setup" code={INSTALL} />
            </div>
            <div style={{ marginTop: 16 }}>
              <Note>
                <strong>No API key?</strong> The agent falls back to a deterministic rule-based
                parser and a static strategy catalog, and labels itself{" "}
                <span className="icode">rule-based</span> in the UI. The whole flow — including
                execution — still runs.
              </Note>
            </div>
          </section>

          {/* ------------------------------------------------ architecture */}
          <section id="architecture">
            <h2>Architecture</h2>
            <p className="sub" style={{ marginTop: 10 }}>
              The agent orchestrates and advises. It never holds custody, and it cannot widen its own
              permissions: the set of reachable protocols is a registry the agent can only read.
            </p>
            <div style={{ marginTop: 16 }}>
              <DataTable
                head={["Layer", "What it does"]}
                rows={[
                  ["frontend/", "Next.js 14 app: chat, strategy card, vault panel, portfolio. Signs every transaction with the user's wallet via wagmi + viem."],
                  ["backend/", "FastAPI + LangGraph. Five nodes: parse → strategize → simulate → gate → plan. Returns an execution plan, not a signature."],
                  ["contracts/", "IntentVault (custody + execution), StrategyRegistry (whitelist), ApprovalGate (human-in-the-loop), plus mock venues for testnet."],
                  ["abi export", "One script writes JSON for web3.py and typed consts for viem, so all three layers agree on the interface."],
                ]}
              />
            </div>
          </section>

          {/* --------------------------------------------------- contracts */}
          <section id="contracts">
            <h2>Contracts</h2>
            <p className="sub" style={{ marginTop: 10 }}>
              Each guarantee on the landing page maps to one guard here, and each guard has a test in{" "}
              <span className="icode">contracts/test/intentflow.test.ts</span>.
            </p>
            <div style={{ marginTop: 16 }}>
              <DataTable
                head={["Function", "Guarantee"]}
                rows={[
                  ["executeIntent", "Reverts on a replayed intent hash, an inactive strategy, an amount over the free balance, or a caller that is neither the agent nor the position owner."],
                  ["closePosition", "Pulls the position back out of its protocol and credits principal plus whatever yield the venue actually paid."],
                  ["withdraw", "Only ever pays out the caller's own idle balance."],
                  ["approveIntent", "The human-in-the-loop step: signs one intent hash, valid for 30 minutes."],
                  ["setConfig", "Sets your auto-approve ceiling. Unset means every intent asks."],
                  ["addStrategy", "Owner-only. The agent cannot add a venue, only read the list."],
                ]}
              />
            </div>
            <div style={{ marginTop: 16 }}>
              <Note>
                <strong>Deviation from the build guide.</strong> The guide has the frontend calling{" "}
                <span className="icode">executeIntent</span> while the function is{" "}
                <span className="icode">onlyAgent</span> — those cannot both hold. Execution here
                accepts the agent EOA <em>or</em> the position owner, so the default deployment needs
                no funded backend key.
              </Note>
            </div>
          </section>

          {/* --------------------------------------------------------- api */}
          <section id="api">
            <h2>Agent API</h2>
            <div style={{ marginTop: 16 }}>
              <DataTable
                head={["Endpoint", "Purpose"]}
                rows={[
                  ["POST /intent", "Natural language in; parsed intent, ranked strategies, simulation, approval verdict and an execution plan out."],
                  ["GET /strategies", "The whitelist as the agent sees it, with source: chain or catalog."],
                  ["GET /portfolio/{address}", "Positions and balances read from the vault."],
                  ["POST /execute", "Optional agent-side broadcast. Disabled unless AGENT_PRIVATE_KEY is set."],
                  ["GET /health", "Which parser and which chain connection are actually live."],
                ]}
              />
            </div>
            <div style={{ marginTop: 16 }}>
              <CodeBlock title="POST /intent" code={INTENT_CALL} />
            </div>
          </section>

          {/* -------------------------------------------------------- flow */}
          <section id="flow">
            <h2>Execution flow</h2>
            <p className="sub" style={{ marginTop: 10 }}>
              The intent hash is computed in exactly one place — the backend&apos;s{" "}
              <span className="icode">build_plan</span> node — and travels unchanged through the
              approval signature, the vault&apos;s replay guard and the position record.
            </p>
            <div style={{ marginTop: 16 }}>
              <CodeBlock title="frontend/src/components/app/StrategyCard.tsx" code={EXECUTE_SNIPPET} />
            </div>
            <div style={{ marginTop: 16 }}>
              <DataTable
                head={["Step", "Where it happens"]}
                rows={[
                  ["1. Deposit", "ERC20 approve for the exact amount, then IntentVault.deposit."],
                  ["2. Intent", "POST /intent — the agent parses, ranks, simulates and gates."],
                  ["3. Approve", "Only if over your threshold: ApprovalGate.approveIntent(hash)."],
                  ["4. Execute", "IntentVault.executeIntent — whitelist check, replay check, balance check, then the protocol call."],
                  ["5. Track", "IntentVault.getPositions, polled by the portfolio view."],
                  ["6. Exit", "closePosition returns principal plus yield to your idle balance; withdraw sends it home."],
                ]}
              />
            </div>
          </section>

          {/* ------------------------------------------------------ deploy */}
          <section id="deploy">
            <h2>Deployment</h2>
            <p className="sub" style={{ marginTop: 10 }}>
              Testnet first — the mainnet script refuses to run without a real agent EOA and at least
              one real venue in <span className="icode">MAINNET_STRATEGIES</span>, because a vault
              with no whitelisted protocol is a vault that can only take deposits.
            </p>
            <div style={{ marginTop: 16 }}>
              <DataTable
                head={["Variable", "Where"]}
                rows={[
                  ["PRIVATE_KEY", "contracts/.env — deployer only."],
                  ["AGENT_ADDRESS", "contracts/.env — the EOA allowed to execute on behalf of users."],
                  ["MAINNET_STRATEGIES", "contracts/.env — JSON array of real protocol addresses."],
                  ["ANTHROPIC_API_KEY", "backend/.env — omit to run rule-based."],
                  ["NEXT_PUBLIC_INTENT_VAULT", "frontend/.env.local — printed by the deploy script."],
                  ["NEXT_PUBLIC_AGENT_API", "frontend/.env.local — the FastAPI origin."],
                ]}
              />
            </div>
          </section>

          {/* --------------------------------------------- troubleshooting */}
          <section id="troubleshooting">
            <h2>Troubleshooting</h2>
            <div style={{ marginTop: 16 }}>
              <DataTable
                head={["Symptom", "Cause and fix"]}
                rows={[
                  ["ApprovalRequired", "The amount is over your threshold and the hash is unsigned. Approve the intent, or raise the ceiling in the vault panel."],
                  ["IntentAlreadyExecuted", "That exact hash already ran. Send the intent again — a fresh hash is issued per request."],
                  ["InsufficientBalance", "The vault holds less than the intent needs. Deposit the difference first."],
                  ["NotAuthorized", "Execution was attempted by neither the agent EOA nor the position owner."],
                  ["agent offline badge", "The FastAPI server is not reachable at NEXT_PUBLIC_AGENT_API, or CORS_ORIGINS does not include the frontend origin."],
                  ["Nonce too high", "MetaMask against a restarted local node: Settings → Advanced → Clear activity tab data."],
                ]}
              />
            </div>
          </section>
        </div>
      </div>

      <Footer />
    </Shell>
  );
}
