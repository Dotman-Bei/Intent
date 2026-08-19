"""Shared state for the LangGraph workflow.

One dict flows through parse -> strategize -> simulate -> gate -> plan. Every node appends to
`trace`, which is surfaced verbatim in the UI terminal so the user can see what the agent did.
"""

from __future__ import annotations

from typing import Optional, TypedDict

from app.models.schemas import ExecutionPlan, ParsedIntent, Simulation, StrategyOption


class IntentFlowState(TypedDict, total=False):
    # inputs
    user_input: str
    user_address: str

    # node outputs
    parsed_intent: Optional[ParsedIntent]
    strategies: list[StrategyOption]
    excluded: list[StrategyOption]
    selected_strategy: Optional[StrategyOption]
    simulation: Optional[Simulation]
    requires_approval: bool
    approval_threshold: float
    threshold_configured: bool
    rationale: str
    execution_plan: Optional[ExecutionPlan]

    # meta
    llm_mode: str
    trace: list[str]
    error: Optional[str]


def new_state(user_input: str, user_address: str) -> IntentFlowState:
    return IntentFlowState(
        user_input=user_input,
        user_address=user_address,
        parsed_intent=None,
        strategies=[],
        excluded=[],
        selected_strategy=None,
        simulation=None,
        requires_approval=False,
        approval_threshold=0.0,
        threshold_configured=False,
        rationale="",
        execution_plan=None,
        llm_mode="rule-based",
        trace=[],
        error=None,
    )
