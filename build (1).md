# IntentFlow — Build Guide
## Natural Language DeFi Executor on BOT Chain

---

## 1. Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              FRONTEND LAYER                                  │
│  Next.js 14 (App Router) + Wagmi + Viem + RainbowKit                        │
│  ├─ Natural Language Chat Interface                                         │
│  ├─ Strategy Simulation Cards (APY, Risk, Gas)                             │
│  ├─ Transaction Approval UI                                                │
│  └─ Portfolio Tracker (Real-time positions)                                  │
└──────────────────────────────────┬──────────────────────────────────────────┘
                                   │
                                   ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           AI AGENT BACKEND                                   │
│  Python + LangGraph + OpenAI / Claude API                                   │
│  ├─ Intent Parser Node      → NL → structured DeFi intent (asset, amount,  │
│  │                             risk, goal, time horizon)                   │
│  ├─ Strategy Engine Node    → Query on-chain protocols, rank strategies    │
│  ├─ Simulator Node          → Project ROI, impermanent loss, gas cost      │
│  ├─ Human-in-the-Loop Gate  → Approval required above user threshold         │
│  └─ Execution Node          → Sign and broadcast tx via connected wallet     │
└──────────────────────────────────┬──────────────────────────────────────────┘
                                   │
                                   ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         SMART CONTRACT LAYER                                 │
│  Solidity + Hardhat/Foundry                                                  │
│  ├─ IntentVault.sol         → Holds user funds, executes batched strategies │
│  ├─ StrategyRegistry.sol    → Whitelist + metadata for integrated protocols │
│  ├─ ApprovalGate.sol        → Human-in-the-loop threshold + timelock logic  │
│  └─ MockDEX.sol / MockPool.sol → For testnet simulation                     │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Tech Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **Frontend** | Next.js 14, TailwindCSS, shadcn/ui | UI, chat, dashboards |
| **Web3 Client** | Wagmi 2.x, Viem 2.x, RainbowKit | Wallet connection, contract reads/writes |
| **Backend** | Python 3.11, FastAPI | API layer between frontend and AI agent |
| **AI Framework** | LangGraph + OpenAI GPT-4o / Claude 3.5 Sonnet | Agent orchestration |
| **Blockchain** | Solidity 0.8.24, Hardhat | Smart contract development |
| **Network** | BOT Chain Testnet → BOT Chain Mainnet | Deployment target |
| **Indexing** | The Graph or direct RPC calls | On-chain data queries |

---

## 3. Prerequisites

### 3.1 Accounts & Keys
- **BOT Chain Testnet RPC** — get from [BOT Chain docs](https://www.botchain.ai/en) or Builder Hub
- **BOT Chain Mainnet RPC** — for final deployment
- **OpenAI API Key** or **Anthropic API Key**
- **Etherscan/BOT Chain Explorer API Key** — for contract verification

### 3.2 Wallets
- MetaMask with BOT Chain Testnet configured
- At least 2 testnet BOT addresses (one for deployer, one for user testing)
- Apply for **Mainnet Gas Support** (1 BOT) via [this form](https://forms.gle/QGWNnmthCDgL92uR9) *after* testnet validation

### 3.3 Local Environment
```bash
# Node.js 20+, Python 3.11+, Git
node -v  # >= 20.0.0
python3 --version  # >= 3.11.0
```

---

## 4. Project Scaffolding

```bash
mkdir intentflow && cd intentflow

# Frontend
npx create-next-app@latest frontend --typescript --tailwind --eslint --app --src-dir
cd frontend && npm install wagmi viem @rainbow-me/rainbowkit @tanstack/react-query

# Backend
cd ..
mkdir backend && cd backend
python3 -m venv venv && source venv/bin/activate
pip install fastapi uvicorn langgraph langchain-openai python-dotenv pydantic web3

# Contracts
cd ..
mkdir contracts && cd contracts
npm init -y
npm install --save-dev hardhat @nomicfoundation/hardhat-toolbox dotenv
npx hardhat init  # Choose "Create a TypeScript project"
```

---

## 5. Smart Contracts (Testnet Phase)

### 5.1 Environment Setup
Create `contracts/.env`:
```env
BOT_TESTNET_RPC=https://testnet-rpc.botchain.ai
BOT_MAINNET_RPC=https://mainnet-rpc.botchain.ai
PRIVATE_KEY=0xYOUR_DEPLOYER_PRIVATE_KEY
BOTSCAN_API_KEY=your_api_key
```

Update `contracts/hardhat.config.ts`:
```typescript
import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import * as dotenv from "dotenv";
dotenv.config();

const config: HardhatUserConfig = {
  solidity: "0.8.24",
  networks: {
    botTestnet: {
      url: process.env.BOT_TESTNET_RPC || "",
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
    },
    botMainnet: {
      url: process.env.BOT_MAINNET_RPC || "",
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
    },
  },
  etherscan: {
    apiKey: {
      botTestnet: process.env.BOTSCAN_API_KEY || "",
      botMainnet: process.env.BOTSCAN_API_KEY || "",
    },
    customChains: [
      {
        network: "botTestnet",
        chainId: 12345, // Replace with actual BOT Chain testnet chainId
        urls: {
          apiURL: "https://testnet-explorer.botchain.ai/api",
          browserURL: "https://testnet-explorer.botchain.ai",
        },
      },
      {
        network: "botMainnet",
        chainId: 12346, // Replace with actual BOT Chain mainnet chainId
        urls: {
          apiURL: "https://explorer.botchain.ai/api",
          browserURL: "https://explorer.botchain.ai",
        },
      },
    ],
  },
};

export default config;
```

### 5.2 StrategyRegistry.sol
Manages whitelisted protocols and their metadata.

```solidity
// contracts/contracts/StrategyRegistry.sol
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract StrategyRegistry {
    struct Strategy {
        address protocol;
        string name;
        string protocolType; // "DEX", "Lending", "Staking"
        uint256 riskScore;   // 1-10, 1 = lowest
        bool active;
    }

    mapping(uint256 => Strategy) public strategies;
    mapping(address => bool) public authorizedUpdaters;
    uint256 public strategyCount;
    address public owner;

    event StrategyAdded(uint256 indexed id, address protocol, string name);
    event StrategyUpdated(uint256 indexed id, bool active);

    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }

    constructor() {
        owner = msg.sender;
        authorizedUpdaters[msg.sender] = true;
    }

    function addStrategy(
        address _protocol,
        string calldata _name,
        string calldata _protocolType,
        uint256 _riskScore
    ) external onlyOwner returns (uint256) {
        uint256 id = strategyCount++;
        strategies[id] = Strategy({
            protocol: _protocol,
            name: _name,
            protocolType: _protocolType,
            riskScore: _riskScore,
            active: true
        });
        emit StrategyAdded(id, _protocol, _name);
        return id;
    }

    function setStrategyActive(uint256 _id, bool _active) external onlyOwner {
        strategies[_id].active = _active;
        emit StrategyUpdated(_id, _active);
    }

    function getActiveStrategies() external view returns (Strategy[] memory) {
        uint256 activeCount = 0;
        for (uint256 i = 0; i < strategyCount; i++) {
            if (strategies[i].active) activeCount++;
        }

        Strategy[] memory active = new Strategy[](activeCount);
        uint256 idx = 0;
        for (uint256 i = 0; i < strategyCount; i++) {
            if (strategies[i].active) {
                active[idx++] = strategies[i];
            }
        }
        return active;
    }
}
```

### 5.3 ApprovalGate.sol
Human-in-the-loop logic with configurable thresholds.

```solidity
// contracts/contracts/ApprovalGate.sol
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract ApprovalGate {
    struct UserConfig {
        uint256 autoApproveThreshold; // in wei, 0 = always require approval
        bool enabled;
    }

    mapping(address => UserConfig) public userConfigs;

    event ConfigUpdated(address indexed user, uint256 threshold);
    event ApprovalRequested(address indexed user, bytes32 indexed intentHash, uint256 amount);

    function setConfig(uint256 _threshold) external {
        userConfigs[msg.sender] = UserConfig({
            autoApproveThreshold: _threshold,
            enabled: true
        });
        emit ConfigUpdated(msg.sender, _threshold);
    }

    function requiresApproval(
        address _user,
        uint256 _amount
    ) external view returns (bool) {
        UserConfig memory config = userConfigs[_user];
        if (!config.enabled) return true;
        if (config.autoApproveThreshold == 0) return true;
        return _amount > config.autoApproveThreshold;
    }

    function recordIntent(
        address _user,
        bytes32 _intentHash,
        uint256 _amount
    ) external returns (bool needsApproval) {
        needsApproval = this.requiresApproval(_user, _amount);
        if (needsApproval) {
            emit ApprovalRequested(_user, _intentHash, _amount);
        }
    }
}
```

### 5.4 IntentVault.sol
Core contract holding user funds and executing strategies.

```solidity
// contracts/contracts/IntentVault.sol
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "./StrategyRegistry.sol";
import "./ApprovalGate.sol";

contract IntentVault is ReentrancyGuard {
    using SafeERC20 for IERC20;

    struct Position {
        uint256 strategyId;
        address token;
        uint256 amount;
        uint256 entryTimestamp;
        bool active;
    }

    StrategyRegistry public registry;
    ApprovalGate public approvalGate;
    address public agentExecutor; // AI agent backend wallet

    mapping(address => Position[]) public userPositions;
    mapping(address => mapping(bytes32 => bool)) public executedIntents;

    event Deposit(address indexed user, address token, uint256 amount);
    event StrategyExecuted(
        address indexed user,
        bytes32 indexed intentHash,
        uint256 strategyId,
        uint256 amount
    );
    event Withdrawal(address indexed user, address token, uint256 amount);

    modifier onlyAgent() {
        require(msg.sender == agentExecutor, "Only agent");
        _;
    }

    constructor(address _registry, address _approvalGate, address _agent) {
        registry = StrategyRegistry(_registry);
        approvalGate = ApprovalGate(_approvalGate);
        agentExecutor = _agent;
    }

    function deposit(address _token, uint256 _amount) external nonReentrant {
        require(_amount > 0, "Zero amount");
        IERC20(_token).safeTransferFrom(msg.sender, address(this), _amount);
        emit Deposit(msg.sender, _token, _amount);
    }

    function executeIntent(
        address _user,
        bytes32 _intentHash,
        uint256 _strategyId,
        address _token,
        uint256 _amount,
        bytes calldata _strategyData
    ) external onlyAgent nonReentrant {
        require(!executedIntents[_user][_intentHash], "Intent already executed");

        StrategyRegistry.Strategy memory strategy = registry.strategies(_strategyId);
        require(strategy.active, "Strategy inactive");

        // Check approval gate
        bool needsApproval = approvalGate.recordIntent(_user, _intentHash, _amount);
        require(!needsApproval, "Approval required"); // Frontend handles approval flow separately

        executedIntents[_user][_intentHash] = true;

        // Execute strategy (simplified — in production, use delegatecall or specific adapters)
        IERC20(_token).safeTransfer(strategy.protocol, _amount);

        // Call protocol deposit/enter function via low-level call
        (bool success, ) = strategy.protocol.call(_strategyData);
        require(success, "Strategy execution failed");

        userPositions[_user].push(Position({
            strategyId: _strategyId,
            token: _token,
            amount: _amount,
            entryTimestamp: block.timestamp,
            active: true
        }));

        emit StrategyExecuted(_user, _intentHash, _strategyId, _amount);
    }

    function withdraw(address _token, uint256 _amount) external nonReentrant {
        // Simplified — in production, check position ownership
        IERC20(_token).safeTransfer(msg.sender, _amount);
        emit Withdrawal(msg.sender, _token, _amount);
    }

    function getPositions(address _user) external view returns (Position[] memory) {
        return userPositions[_user];
    }

    function updateAgent(address _newAgent) external {
        // Add proper access control in production
        agentExecutor = _newAgent;
    }
}
```

### 5.5 MockDEX.sol (Testnet Only)
For testing without real protocol dependencies.

```solidity
// contracts/contracts/mocks/MockDEX.sol
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract MockDEX {
    mapping(address => uint256) public deposits;

    function deposit(address _token, uint256 _amount) external {
        IERC20(_token).transferFrom(msg.sender, address(this), _amount);
        deposits[msg.sender] += _amount;
    }

    function getAPY() external pure returns (uint256) {
        return 850; // 8.5% APY in basis points
    }
}
```

### 5.6 Deploy Script (Testnet)
```typescript
// contracts/scripts/deploy-testnet.ts
import { ethers } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying with:", deployer.address);

  // Deploy Registry
  const Registry = await ethers.getContractFactory("StrategyRegistry");
  const registry = await Registry.deploy();
  await registry.waitForDeployment();
  console.log("StrategyRegistry:", await registry.getAddress());

  // Deploy ApprovalGate
  const ApprovalGate = await ethers.getContractFactory("ApprovalGate");
  const approvalGate = await ApprovalGate.deploy();
  await approvalGate.waitForDeployment();
  console.log("ApprovalGate:", await approvalGate.getAddress());

  // Deploy MockDEX
  const MockDEX = await ethers.getContractFactory("MockDEX");
  const mockDEX = await MockDEX.deploy();
  await mockDEX.waitForDeployment();
  console.log("MockDEX:", await mockDEX.getAddress());

  // Add strategy to registry
  await (await registry.addStrategy(
    await mockDEX.getAddress(),
    "Mock DEX Pool A",
    "DEX",
    3 // low risk
  )).wait();

  // Deploy IntentVault
  const agentWallet = deployer.address; // Use deployer as agent for testing
  const IntentVault = await ethers.getContractFactory("IntentVault");
  const vault = await IntentVault.deploy(
    await registry.getAddress(),
    await approvalGate.getAddress(),
    agentWallet
  );
  await vault.waitForDeployment();
  console.log("IntentVault:", await vault.getAddress());

  // Verify contracts
  console.log("Run verification commands manually or use hardhat-verify");
}

main().catch(console.error);
```

Deploy:
```bash
cd contracts
npx hardhat run scripts/deploy-testnet.ts --network botTestnet
```

---

## 6. AI Agent Backend

### 6.1 Project Structure
```
backend/
├── app/
│   ├── __init__.py
│   ├── main.py          # FastAPI entry
│   ├── agent/
│   │   ├── __init__.py
│   │   ├── graph.py     # LangGraph workflow
│   │   ├── nodes.py     # Individual agent nodes
│   │   └── state.py     # Shared state schema
│   ├── services/
│   │   ├── __init__.py
│   │   ├── blockchain.py # On-chain queries
│   │   └── simulator.py  # Strategy simulation
│   └── models/
│       └── schemas.py
├── .env
└── requirements.txt
```

### 6.2 State Schema
```python
# backend/app/agent/state.py
from typing import TypedDict, Optional, List
from pydantic import BaseModel

class StrategyOption(BaseModel):
    strategy_id: int
    protocol: str
    name: str
    projected_apy: float
    risk_score: int
    gas_estimate: float
    token: str

class IntentFlowState(TypedDict):
    user_input: str
    parsed_intent: Optional[dict]
    strategies: List[StrategyOption]
    selected_strategy: Optional[StrategyOption]
    simulation_result: Optional[dict]
    requires_approval: bool
    tx_hash: Optional[str]
    error: Optional[str]
```

### 6.3 Intent Parser Node
```python
# backend/app/agent/nodes.py
from langchain_openai import ChatOpenAI
from langchain_core.messages import SystemMessage, HumanMessage
import json

llm = ChatOpenAI(model="gpt-4o", temperature=0)

INTENT_PARSER_PROMPT = """You are an intent parser for a DeFi executor.
Parse the user's natural language request into structured JSON:
{
  "asset": "token symbol or address",
  "amount": number,
  "goal": "yield|swap|stake|borrow",
  "risk_tolerance": "low|medium|high",
  "time_horizon": "short|medium|long",
  "constraints": ["low_gas", "blue_chip", etc]
}

User request: {input}

Respond ONLY with valid JSON."""

def parse_intent(state: IntentFlowState) -> IntentFlowState:
    messages = [
        SystemMessage(content=INTENT_PARSER_PROMPT),
        HumanMessage(content=state["user_input"])
    ]
    response = llm.invoke(messages)
    try:
        parsed = json.loads(response.content)
        state["parsed_intent"] = parsed
    except json.JSONDecodeError:
        state["error"] = "Failed to parse intent"
    return state
```

### 6.4 Strategy Engine Node
```python
# backend/app/agent/nodes.py
from web3 import Web3

RPC_URL = "https://testnet-rpc.botchain.ai"
w3 = Web3(Web3.HTTPProvider(RPC_URL))

REGISTRY_ABI = [...] # ABI from StrategyRegistry compilation
REGISTRY_ADDRESS = "0x..." # Deployed testnet address

def fetch_strategies(state: IntentFlowState) -> IntentFlowState:
    if state.get("error"):
        return state

    registry = w3.eth.contract(address=REGISTRY_ADDRESS, abi=REGISTRY_ABI)
    active = registry.functions.getActiveStrategies().call()

    parsed = state["parsed_intent"]
    risk_map = {"low": [1,2,3], "medium": [4,5,6], "high": [7,8,9,10]}
    allowed_risk = risk_map.get(parsed["risk_tolerance"], [1,2,3])

    strategies = []
    for s in active:
        if s[3] in allowed_risk:  # riskScore
            # Query protocol for live APY (mock for testnet)
            strategies.append(StrategyOption(
                strategy_id=...,  # index
                protocol=s[0],
                name=s[1],
                projected_apy=8.5,  # From MockDEX.getAPY() call
                risk_score=s[3],
                gas_estimate=0.001,  # BOT tokens
                token=parsed["asset"]
            ))

    state["strategies"] = strategies
    return state
```

### 6.5 Simulator Node
```python
# backend/app/services/simulator.py
def simulate_strategy(strategy: StrategyOption, amount: float, days: int = 30):
    apy_daily = strategy.projected_apy / 36500
    projected_return = amount * ((1 + apy_daily) ** days - 1)
    impermanent_loss = 0.0 if strategy.risk_score <= 3 else 0.02

    return {
        "projected_return": round(projected_return, 6),
        "impermanent_loss_risk": impermanent_loss,
        "gas_cost_bot": strategy.gas_estimate,
        "net_apr": strategy.projected_apy * (1 - impermanent_loss),
        "break_even_days": max(1, int(strategy.gas_estimate / (projected_return / days))) if projected_return > 0 else 999
    }

def simulate_node(state: IntentFlowState) -> IntentFlowState:
    if state.get("error") or not state["strategies"]:
        return state

    # Pick best strategy based on risk-adjusted return
    best = max(state["strategies"], 
               key=lambda s: s.projected_apy / max(s.risk_score, 1))

    sim = simulate_strategy(best, state["parsed_intent"]["amount"], days=30)
    state["selected_strategy"] = best
    state["simulation_result"] = sim

    # Check approval threshold
    threshold = 100  # Default 100 BOT
    if state["parsed_intent"]["amount"] > threshold:
        state["requires_approval"] = True

    return state
```

### 6.6 LangGraph Orchestration
```python
# backend/app/agent/graph.py
from langgraph.graph import StateGraph, END
from .state import IntentFlowState
from .nodes import parse_intent, fetch_strategies, simulate_node

def create_workflow():
    workflow = StateGraph(IntentFlowState)

    workflow.add_node("parse", parse_intent)
    workflow.add_node("strategize", fetch_strategies)
    workflow.add_node("simulate", simulate_node)

    workflow.set_entry_point("parse")
    workflow.add_edge("parse", "strategize")
    workflow.add_edge("strategize", "simulate")
    workflow.add_edge("simulate", END)

    return workflow.compile()

agent = create_workflow()
```

### 6.7 FastAPI Server
```python
# backend/app/main.py
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from app.agent.graph import agent
from app.agent.state import IntentFlowState

app = FastAPI(title="IntentFlow AI Agent")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class IntentRequest(BaseModel):
    user_input: str
    user_address: str

@app.post("/intent")
async def process_intent(req: IntentRequest):
    state = IntentFlowState(
        user_input=req.user_input,
        parsed_intent=None,
        strategies=[],
        selected_strategy=None,
        simulation_result=None,
        requires_approval=False,
        tx_hash=None,
        error=None
    )

    result = agent.invoke(state)

    if result.get("error"):
        raise HTTPException(400, detail=result["error"])

    return {
        "parsed_intent": result["parsed_intent"],
        "strategies": [s.dict() for s in result["strategies"]],
        "recommended": result["selected_strategy"].dict() if result["selected_strategy"] else None,
        "simulation": result["simulation_result"],
        "requires_approval": result["requires_approval"]
    }

@app.post("/execute")
async def execute_strategy(req: dict):
    # Called after user approval
    # Sign and send tx via agent wallet or relay to frontend
    # Return tx hash
    pass

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
```

Run:
```bash
cd backend
source venv/bin/activate
uvicorn app.main:app --reload
```

---

## 7. Frontend

### 7.1 Wagmi Configuration
```typescript
// frontend/src/config/wagmi.ts
import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import { botTestnet, botMainnet } from './chains'; // Define custom chains
import { http } from 'wagmi';

export const config = getDefaultConfig({
  appName: 'IntentFlow',
  projectId: 'YOUR_WALLETCONNECT_PROJECT_ID',
  chains: [botTestnet, botMainnet],
  transports: {
    [botTestnet.id]: http(process.env.NEXT_PUBLIC_BOT_TESTNET_RPC),
    [botMainnet.id]: http(process.env.NEXT_PUBLIC_BOT_MAINNET_RPC),
  },
});
```

### 7.2 Custom Chain Definition
```typescript
// frontend/src/config/chains.ts
import { defineChain } from 'viem';

export const botTestnet = defineChain({
  id: 12345, // Replace with actual
  name: 'BOT Chain Testnet',
  nativeCurrency: { name: 'BOT', symbol: 'BOT', decimals: 18 },
  rpcUrls: {
    default: { http: ['https://testnet-rpc.botchain.ai'] },
  },
  blockExplorers: {
    default: { name: 'Explorer', url: 'https://testnet-explorer.botchain.ai' },
  },
  testnet: true,
});
```

### 7.3 Chat Interface Component
```tsx
// frontend/src/components/IntentChat.tsx
'use client';
import { useState } from 'react';
import { useAccount } from 'wagmi';
import { parseEther, formatEther } from 'viem';

export default function IntentChat() {
  const { address, isConnected } = useAccount();
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);

  const submitIntent = async () => {
    if (!address) return;
    setLoading(true);

    const res = await fetch('http://localhost:8000/intent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_input: input, user_address: address }),
    });

    const data = await res.json();
    setResult(data);
    setLoading(false);
  };

  return (
    <div className="max-w-2xl mx-auto p-6">
      {!isConnected ? (
        <ConnectButton />
      ) : (
        <>
          <div className="bg-slate-900 rounded-xl p-4 mb-4 h-96 overflow-y-auto">
            {/* Chat history */}
          </div>

          <div className="flex gap-2">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="e.g., 'Earn 8% APY on my BOT with low risk'"
              className="flex-1 bg-slate-800 rounded-lg px-4 py-3 text-white"
            />
            <button 
              onClick={submitIntent}
              disabled={loading}
              className="bg-emerald-500 hover:bg-emerald-600 px-6 py-3 rounded-lg font-semibold"
            >
              {loading ? 'Analyzing...' : 'Send'}
            </button>
          </div>

          {result && (
            <StrategyCard 
              strategy={result.recommended}
              simulation={result.simulation}
              requiresApproval={result.requires_approval}
            />
          )}
        </>
      )}
    </div>
  );
}
```

### 7.4 Strategy Card + Approval UI
```tsx
// frontend/src/components/StrategyCard.tsx
import { useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { INTENT_VAULT_ABI, INTENT_VAULT_ADDRESS } from '@/constants/contracts';

export function StrategyCard({ strategy, simulation, requiresApproval }: Props) {
  const { writeContract, data: hash } = useWriteContract();
  const { isLoading, isSuccess } = useWaitForTransactionReceipt({ hash });

  const execute = () => {
    writeContract({
      address: INTENT_VAULT_ADDRESS,
      abi: INTENT_VAULT_ABI,
      functionName: 'executeIntent',
      args: [
        address,
        keccak256(toUtf8Bytes(JSON.stringify(strategy))),
        strategy.strategy_id,
        strategy.token,
        parseUnits(strategy.amount.toString(), 18),
        '0x' // strategy data
      ],
    });
  };

  return (
    <div className="bg-slate-800 rounded-xl p-6 mt-4 border border-slate-700">
      <h3 className="text-xl font-bold text-emerald-400">{strategy.name}</h3>

      <div className="grid grid-cols-3 gap-4 my-4">
        <Metric label="Projected APY" value={`${strategy.projected_apy}%`} />
        <Metric label="Risk Score" value={`${strategy.risk_score}/10`} />
        <Metric label="Gas Estimate" value={`${strategy.gas_estimate} BOT`} />
      </div>

      <div className="bg-slate-900 rounded-lg p-4 mb-4">
        <p className="text-sm text-slate-400">30-Day Simulation</p>
        <p className="text-lg">+{simulation.projected_return} BOT</p>
        <p className="text-xs text-slate-500">
          Break-even: {simulation.break_even_days} days
        </p>
      </div>

      {requiresApproval ? (
        <div className="bg-amber-900/30 border border-amber-600 rounded-lg p-4 mb-4">
          <p className="text-amber-400 font-medium">⚠️ Approval Required</p>
          <p className="text-sm text-amber-300/80">
            This amount exceeds your auto-approval threshold.
          </p>
          <button className="mt-2 bg-amber-600 hover:bg-amber-500 px-4 py-2 rounded text-sm">
            Approve in Wallet
          </button>
        </div>
      ) : (
        <button
          onClick={execute}
          disabled={isLoading}
          className="w-full bg-emerald-500 hover:bg-emerald-600 py-3 rounded-lg font-bold"
        >
          {isLoading ? 'Executing...' : isSuccess ? 'Executed ✓' : 'Execute Strategy'}
        </button>
      )}

      {hash && (
        <a 
          href={`https://testnet-explorer.botchain.ai/tx/${hash}`}
          target="_blank"
          className="text-xs text-emerald-400 mt-2 block"
        >
          View on Explorer →
        </a>
      )}
    </div>
  );
}
```

### 7.5 Portfolio Tracker
```tsx
// frontend/src/components/PortfolioTracker.tsx
import { useReadContract } from 'wagmi';

export function PortfolioTracker() {
  const { address } = useAccount();

  const { data: positions } = useReadContract({
    address: INTENT_VAULT_ADDRESS,
    abi: INTENT_VAULT_ABI,
    functionName: 'getPositions',
    args: [address],
  });

  return (
    <div className="bg-slate-900 rounded-xl p-6">
      <h2 className="text-2xl font-bold mb-4">Your Positions</h2>
      {positions?.map((pos, i) => (
        <div key={i} className="flex justify-between items-center bg-slate-800 p-4 rounded-lg mb-2">
          <div>
            <p className="font-medium">Strategy #{pos.strategyId}</p>
            <p className="text-sm text-slate-400">
              {formatEther(pos.amount)} BOT · {pos.active ? 'Active' : 'Closed'}
            </p>
          </div>
          <button className="text-red-400 hover:text-red-300 text-sm">
            Withdraw
          </button>
        </div>
      ))}
    </div>
  );
}
```

---

## 8. End-to-End Integration Flow

### 8.1 User Journey (Testnet)
```
1. User connects MetaMask to BOT Chain Testnet
2. User types: "I have 100 BOT and want low risk yield for 30 days"
3. Frontend sends POST /intent → AI agent parses → queries StrategyRegistry
4. Agent returns: MockDEX Pool A, 8.5% APY, Risk 3/10
5. Frontend shows simulation card: +2.1 BOT projected, gas 0.001 BOT
6. User clicks "Execute Strategy"
7. Frontend calls IntentVault.executeIntent() with:
   - intentHash (keccak256 of strategy JSON)
   - strategyId (0 for MockDEX)
   - token (BOT testnet address)
   - amount (100 BOT in wei)
8. MetaMask pops up → user signs
9. Tx confirmed on testnet → tx hash shown with explorer link
10. PortfolioTracker auto-refreshes showing new active position
```

### 8.2 AI Agent ↔ Contract Interaction
- **Read**: Agent queries `StrategyRegistry.getActiveStrategies()` via Web3.py
- **Write**: Agent wallet (EOA) calls `IntentVault.executeIntent()` — requires agent wallet to be funded with testnet BOT for gas
- **State**: Agent maintains no state; all truth is on-chain

---

## 9. Testing on Testnet (Mandatory Before Mainnet)

### 9.1 Testnet Checklist
| Test | Expected Result | How to Verify |
|------|----------------|---------------|
| Connect wallet to testnet | RainbowKit shows BOT Chain Testnet | UI network indicator |
| Deposit BOT to IntentVault | `Deposit` event emitted | Explorer logs |
| Parse natural language intent | Valid JSON with asset/amount/risk | Backend logs |
| Fetch active strategies | Returns MockDEX strategy | API response |
| Simulate strategy | Positive projected return | UI simulation card |
| Execute strategy without approval | Tx succeeds, position created | Explorer + PortfolioTracker |
| Execute strategy with approval | MetaMask prompts, tx succeeds | Manual test with >100 BOT |
| Withdraw from vault | Funds returned to user | Balance check |
| View portfolio | Active positions displayed | UI list |

### 9.2 Edge Cases to Test
- **Invalid intent**: *"Buy me a pizza"* → AI returns error, frontend shows friendly message
- **Insufficient balance**: Deposit > wallet balance → contract reverts with clear error
- **Strategy paused**: Registry sets active=false → agent filters it out
- **Double execution**: Same intent hash → contract reverts "Intent already executed"
- **Wrong network**: User on Ethereum mainnet → RainbowKit prompts switch

### 9.3 Load Testing
```bash
# Simulate 10 concurrent intent requests
ab -n 100 -c 10 -p intent.json -T application/json \
  http://localhost:8000/intent
```

---

## 10. Mainnet Deployment (After Testnet Validation)

### 10.1 Pre-Mainnet Checklist
- [ ] All testnet tests pass
- [ ] Contracts verified on testnet explorer
- [ ] Gas support application submitted and approved (1 BOT)
- [ ] Real protocol integrations identified (DEX, lending pools on BOT Chain mainnet)
- [ ] Agent wallet funded with mainnet BOT for gas
- [ ] Frontend env vars updated to point to mainnet RPC
- [ ] Rate limiting + API key auth added to backend (production hardening)
- [ ] Error handling + fallback messages implemented

### 10.2 Mainnet Deploy Script
```typescript
// contracts/scripts/deploy-mainnet.ts
import { ethers } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();

  // Deploy to mainnet with real protocol addresses
  const Registry = await ethers.getContractFactory("StrategyRegistry");
  const registry = await Registry.deploy();
  await registry.waitForDeployment();

  // Add REAL protocols (get addresses from BOT Chain ecosystem)
  // Example: await registry.addStrategy(REAL_DEX_ADDRESS, "BOTSwap", "DEX", 3);

  const ApprovalGate = await ethers.getContractFactory("ApprovalGate");
  const approvalGate = await ApprovalGate.deploy();

  const agentWallet = "0x..."; // Dedicated agent EOA with mainnet BOT
  const IntentVault = await ethers.getContractFactory("IntentVault");
  const vault = await IntentVault.deploy(
    await registry.getAddress(),
    await approvalGate.getAddress(),
    agentWallet
  );

  console.log("Mainnet IntentVault:", await vault.getAddress());

  // Verify all contracts
  await hre.run("verify:verify", {
    address: await vault.getAddress(),
    constructorArguments: [
      await registry.getAddress(),
      await approvalGate.getAddress(),
      agentWallet
    ],
  });
}

main().catch(console.error);
```

Run:
```bash
npx hardhat run scripts/deploy-mainnet.ts --network botMainnet
```

### 10.3 Frontend Mainnet Switch
Update `frontend/.env.local`:
```env
NEXT_PUBLIC_BOT_CHAIN=mainnet
NEXT_PUBLIC_BOT_MAINNET_RPC=https://mainnet-rpc.botchain.ai
NEXT_PUBLIC_INTENT_VAULT=0xMAINNET_ADDRESS
NEXT_PUBLIC_REGISTRY=0xMAINNET_ADDRESS
NEXT_PUBLIC_AGENT_API=https://your-production-api.com
```

---

## 11. Demo Script (For Online Demo Day)

### 11.1 5-Minute Demo Flow
1. **Intro** (30s): *"IntentFlow lets you execute DeFi strategies by typing plain English."*
2. **Connect** (15s): Show wallet connection to BOT Chain
3. **Intent** (30s): Type *"Earn yield on 50 BOT with low risk"*
4. **Analysis** (45s): Show AI parsing + strategy cards with APY/risk/gas
5. **Simulation** (30s): Highlight 30-day projection and break-even
6. **Execute** (60s): Click execute → MetaMask → tx confirmed → explorer link
7. **Portfolio** (30s): Show active position in portfolio tracker
8. **Architecture** (60s): Briefly explain LangGraph + on-chain execution

### 11.2 Backup Plans
- If live tx is slow: Have pre-recorded execution video ready
- If AI is slow: Show cached response, explain it's usually instant
- If network issues: Run against local fork (`npx hardhat node`)

---

## 12. Submission Checklist

Before submitting via [Google Form](https://forms.gle/ZKvnfcGrkZmdgigA8):

- [ ] **BOT Chain Mainnet Deployment** — IntentVault, StrategyRegistry, ApprovalGate verified
- [ ] **Publicly Accessible Demo** — Frontend deployed (Vercel/Netlify) with mainnet connection
- [ ] **Wallet Integration** — RainbowKit + MetaMask, full connect/switch/tx flow
- [ ] **Complete Core User Workflow** — Intent → Parse → Simulate → Approve → Execute → Track
- [ ] **GitHub Repository** — Clean README with setup instructions, MIT license
- [ ] **AI Native Applications Track** — Clear AI agent orchestration via LangGraph
- [ ] **Demo Video** — 3-5 min screen recording uploaded to YouTube/Loom
- [ ] **Team Info** — Names, roles, Telegram, Twitter filled in submission form

---

## 13. Key Files Reference

| File | Purpose |
|------|---------|
| `contracts/contracts/IntentVault.sol` | Core fund holding + execution |
| `contracts/contracts/StrategyRegistry.sol` | Protocol whitelist |
| `contracts/contracts/ApprovalGate.sol` | Human-in-the-loop thresholds |
| `backend/app/agent/graph.py` | LangGraph workflow |
| `backend/app/agent/nodes.py` | Intent parser, strategy fetcher, simulator |
| `backend/app/main.py` | FastAPI server |
| `frontend/src/components/IntentChat.tsx` | NL chat interface |
| `frontend/src/components/StrategyCard.tsx` | Strategy display + execution |
| `frontend/src/components/PortfolioTracker.tsx` | Position monitoring |

---

## 14. Troubleshooting

| Issue | Solution |
|-------|----------|
| `Nonce too high` on testnet | Reset MetaMask account: Settings → Advanced → Reset |
| Agent tx fails with "Only agent" | Ensure `agentExecutor` address matches backend wallet |
| LangGraph state not persisting | Use `MemorySaver` checkpointing for multi-turn conversations |
| CORS errors | Ensure FastAPI `allow_origins` includes frontend URL |
| Contract too large | Enable optimizer in `hardhat.config.ts`: `optimizer: { enabled: true, runs: 200 }` |

---

**Ready to build.** Start with the contracts on testnet, validate the full flow, then deploy to mainnet and submit.
