# IntentFlow

**Natural language DeFi executor on BOT Chain.** Type what you want in plain English; the agent
parses it, ranks the strategies it is *allowed* to touch, simulates the outcome, and stops at your
approval threshold until you sign.

```
you   › I have 50 BOT. Earn yield on it, low risk, next 30 days.
agent › parsed goal=yield risk=low horizon=30d amount=50 BOT
        read 2 whitelisted strategies from StrategyRegistry
        1 inside the low-risk band (scores 1–3)
agent › BOTSwap Stable Pool · 8.50% APY · risk 3/10
        30d projection +0.3446 BOT · gas 0.0059 BOT · break-even 1d
        ⚠ 12.40% was available at risk 5/10. Excluded: you asked for low risk.
agent › ✓ position #0 opened  tx 0x9c2e…41ab
```

---

## What is in here

| Directory | Stack | Role |
|---|---|---|
| `contracts/` | Solidity 0.8.24, Hardhat | `IntentVault`, `StrategyRegistry`, `ApprovalGate`, mock venues |
| `backend/` | Python 3.11+, FastAPI, LangGraph, Anthropic SDK | The agent: parse → strategize → simulate → gate → plan |
| `frontend/` | Next.js 14, wagmi 2, viem 2, RainbowKit | Landing page, executor app, docs |

The three layers share exactly two things: an ABI export, and an intent hash.

## Design principles

- **The agent proposes; the chain decides.** Every strategy must exist in `StrategyRegistry` and be
  active. A hallucinated address is unreachable because the address never comes from the model.
- **The backend holds no keys by default.** `/intent` returns an execution *plan*; the user's wallet
  signs it. Agent-side broadcast exists but stays off unless `AGENT_PRIVATE_KEY` is set.
- **Approval is scoped and expiring.** Signing approves one keccak intent hash for 30 minutes, not a
  standing permission — and an unconfigured user is asked every time.
- **It degrades honestly.** No API key → deterministic rule-based parser, labelled as such in the UI.
  No RPC → static catalog, labelled `source: catalog`. It never presents a fallback as live data.
  Caveats stay attached to the numbers themselves — the strategy card states its compounding
  assumption, its risk haircut and its worst case inline.

---

## Quickstart

Three terminals. Run them in this order.

### 1. Contracts

```bash
cd contracts
npm install
npx hardhat test                 # 19 tests
npx hardhat node                 # leave running (or target BOT Chain testnet instead)
```

In a second shell:

```bash
cd contracts
npx hardhat run scripts/deploy-testnet.ts --network localhost
npx hardhat run scripts/export-abi.ts    # writes backend/abi + frontend/src/constants/abi
```

The deploy script prints ready-to-paste blocks for `backend/.env` and `frontend/.env.local`.

### 2. Backend

```bash
cd backend
python -m venv venv
venv/Scripts/activate            # macOS/Linux: source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env             # paste the printed addresses; ANTHROPIC_API_KEY is optional
uvicorn app.main:app --reload    # http://localhost:8000
python -m pytest tests -q        # 21 tests, fully offline
```

### 3. Frontend

```bash
cd frontend
npm install
cp .env.example .env.local       # paste the printed addresses
npm run dev                      # http://localhost:3000
```

Open `/app`, connect MetaMask, hit the faucet, deposit, and type an intent.

---

## BOT Chain network parameters

From the [official developer docs](https://dev-docs.botchain.ai/docs/Developers/quick-guide/),
verified live on 2026-08-19. **The testnet lives on `bohr.life`, not `botchain.ai`** — which is why
every `*-rpc.botchain.ai` hostname fails to resolve.

| | Testnet | Mainnet |
|---|---|---|
| Chain ID | `968` | `677` |
| RPC | `https://rpc.bohr.life` | `https://rpc.botchain.ai` |
| Explorer | `https://scan.bohr.life` | `https://scan.botchain.ai` |
| Native token | BOT | BOT |
| Gas price observed | 20 gwei | 20–50 gwei |
| `eth_feeHistory` | supported | supported |
| Get tokens | [faucet](https://faucet.botchain.ai/basic/) | [B DEX](https://dex.botchain.ai/) |

Both endpoints implement `eth_feeHistory`, so viem's EIP-1559 fee estimation works with no
legacy-gas workaround. These values are already wired into every `.env.example`.

### Measured cost

`npx hardhat run scripts/measure-gas.ts` prices the whole journey against the real bytecode:

| Step | Gas | At 50 gwei |
|---|---|---|
| ERC20 approve | 46,371 | 0.0023 BOT |
| vault deposit | 82,454 | 0.0041 BOT |
| approveIntent (HITL) | 45,969 | 0.0023 BOT |
| executeIntent | 295,607 | 0.0148 BOT |
| closePosition | 154,508 | 0.0077 BOT |
| withdraw | 47,524 | 0.0024 BOT |
| **full journey** | **672,433** | **0.0336 BOT** |

Deploying the three mainnet contracts costs **2,800,920 gas (~0.14 BOT at 50 gwei)**, plus ~184,494
gas per `addStrategy`. The Challenge's 1 BOT gas grant covers that roughly seven times over.

The agent does not hardcode any of this: it multiplies the measured gas units by the chain's live
`eth_gasPrice`, and only falls back to a constant when the RPC is unreachable.

### Deploying

```bash
# testnet — rehearsal
npx hardhat run scripts/deploy-testnet.ts --network botTestnet

# mainnet — required for Builder Challenge judging
npx hardhat run scripts/deploy-mainnet.ts --network botMainnet
```

Both need `PRIVATE_KEY` and `AGENT_ADDRESS` in `contracts/.env`; mainnet additionally refuses to run
without real venue addresses in `MAINNET_STRATEGIES`.

## Live on BOT Chain testnet

Deployed and verified on chain 968, 2026-08-19. Every contract is source-verified on
BOTScan, and the executor has completed a real intent → approve → execute cycle on the public chain.

| Contract | Address |
|---|---|
| IntentVault | [`0xA81892804776bF57e7CD9b2B1F93a317287B3656`](https://scan.bohr.life/address/0xA81892804776bF57e7CD9b2B1F93a317287B3656#code) |
| StrategyRegistry | [`0x657577C94BF8f6c9eDB2aF657775292a763A8d2e`](https://scan.bohr.life/address/0x657577C94BF8f6c9eDB2aF657775292a763A8d2e#code) |
| ApprovalGate | [`0xc90e6Fc2Fc04150D9826FFdB0c6F5c047D909106`](https://scan.bohr.life/address/0xc90e6Fc2Fc04150D9826FFdB0c6F5c047D909106#code) |
| MockDEX (venue 0) | [`0x799d861971c7F73CA1a43465321Bc9B4E9D7f20c`](https://scan.bohr.life/address/0x799d861971c7F73CA1a43465321Bc9B4E9D7f20c#code) |
| MockLendingPool (venue 1) | [`0xeE281Cba108BBa981ADD72E5af592B13C892f4C0`](https://scan.bohr.life/address/0xeE281Cba108BBa981ADD72E5af592B13C892f4C0#code) |
| Test token (faucet) | [`0x765ed84c136de5503514f571675B69375cd7897D`](https://scan.bohr.life/address/0x765ed84c136de5503514f571675B69375cd7897D#code) |

First live execution — 50 wBOT into BOTSwap Stable Pool, block 20,460,519:
[`0x44f670…ff39`](https://scan.bohr.life/tx/0x44f670682e835357ebbf7cd01e7dbeb0a2c21d5877d433a9ecf48f533fceff39)

`npx hardhat run scripts/show-deployment.ts --network botTestnet` prints this live from chain state.

Two things the real chain caught that a local node could not:

- **BOT Chain is Proof-of-Authority.** Its block headers carry a 277-byte `extraData` where web3.py
  expects 32, so every block read raised and the portfolio reported "unavailable" against a chain
  that was answering fine. Fixed with `ExtraDataToPOAMiddleware`.
- **Measured gas held.** `executeIntent` cost 295,619 gas on testnet against 295,607 measured
  locally — a 12-unit difference, so the projection maths needs no adjustment.

## Hosting

`vercel.json` deploys both services as one Vercel project: the Next.js app at `/`, the Python agent
behind `/api/backend`. Same origin, so there is no CORS to configure and the frontend calls the
agent with a relative URL.

The backend service pins `"entrypoint": "app.main:app"` — for the Python runtime Vercel expects a
module spec, not a file path, and refuses the build without one once it detects FastAPI.

The agent mounts its routes twice — at the root and again under `API_PREFIX` — so it answers
whether the proxy in front of it preserves the path prefix or strips it. Vercel forwards the full
path to the service, so the prefixed mount is the one that serves production, while the root mount
keeps `uvicorn app.main:app` working unchanged for local development.

### Vercel environment variables

Set on the project; the frontend build inlines the `NEXT_PUBLIC_*` ones.

```
NEXT_PUBLIC_CHAIN_ID=968
NEXT_PUBLIC_CHAIN_NAME=BOT Chain Testnet
NEXT_PUBLIC_RPC_URL=https://rpc.bohr.life
NEXT_PUBLIC_EXPLORER_URL=https://scan.bohr.life
NEXT_PUBLIC_IS_TESTNET=true
NEXT_PUBLIC_INTENT_VAULT=0xA81892804776bF57e7CD9b2B1F93a317287B3656
NEXT_PUBLIC_STRATEGY_REGISTRY=0x657577C94BF8f6c9eDB2aF657775292a763A8d2e
NEXT_PUBLIC_APPROVAL_GATE=0xc90e6Fc2Fc04150D9826FFdB0c6F5c047D909106
NEXT_PUBLIC_TEST_TOKEN=0x765ed84c136de5503514f571675B69375cd7897D
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=
NEXT_PUBLIC_AGENT_API=/api/backend
API_PREFIX=/api/backend
ANTHROPIC_API_KEY=
ANTHROPIC_MODEL=claude-opus-5
BOT_RPC_URL=https://rpc.bohr.life
CHAIN_ID=968
EXPLORER_URL=https://scan.bohr.life
STRATEGY_REGISTRY_ADDRESS=0x657577C94BF8f6c9eDB2aF657775292a763A8d2e
INTENT_VAULT_ADDRESS=0xA81892804776bF57e7CD9b2B1F93a317287B3656
APPROVAL_GATE_ADDRESS=0xc90e6Fc2Fc04150D9826FFdB0c6F5c047D909106
TEST_TOKEN_ADDRESS=0x765ed84c136de5503514f571675B69375cd7897D
TOKEN_DECIMALS=18
AGENT_PRIVATE_KEY=
DEFAULT_APPROVAL_THRESHOLD=100
```

`ANTHROPIC_API_KEY` is the only secret, and it is read only by the Python service — it has no
`NEXT_PUBLIC_` prefix, so it is never inlined into the browser bundle. `AGENT_PRIVATE_KEY` stays
empty: the agent returns plans and the user's wallet signs them.

Two things that bite: `NEXT_PUBLIC_*` values are inlined at **build** time, so changing one needs a
redeploy rather than a restart; and the agent's dependency set (langgraph, web3, anthropic) is
large, so if the Python service exceeds the function size limit, host it on Render instead using
the `render.yaml` blueprint in the repo root and point `NEXT_PUBLIC_AGENT_API` at that URL with
`CORS_ORIGINS` set to the Vercel domain.

### Separate hosts instead

`render.yaml` (root) and `backend/Procfile` deploy the agent on Render, Railway, Fly or Heroku
unchanged. In that topology drop `API_PREFIX`, set `NEXT_PUBLIC_AGENT_API` to the agent's full URL,
and set `CORS_ORIGINS` on the agent to the Vercel domain — including preview domains, which get
their own hostnames.

For mainnet, swap chain id to `677`, RPC to `https://rpc.botchain.ai`, explorer to
`https://scan.botchain.ai`, `NEXT_PUBLIC_IS_TESTNET` to `false`, and the four addresses to whatever
`deploy-mainnet.ts` prints.

## Builder Challenge #2 submission requirements

The [Challenge rules](https://app.notion.com/p/BOT-Chain-Builder-Challenge-2-3b246f6c38d5803495bac38b8c078690)
are explicit that **testnet-only projects do not enter final judging**. Status against each
eligibility condition:

| Requirement | Status |
|---|---|
| Deployed to BOT Chain **Mainnet** | ❌ not yet — testnet done, mainnet needs funded BOT |
| Publicly verifiable product with a complete business loop | ⚠️ loop is complete and verified on public testnet; needs a public URL |
| Wallet connection + core business flow | ⚠️ built and executing on testnet via a local signer; browser wallet flow still unverified |
| Publicly accessible website or demo | ❌ not deployed (Vercel or similar) |
| GitHub repository | ✅ [Dotman-Bei/Intent](https://github.com/Dotman-Bei/Intent) |
| AI as a core on-chain capability (AI Native track) | ✅ the agent parses, ranks, simulates and gates every execution |

Timeline: submissions close **Aug 22, 23:59 UTC+8**; Demo Day Aug 24; winners Aug 30.

## Verifying the whole pipeline without a browser

`execute-plan.ts` runs a backend-produced plan exactly as the frontend would — same intent hash,
same calldata, same call — which is the fastest way to prove the Python↔Solidity handoff after any
change:

```bash
curl -s localhost:8000/intent -H 'Content-Type: application/json' \
  -d '{"user_input":"earn yield on 50 BOT low risk","user_address":"0x70997970C51812dc3A010C7d01b50e0d17dc79C8"}' \
  | python -c "import json,sys; print(json.dumps(json.load(sys.stdin)['execution_plan']))" > plan.json

cd contracts && PLAN_FILE=../plan.json npx hardhat run scripts/execute-plan.ts --network localhost
```

---

## The agent

Five LangGraph nodes, each a pure `state -> state` function that appends a line to a trace the UI
prints verbatim:

| Node | Does |
|---|---|
| `parse` | Claude with a constrained JSON schema, or the rule-based parser. Rejects non-DeFi input. |
| `strategize` | Reads `StrategyRegistry`, filters to the risk band, ranks by risk-adjusted return. |
| `simulate` | Daily compounding, risk-derived drawdown haircut, measured gas, break-even, worst case. |
| `gate` | Asks `ApprovalGate` — the contract, not a local guess — whether this amount needs a signature. |
| `plan` | Computes the canonical intent hash and the protocol calldata. |

Model: `claude-opus-5` via the Anthropic SDK's structured outputs (`messages.parse`). Set
`ANTHROPIC_MODEL` to change it.

## Deliberate deviations from the build guide

- **Execution is `onlyAgentOrUser`, not `onlyAgent`.** The guide has the frontend calling
  `executeIntent` on a function only the agent may call; those cannot both hold. Accepting the
  position owner too is what lets the default deployment run with no funded backend key.
- **`StrategyRegistry.getStrategy` returns a struct.** A public mapping's generated getter flattens
  the struct into a tuple, which `IntentVault` cannot consume as `Strategy memory`.
- **`ApprovalGate` gained `approveIntent`.** As specified, anything above the threshold could never
  execute — the vault required `!needsApproval`, so there was no path for a human to approve.
- **The vault keeps per-user balances.** The guide's `withdraw` would let any depositor drain the
  contract.
- **OpenZeppelin v5 paths** (`utils/ReentrancyGuard.sol`), and allowances are reset to zero after
  every protocol call.

## Status

| Check | Result |
|---|---|
| `contracts`: `npx hardhat test` | 19 passing |
| `backend`: `python -m pytest tests -q` | 25 passing, offline |
| `frontend`: `npm run build` | compiles, 4 routes prerendered |
| End-to-end on a local node | intent → plan → approve → execute → position → read-back verified |
| End-to-end on BOT Chain testnet | verified — contracts deployed, verified on BOTScan, position open |

Not yet done: **no mainnet deployment and no public demo URL**. Testnet is live and the repo
is public, so what remains is a funded mainnet key and a hosted frontend — both config, not code.
The browser wallet path is built but has only been exercised through a local signer, so it stays
unverified until the app runs on a real domain. Mock venues still stand in for real protocol
adapters — mainnet needs real BOT Chain venue addresses (B DEX is the obvious first integration).

MIT licensed.
