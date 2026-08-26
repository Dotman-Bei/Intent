"""The five agent nodes.

parse -> strategize -> simulate -> gate -> plan

Every node is a pure `state -> state` function, short-circuits when `error` is already set, and
appends a human-readable line to `trace`. The trace is what the UI prints in the terminal, so it is
written to be read by a person, not a log parser.
"""

from __future__ import annotations

import time

from app.agent.state import IntentFlowState
from app.config import get_settings
from app.models.schemas import ExecutionPlan
from app.services import blockchain, simulator
from app.services.llm import parse_intent_text

MIN_CONFIDENCE = 0.35


def _trace(state: IntentFlowState, line: str) -> None:
    state.setdefault("trace", []).append(line)


def parse_intent(state: IntentFlowState) -> IntentFlowState:
    parsed, mode = parse_intent_text(state["user_input"])
    state["parsed_intent"] = parsed
    state["llm_mode"] = mode
    _trace(state, f"parsed intent via {mode}: goal={parsed.goal} risk={parsed.risk_tolerance}")

    if parsed.goal == "unknown" or parsed.confidence < MIN_CONFIDENCE:
        state["error"] = (
            "That does not read as a DeFi instruction. Try something like "
            "'earn yield on 50 BOT with low risk for 30 days'."
        )
        _trace(state, "rejected: not an executable DeFi intent")
        return state

    if parsed.amount <= 0:
        state["error"] = (
            f"How much {parsed.asset} should be deployed? Add an amount, e.g. "
            f"'50 {parsed.asset}'."
        )
        _trace(state, "rejected: no amount given")

    return state


def fetch_strategies(state: IntentFlowState) -> IntentFlowState:
    if state.get("error"):
        return state

    parsed = state["parsed_intent"]
    assert parsed is not None

    all_strategies, source = blockchain.fetch_strategies()
    _trace(state, f"read {len(all_strategies)} active strategies from {source}")

    band = simulator.risk_band(parsed.risk_tolerance)
    eligible = [s for s in all_strategies if s.risk_score in band]
    # Kept, not discarded: what the agent refused is as much of the answer as what it picked.
    state["excluded"] = sorted(
        (s for s in all_strategies if s.risk_score not in band),
        key=lambda s: s.projected_apy,
        reverse=True,
    )

    if not eligible:
        state["strategies"] = []
        state["error"] = (
            f"No whitelisted strategy fits a {parsed.risk_tolerance}-risk mandate right now."
        )
        _trace(state, "no strategy inside the requested risk band")
        return state

    state["strategies"] = simulator.rank(eligible, parsed.risk_tolerance)
    _trace(
        state,
        f"{len(eligible)} strategies inside the {parsed.risk_tolerance}-risk band "
        f"(scores {band.start}-{band.stop - 1})",
    )
    for rejected in state["excluded"]:
        _trace(
            state,
            f"excluded {rejected.name} ({rejected.projected_apy:.2f}% APY) — "
            f"risk {rejected.risk_score}/10 is outside a {parsed.risk_tolerance}-risk mandate",
        )
    return state


def simulate(state: IntentFlowState) -> IntentFlowState:
    if state.get("error") or not state.get("strategies"):
        return state

    parsed = state["parsed_intent"]
    assert parsed is not None

    best = state["strategies"][0]
    days = simulator.horizon_days(parsed.time_horizon)
    result = simulator.simulate_strategy(best, parsed.amount, days)

    state["selected_strategy"] = best
    state["simulation"] = result
    state["rationale"] = (
        f"{best.name} pays {best.projected_apy:.2f}% at risk {best.risk_score}/10, the best "
        f"risk-adjusted return among {len(state['strategies'])} whitelisted venues for a "
        f"{parsed.risk_tolerance}-risk, {days}-day mandate."
    )
    _trace(
        state,
        f"simulated {days}d on {best.name}: net {result.projected_return:+.4f} {parsed.asset}",
    )
    return state


def approval_gate(state: IntentFlowState) -> IntentFlowState:
    if state.get("error") or not state.get("selected_strategy"):
        return state

    settings = get_settings()
    parsed = state["parsed_intent"]
    assert parsed is not None

    amount_wei = blockchain.to_wei(parsed.amount, settings.token_decimals)
    on_chain = blockchain.fetch_approval_state(state["user_address"], amount_wei)

    if on_chain is not None:
        state["requires_approval"] = on_chain["requires_approval"]
        state["approval_threshold"] = on_chain["threshold"]
        state["threshold_configured"] = on_chain["configured"]
        if not on_chain["configured"]:
            _trace(state, "approval gate: no threshold set on-chain -> signature required")
        else:
            _trace(
                state,
                f"approval gate: {parsed.amount:g} vs on-chain threshold "
                f"{on_chain['threshold']:g} -> "
                + ("signature required" if on_chain["requires_approval"] else "auto-approved"),
            )
        return state

    # Gate unreachable: quote the configured default and say so, rather than promise anything.
    threshold = settings.default_approval_threshold
    state["approval_threshold"] = threshold
    state["threshold_configured"] = False
    state["requires_approval"] = True
    _trace(
        state,
        f"approval gate unreachable — assuming signature required (default ceiling {threshold:g})",
    )
    return state


def build_plan(state: IntentFlowState) -> IntentFlowState:
    """Assemble the exact transaction the user's wallet will sign. The intent hash is computed
    here and nowhere else — the vault's replay guard and the approval signature both key off it."""
    if state.get("error") or not state.get("selected_strategy"):
        return state

    settings = get_settings()
    parsed = state["parsed_intent"]
    strategy = state["selected_strategy"]
    assert parsed is not None and strategy is not None

    token_address = strategy.token_address or settings.token_address
    if not token_address or not settings.vault_address:
        _trace(state, "no vault/token address configured — returning analysis without a plan")
        return state

    amount_wei = blockchain.to_wei(parsed.amount, settings.token_decimals)
    digest = blockchain.intent_hash(
        {
            "user": state["user_address"].lower(),
            "strategy_id": strategy.strategy_id,
            "token": token_address.lower(),
            "amount_wei": str(amount_wei),
            "goal": parsed.goal,
            "horizon_days": simulator.horizon_days(parsed.time_horizon),
            "issued_at": int(time.time()),
        }
    )
    state["execution_plan"] = ExecutionPlan(
        intent_hash=digest,
        vault_address=settings.vault_address,
        args=[
            state["user_address"],
            digest,
            str(strategy.strategy_id),
            token_address,
            str(amount_wei),
        ],
        token_address=token_address,
        amount_wei=str(amount_wei),
        requires_approval=bool(state.get("requires_approval")),
        approval_gate_address=settings.approval_gate_address,
        chain_id=settings.chain_id,
    )
    _trace(state, f"execution plan ready, intent {digest[:12]}...")
    return state
