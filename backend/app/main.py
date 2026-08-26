"""IntentFlow AI agent API."""

from __future__ import annotations

import logging

from fastapi import APIRouter, FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.agent.graph import agent
from app.agent.state import new_state
from app.config import get_settings
from app.models.schemas import (
    ExecuteRequest,
    ExecuteResponse,
    IntentRequest,
    IntentResponse,
    PortfolioResponse,
)
from app.services import blockchain

logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s: %(message)s")

settings = get_settings()
app = FastAPI(
    title="IntentFlow AI Agent",
    version="1.0.0",
    description="Natural language DeFi executor on BOT Chain",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Routes are declared on a router, then mounted twice: at the root, and again under API_PREFIX
# when one is set. Behind a path-preserving proxy (Vercel's multi-service rewrites send
# /api/backend/intent through untouched) the prefixed mount answers; behind a prefix-stripping
# proxy, or when running locally, the root mount does. Serving both means the deployment topology
# cannot break the agent.
router = APIRouter()


@router.get("/health")
def health() -> dict:
    """Also reports which capabilities are actually live, so the UI can show honest badges."""
    return {
        "ok": True,
        "llm": "claude" if settings.llm_enabled else "rule-based",
        "model": settings.anthropic_model if settings.llm_enabled else None,
        "chain_configured": settings.chain_enabled,
        "chain_connected": blockchain.get_web3() is not None,
        "agent_broadcast": settings.can_broadcast,
        "chain_id": settings.chain_id,
        "vault": settings.vault_address or None,
    }


@router.get("/strategies")
def strategies() -> dict:
    options, source = blockchain.fetch_strategies()
    return {"ok": True, "source": source, "strategies": [s.model_dump() for s in options]}


@router.post("/intent", response_model=IntentResponse)
def process_intent(req: IntentRequest) -> IntentResponse:
    """Parse -> rank -> simulate -> gate -> plan. A rejected intent is a 200 with `ok: false`;
    the chat UI renders it as a reply, not as a failure."""
    result = agent.invoke(new_state(req.user_input, req.user_address))

    return IntentResponse(
        ok=not result.get("error"),
        parsed_intent=result.get("parsed_intent"),
        strategies=result.get("strategies", []),
        excluded=result.get("excluded", []),
        recommended=result.get("selected_strategy"),
        simulation=result.get("simulation"),
        requires_approval=bool(result.get("requires_approval")),
        approval_threshold=float(result.get("approval_threshold", 0.0)),
        threshold_configured=bool(result.get("threshold_configured")),
        rationale=result.get("rationale", ""),
        execution_plan=result.get("execution_plan"),
        trace=result.get("trace", []),
        error=result.get("error"),
        llm_mode=result.get("llm_mode", "rule-based"),
    )


@router.post("/execute", response_model=ExecuteResponse)
def execute(req: ExecuteRequest) -> ExecuteResponse:
    """Optional agent-side broadcast. Disabled unless AGENT_PRIVATE_KEY is set — in the default
    setup the frontend signs the plan with the user's own wallet."""
    if not settings.can_broadcast:
        return ExecuteResponse(
            ok=False,
            error="Agent broadcast is disabled. Sign the execution plan with your wallet instead.",
        )
    try:
        tx_hash = blockchain.agent_execute(
            user_address=req.user_address,
            intent_hash_hex=req.intent_hash,
            strategy_id=req.strategy_id,
            token_address=req.token_address,
            amount_wei=int(req.amount_wei),
        )
        return ExecuteResponse(
            ok=True,
            tx_hash=tx_hash,
            explorer_url=f"{settings.explorer_url}/tx/{tx_hash}",
        )
    except Exception as exc:  # noqa: BLE001
        return ExecuteResponse(ok=False, error=str(exc))


@router.get("/portfolio/{address}", response_model=PortfolioResponse)
def portfolio(address: str) -> PortfolioResponse:
    positions, free, deployed, source = blockchain.fetch_portfolio(address)
    return PortfolioResponse(
        ok=source == "chain",
        address=address,
        free_balance=free,
        deployed_balance=deployed,
        positions=positions,
        source=source,
        error=None if source == "chain" else "Vault not reachable from the backend RPC.",
    )


app.include_router(router)
if settings.api_prefix:
    app.include_router(router, prefix=settings.api_prefix)


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)
