"""On-chain reads and transaction assembly.

The registry is the source of truth for what the agent may propose. When no registry address is
configured (or the RPC is unreachable) the service falls back to a static catalog that mirrors the
testnet deployment, so the agent still produces a full, honest-looking answer with
`source: "catalog"` marked on every strategy.
"""

from __future__ import annotations

import json
import logging
from functools import lru_cache
from pathlib import Path
from typing import Any, Optional

from web3 import Web3
from web3.middleware import ExtraDataToPOAMiddleware

from app.config import get_settings
from app.models.schemas import PositionView, StrategyOption

log = logging.getLogger(__name__)

ABI_DIR = Path(__file__).resolve().parents[2] / "abi"

# Gas units for one executeIntent, measured by contracts/scripts/measure-gas.ts against the
# deployed bytecode. Units are a property of the code, so they travel across networks; the price
# is not, so it is read live from whichever chain the agent is pointed at.
EXECUTE_INTENT_GAS = 296_181

# Only used when the RPC is unreachable: 295,607 units at 20 gwei, the low end of what BOT Chain
# reports. Flagged as an assumption in the trace rather than presented as a measurement.
GAS_ESTIMATE_FALLBACK_BOT = 0.0059

CATALOG: list[dict[str, Any]] = [
    {
        "strategy_id": 0,
        "protocol": "0x0000000000000000000000000000000000000000",
        "name": "BOTSwap Stable Pool",
        "protocol_type": "DEX",
        "projected_apy": 8.5,
        "risk_score": 3,
    },
    {
        "strategy_id": 1,
        "protocol": "0x0000000000000000000000000000000000000000",
        "name": "BOTLend Supply Market",
        "protocol_type": "Lending",
        "projected_apy": 12.4,
        "risk_score": 5,
    },
]


@lru_cache(maxsize=8)
def load_abi(name: str) -> list[dict[str, Any]]:
    path = ABI_DIR / f"{name}.json"
    if not path.exists():
        raise FileNotFoundError(
            f"{path} missing — run `npx hardhat run scripts/export-abi.ts` in contracts/"
        )
    return json.loads(path.read_text())


@lru_cache(maxsize=1)
def get_web3() -> Optional[Web3]:
    settings = get_settings()
    try:
        w3 = Web3(Web3.HTTPProvider(settings.rpc_url, request_kwargs={"timeout": 8}))
        if not w3.is_connected():
            log.warning("RPC %s not reachable — using offline catalog", settings.rpc_url)
            return None

        # BOT Chain is Proof-of-Authority: its block headers carry a 277-byte extraData field
        # where web3.py's default formatter expects 32. Without this middleware every call that
        # reads a block — get_block("latest") in fetch_portfolio — raises and the portfolio
        # silently reports "unavailable" against a chain that is answering perfectly well.
        w3.middleware_onion.inject(ExtraDataToPOAMiddleware, layer=0)
        return w3
    except Exception as exc:  # noqa: BLE001
        log.warning("RPC init failed (%s) — using offline catalog", exc)
        return None


def _contract(w3: Web3, name: str, address: str):
    return w3.eth.contract(address=Web3.to_checksum_address(address), abi=load_abi(name))


def to_wei(amount: float, decimals: int) -> int:
    return int(round(amount * (10**decimals)))


def from_wei(amount: int, decimals: int) -> float:
    return amount / (10**decimals)


def as_hex(value: Any) -> str:
    """web3 v7 / hexbytes v1 return `hex()` without the 0x prefix. Everything that crosses the
    wire to viem must carry it, so normalise in one place."""
    raw = value.hex() if isinstance(value, (bytes, bytearray)) else str(value)
    return raw if raw.startswith("0x") else "0x" + raw


def intent_hash(payload: dict[str, Any]) -> str:
    """Canonical hash of an intent: sorted, whitespace-free JSON. The backend, the vault and the
    approval signature all key off this exact string, so it must be produced in one place only."""
    canonical = json.dumps(payload, sort_keys=True, separators=(",", ":"))
    return as_hex(Web3.keccak(text=canonical))


# --- reads ---------------------------------------------------------------


def gas_estimate_bot() -> float:
    """Cost of one executeIntent in BOT, priced at the chain's current gas price.

    BOT Chain quotes 20-50 gwei depending on load, which moves this number by more than 2x — a
    hardcoded constant would be quietly wrong on one side or the other, and it is subtracted from
    every projection the user sees.
    """
    w3 = get_web3()
    if w3 is None:
        return GAS_ESTIMATE_FALLBACK_BOT
    try:
        wei = EXECUTE_INTENT_GAS * w3.eth.gas_price
        return round(wei / 10**18, 8)
    except Exception as exc:  # noqa: BLE001
        log.warning("gas price read failed (%s) — using fallback estimate", exc)
        return GAS_ESTIMATE_FALLBACK_BOT


def fetch_strategies() -> tuple[list[StrategyOption], str]:
    """Active strategies from the registry, or the catalog when the chain is unavailable."""
    settings = get_settings()
    w3 = get_web3() if settings.chain_enabled else None
    gas = gas_estimate_bot()

    if w3 is not None and settings.registry_address:
        try:
            registry = _contract(w3, "StrategyRegistry", settings.registry_address)
            ids, rows = registry.functions.getActiveStrategies().call()
            strategies = [
                StrategyOption(
                    strategy_id=int(sid),
                    protocol=row[0],
                    name=row[1],
                    protocol_type=row[2],
                    projected_apy=int(row[4]) / 100,
                    risk_score=int(row[3]),
                    gas_estimate=gas,
                    token="BOT",
                    token_address=settings.token_address,
                    source="chain",
                )
                for sid, row in zip(ids, rows)
            ]
            if strategies:
                return strategies, "chain"
        except Exception as exc:  # noqa: BLE001
            log.warning("registry read failed (%s) — using offline catalog", exc)

    catalog = [
        StrategyOption(
            **entry,
            gas_estimate=gas,
            token="BOT",
            token_address=settings.token_address,
            source="catalog",
        )
        for entry in CATALOG
    ]
    return catalog, "catalog"


def fetch_approval_state(user_address: str, amount_wei: int) -> Optional[dict[str, Any]]:
    """Ask ApprovalGate itself whether this amount needs a signature.

    The contract — not the backend — owns this policy, and its default posture is "ask me": a user
    who has never called `setConfig` requires approval for every amount, however small. Guessing a
    default here instead of reading the gate produces an agent that promises auto-execution and a
    transaction that reverts with ApprovalRequired.

    Returns None when the gate cannot be reached, leaving the caller to fall back.
    """
    settings = get_settings()
    w3 = get_web3()
    if w3 is None or not settings.approval_gate_address:
        return None
    try:
        gate = _contract(w3, "ApprovalGate", settings.approval_gate_address)
        address = Web3.to_checksum_address(user_address)
        threshold, enabled = gate.functions.userConfigs(address).call()
        requires = gate.functions.requiresApproval(address, amount_wei).call()
        return {
            "requires_approval": bool(requires),
            "threshold": from_wei(int(threshold), settings.token_decimals),
            "configured": bool(enabled),
        }
    except Exception as exc:  # noqa: BLE001
        log.warning("approval gate read failed: %s", exc)
        return None


def fetch_portfolio(user_address: str) -> tuple[list[PositionView], float, float, str]:
    settings = get_settings()
    w3 = get_web3()
    if w3 is None or not settings.vault_address:
        return [], 0.0, 0.0, "unavailable"

    try:
        vault = _contract(w3, "IntentVault", settings.vault_address)
        address = Web3.to_checksum_address(user_address)
        raw_positions = vault.functions.getPositions(address).call()

        names: dict[int, str] = {}
        apys: dict[int, float] = {}
        if settings.registry_address:
            registry = _contract(w3, "StrategyRegistry", settings.registry_address)
            ids, rows = registry.functions.getActiveStrategies().call()
            names = {int(sid): row[1] for sid, row in zip(ids, rows)}
            apys = {int(sid): int(row[4]) / 100 for sid, row in zip(ids, rows)}

        now = w3.eth.get_block("latest")["timestamp"]
        positions: list[PositionView] = []
        for index, raw in enumerate(raw_positions):
            strategy_id, token, amount, entry_ts, exit_ts, hash_bytes, active = raw
            amount_tokens = from_wei(int(amount), settings.token_decimals)
            elapsed_years = max(0, (now - int(entry_ts))) / (365 * 24 * 3600)
            accrued = (
                amount_tokens * (apys.get(int(strategy_id), 0.0) / 100) * elapsed_years
                if active
                else 0.0
            )
            positions.append(
                PositionView(
                    position_id=index,
                    strategy_id=int(strategy_id),
                    strategy_name=names.get(int(strategy_id), f"Strategy #{int(strategy_id)}"),
                    token=token,
                    amount=amount_tokens,
                    entry_timestamp=int(entry_ts),
                    exit_timestamp=int(exit_ts),
                    active=bool(active),
                    intent_hash=as_hex(hash_bytes),
                    accrued_estimate=round(accrued, 6),
                )
            )

        free = 0.0
        deployed = 0.0
        if settings.token_address:
            token_address = Web3.to_checksum_address(settings.token_address)
            free = from_wei(
                vault.functions.freeBalance(address, token_address).call(),
                settings.token_decimals,
            )
            deployed = from_wei(
                vault.functions.deployedBalance(address, token_address).call(),
                settings.token_decimals,
            )

        return positions, free, deployed, "chain"
    except Exception as exc:  # noqa: BLE001
        log.warning("portfolio read failed: %s", exc)
        return [], 0.0, 0.0, "unavailable"


# --- optional agent-side broadcast ---------------------------------------


def agent_execute(
    user_address: str,
    intent_hash_hex: str,
    strategy_id: int,
    token_address: str,
    amount_wei: int,
) -> str:
    """Broadcast executeIntent from the agent EOA. Only reachable when AGENT_PRIVATE_KEY is set —
    the default deployment leaves this off and lets the user's wallet sign instead."""
    settings = get_settings()
    if not settings.can_broadcast:
        raise RuntimeError("agent execution disabled: set AGENT_PRIVATE_KEY to enable it")

    w3 = get_web3()
    if w3 is None:
        raise RuntimeError("no RPC connection")

    account = w3.eth.account.from_key(settings.agent_private_key)
    vault = _contract(w3, "IntentVault", settings.vault_address)

    tx = vault.functions.executeIntent(
        Web3.to_checksum_address(user_address),
        bytes.fromhex(intent_hash_hex.removeprefix("0x")),
        strategy_id,
        Web3.to_checksum_address(token_address),
        amount_wei,
    ).build_transaction(
        {
            "from": account.address,
            "nonce": w3.eth.get_transaction_count(account.address),
            "chainId": settings.chain_id,
        }
    )

    signed = account.sign_transaction(tx)
    tx_hash = w3.eth.send_raw_transaction(signed.raw_transaction)
    return as_hex(tx_hash)
