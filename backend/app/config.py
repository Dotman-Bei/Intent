"""Runtime configuration. Everything is optional so the agent can boot with no chain and no
API key — it degrades to the offline catalog + rule-based parser instead of failing to start."""

from __future__ import annotations

import os
from dataclasses import dataclass, field
from functools import lru_cache

from dotenv import load_dotenv

load_dotenv()


def _split(value: str) -> list[str]:
    return [item.strip() for item in value.split(",") if item.strip()]


def _prefix(value: str) -> str:
    """Normalise a mount prefix into the exact shape `include_router` accepts.

    This value is typed by hand into a host's dashboard, so it arrives with the leading slash
    missing, a trailing one attached, or padding whitespace. `include_router` asserts on the
    leading slash and that assert fires at import time, so one typo takes down every route —
    including `/health`, which is the endpoint the platform polls to decide whether the deploy
    came up. Empty (or a bare "/") means "no second mount", which is what a standalone host wants.
    """
    cleaned = value.strip().strip("/")
    return f"/{cleaned}" if cleaned else ""


@dataclass(frozen=True)
class Settings:
    # AI
    anthropic_api_key: str = os.getenv("ANTHROPIC_API_KEY", "")
    anthropic_model: str = os.getenv("ANTHROPIC_MODEL", "claude-opus-5")

    # Chain
    rpc_url: str = os.getenv("BOT_RPC_URL", "https://testnet-rpc.botchain.ai")
    chain_id: int = int(os.getenv("CHAIN_ID", "12345"))
    explorer_url: str = os.getenv("EXPLORER_URL", "https://testnet-explorer.botchain.ai")
    registry_address: str = os.getenv("STRATEGY_REGISTRY_ADDRESS", "")
    vault_address: str = os.getenv("INTENT_VAULT_ADDRESS", "")
    approval_gate_address: str = os.getenv("APPROVAL_GATE_ADDRESS", "")
    token_address: str = os.getenv("TEST_TOKEN_ADDRESS", "")
    token_decimals: int = int(os.getenv("TOKEN_DECIMALS", "18"))
    agent_private_key: str = os.getenv("AGENT_PRIVATE_KEY", "")

    # Policy
    default_approval_threshold: float = float(os.getenv("DEFAULT_APPROVAL_THRESHOLD", "100"))

    # Server
    # Path prefix this service is mounted under, when it sits behind a path-preserving proxy
    # (e.g. Vercel multi-service rewrites at /api/backend). Empty for a standalone host.
    api_prefix: str = _prefix(os.getenv("API_PREFIX", ""))
    cors_origins: list[str] = field(
        default_factory=lambda: _split(os.getenv("CORS_ORIGINS", "http://localhost:3000"))
    )

    @property
    def llm_enabled(self) -> bool:
        return bool(self.anthropic_api_key)

    @property
    def chain_enabled(self) -> bool:
        return bool(self.registry_address)

    @property
    def can_broadcast(self) -> bool:
        return bool(self.agent_private_key and self.vault_address)


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()
