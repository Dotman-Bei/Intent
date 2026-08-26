"""Wire types shared by the agent graph and the HTTP layer."""

from __future__ import annotations

from typing import Literal, Optional

from pydantic import BaseModel, Field

Goal = Literal["yield", "swap", "stake", "borrow", "unknown"]
Risk = Literal["low", "medium", "high"]
Horizon = Literal["short", "medium", "long"]


class ParsedIntent(BaseModel):
    """The structured form of a natural-language request. This is the schema the model is
    constrained to, and the schema the rule-based fallback parser also produces."""

    asset: str = Field(description="Token symbol the user named, e.g. BOT. 'BOT' if unstated.")
    amount: float = Field(description="Amount of the asset. 0 when the user gave no number.")
    goal: Goal = Field(description="What the user is trying to do.")
    risk_tolerance: Risk = Field(description="Stated or implied risk appetite.")
    time_horizon: Horizon = Field(description="How long they intend to stay in.")
    constraints: list[str] = Field(
        default_factory=list,
        description="Short tags such as low_gas, blue_chip, no_impermanent_loss.",
    )
    confidence: float = Field(
        default=0.0, description="0-1 confidence that this is a valid DeFi request."
    )
    restated: str = Field(
        default="", description="One sentence restating the request back to the user."
    )


class StrategyOption(BaseModel):
    strategy_id: int
    protocol: str
    name: str
    protocol_type: str
    projected_apy: float
    risk_score: int
    gas_estimate: float
    token: str
    token_address: str
    source: Literal["chain", "catalog"] = "catalog"


class Simulation(BaseModel):
    horizon_days: int
    projected_return: float
    projected_return_pct: float
    impermanent_loss_risk: float
    gas_cost_bot: float
    net_apr: float
    break_even_days: int
    worst_case_return: float


class ExecutionPlan(BaseModel):
    """Everything the frontend needs to build the transaction itself. The backend never needs a
    funded key for the primary flow — the user's wallet is the executor."""

    intent_hash: str
    vault_address: str
    function_name: str = "executeIntent"
    args: list[str]
    token_address: str
    amount_wei: str
    requires_approval: bool
    approval_gate_address: str
    chain_id: int


class IntentRequest(BaseModel):
    user_input: str = Field(min_length=1, max_length=1000)
    user_address: str


class IntentResponse(BaseModel):
    ok: bool
    parsed_intent: Optional[ParsedIntent] = None
    strategies: list[StrategyOption] = Field(default_factory=list)
    excluded: list[StrategyOption] = Field(default_factory=list)
    recommended: Optional[StrategyOption] = None
    simulation: Optional[Simulation] = None
    requires_approval: bool = False
    approval_threshold: float = 0.0
    threshold_configured: bool = False
    rationale: str = ""
    execution_plan: Optional[ExecutionPlan] = None
    trace: list[str] = Field(default_factory=list)
    error: Optional[str] = None
    llm_mode: Literal["claude", "rule-based"] = "rule-based"


class ExecuteRequest(BaseModel):
    """Agent-side execution. Only usable when AGENT_PRIVATE_KEY is configured; otherwise the
    frontend signs the plan returned by /intent."""

    user_address: str
    intent_hash: str
    strategy_id: int
    token_address: str
    amount_wei: str


class ExecuteResponse(BaseModel):
    ok: bool
    tx_hash: Optional[str] = None
    explorer_url: Optional[str] = None
    error: Optional[str] = None


class PositionView(BaseModel):
    position_id: int
    strategy_id: int
    strategy_name: str
    token: str
    amount: float
    entry_timestamp: int
    exit_timestamp: int
    active: bool
    intent_hash: str
    accrued_estimate: float


class PortfolioResponse(BaseModel):
    ok: bool
    address: str
    free_balance: float
    deployed_balance: float
    positions: list[PositionView] = Field(default_factory=list)
    source: Literal["chain", "unavailable"] = "unavailable"
    error: Optional[str] = None
