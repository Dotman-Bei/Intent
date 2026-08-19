/** Typed client for the agent backend. Mirrors backend/app/models/schemas.py. */

const API = process.env.NEXT_PUBLIC_AGENT_API || "http://localhost:8000";

export type ParsedIntent = {
  asset: string;
  amount: number;
  goal: "yield" | "swap" | "stake" | "borrow" | "unknown";
  risk_tolerance: "low" | "medium" | "high";
  time_horizon: "short" | "medium" | "long";
  constraints: string[];
  confidence: number;
  restated: string;
};

export type Strategy = {
  strategy_id: number;
  protocol: string;
  name: string;
  protocol_type: string;
  projected_apy: number;
  risk_score: number;
  gas_estimate: number;
  token: string;
  token_address: string;
  source: "chain" | "catalog";
};

export type Simulation = {
  horizon_days: number;
  projected_return: number;
  projected_return_pct: number;
  impermanent_loss_risk: number;
  gas_cost_bot: number;
  net_apr: number;
  break_even_days: number;
  worst_case_return: number;
};

export type ExecutionPlan = {
  intent_hash: `0x${string}`;
  vault_address: `0x${string}`;
  function_name: string;
  args: string[];
  strategy_data: `0x${string}`;
  token_address: `0x${string}`;
  amount_wei: string;
  requires_approval: boolean;
  approval_gate_address: `0x${string}`;
  chain_id: number;
};

export type IntentResponse = {
  ok: boolean;
  parsed_intent: ParsedIntent | null;
  strategies: Strategy[];
  excluded: Strategy[];
  recommended: Strategy | null;
  simulation: Simulation | null;
  requires_approval: boolean;
  approval_threshold: number;
  threshold_configured: boolean;
  rationale: string;
  execution_plan: ExecutionPlan | null;
  trace: string[];
  error: string | null;
  llm_mode: "claude" | "rule-based";
};

export type HealthResponse = {
  ok: boolean;
  llm: "claude" | "rule-based";
  model: string | null;
  chain_configured: boolean;
  chain_connected: boolean;
  agent_broadcast: boolean;
  chain_id: number;
  vault: string | null;
};

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(`agent ${res.status}: ${await res.text()}`);
  }
  return res.json() as Promise<T>;
}

export async function submitIntent(
  userInput: string,
  userAddress: string
): Promise<IntentResponse> {
  return post<IntentResponse>("/intent", { user_input: userInput, user_address: userAddress });
}

export async function getHealth(): Promise<HealthResponse> {
  const res = await fetch(`${API}/health`, { cache: "no-store" });
  if (!res.ok) throw new Error(`agent ${res.status}`);
  return res.json() as Promise<HealthResponse>;
}

export const AGENT_API = API;
