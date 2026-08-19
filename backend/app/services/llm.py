"""Intent parsing.

Two implementations behind one function:

* `parse_with_claude` — Claude with a constrained JSON schema (structured outputs), so the model
  cannot return prose where the graph expects fields.
* `parse_with_rules`  — a deterministic regex parser used when no API key is configured or the API
  call fails. It keeps the demo and the test suite runnable offline, and it is what the
  `llm_mode: "rule-based"` badge in the UI refers to.
"""

from __future__ import annotations

import logging
import re
from typing import Optional

from app.config import get_settings
from app.models.schemas import ParsedIntent

log = logging.getLogger(__name__)

SYSTEM_PROMPT = """You parse natural-language DeFi requests for IntentFlow, an intent executor on \
BOT Chain. Turn the user's message into the structured intent schema.

Rules:
- `amount` is a number in whole tokens. If the user gave no amount, use 0.
- `asset` defaults to "BOT" when the user does not name a token.
- `risk_tolerance`: read the wording. "safe", "stable", "conservative", "don't lose" -> low. \
"aggressive", "max yield", "degen", "highest APY" -> high. Otherwise medium.
- `time_horizon`: under a month -> short, one to six months -> medium, longer or unstated \
long-term intent -> long. Default short when unstated.
- `goal` is what they want done: yield, swap, stake or borrow. If the message is not a DeFi \
request at all, set goal to "unknown" and confidence below 0.3.
- `constraints` are short snake_case tags you can infer, e.g. low_gas, blue_chip, \
no_impermanent_loss, stablecoin_only.
- `restated` is one plain sentence restating the request, addressed to the user.
- `confidence` is how sure you are this is an executable DeFi intent, 0 to 1."""

# --- rule-based fallback -------------------------------------------------

_AMOUNT_RE = re.compile(r"(\d[\d,]*\.?\d*)\s*(k|m)?\b", re.IGNORECASE)
_ASSET_RE = re.compile(r"\b(BOT|WBOT|USDC|USDT|ETH|WETH|BTC|DAI)\b", re.IGNORECASE)

_GOAL_WORDS: dict[str, tuple[str, ...]] = {
    "yield": ("yield", "earn", "apy", "apr", "interest", "farm", "return", "grow", "income"),
    "stake": ("stake", "staking", "validator", "delegate"),
    "swap": ("swap", "trade", "convert", "exchange", "sell", "buy into"),
    "borrow": ("borrow", "loan", "leverage", "collateral"),
}
_LOW_RISK = ("low risk", "safe", "stable", "conservative", "capital preservation", "no risk",
             "minimal risk", "don't want to lose", "dont want to lose", "protect")
_HIGH_RISK = ("high risk", "aggressive", "degen", "max yield", "maximum yield", "highest apy",
              "risky", "moonshot")
_HORIZON = {
    "short": ("day", "days", "week", "weeks", "month", "short"),
    "medium": ("quarter", "3 months", "three months", "6 months", "six months", "medium"),
    "long": ("year", "years", "long term", "long-term", "forever", "hodl"),
}


def _extract_amount(text: str) -> float:
    for raw, suffix in _AMOUNT_RE.findall(text):
        # Skip percentages and durations — "8% APY" and "30 days" are not amounts.
        value = float(raw.replace(",", ""))
        if suffix:
            value *= 1_000 if suffix.lower() == "k" else 1_000_000
        idx = text.lower().find(raw.lower())
        tail = text[idx + len(raw) : idx + len(raw) + 12].lower()
        if tail.strip().startswith("%") or any(
            unit in tail for unit in ("day", "week", "month", "year", "%")
        ):
            continue
        return value
    return 0.0


def parse_with_rules(text: str) -> ParsedIntent:
    lowered = text.lower()

    goal = "unknown"
    for candidate, words in _GOAL_WORDS.items():
        if any(word in lowered for word in words):
            goal = candidate
            break

    risk = "medium"
    if any(word in lowered for word in _LOW_RISK):
        risk = "low"
    elif any(word in lowered for word in _HIGH_RISK):
        risk = "high"

    horizon = "short"
    for candidate, words in _HORIZON.items():
        if any(word in lowered for word in words):
            horizon = candidate
            break

    asset_match = _ASSET_RE.search(text)
    asset = asset_match.group(1).upper() if asset_match else "BOT"
    amount = _extract_amount(text)

    constraints: list[str] = []
    if "gas" in lowered:
        constraints.append("low_gas")
    if "stable" in lowered or "usdc" in lowered:
        constraints.append("stablecoin_only")
    if "impermanent" in lowered:
        constraints.append("no_impermanent_loss")
    if risk == "low":
        constraints.append("blue_chip")

    confidence = 0.0
    if goal != "unknown":
        confidence += 0.55
    if amount > 0:
        confidence += 0.3
    if asset_match:
        confidence += 0.15

    restated = (
        f"Put {amount:g} {asset} to work with {risk} risk over a {horizon} horizon."
        if goal != "unknown"
        else "That does not look like a DeFi instruction."
    )

    return ParsedIntent(
        asset=asset,
        amount=amount,
        goal=goal,  # type: ignore[arg-type]
        risk_tolerance=risk,  # type: ignore[arg-type]
        time_horizon=horizon,  # type: ignore[arg-type]
        constraints=constraints,
        confidence=round(min(confidence, 1.0), 2),
        restated=restated,
    )


# --- Claude --------------------------------------------------------------


def parse_with_claude(text: str) -> Optional[ParsedIntent]:
    settings = get_settings()
    if not settings.llm_enabled:
        return None

    try:
        import anthropic

        client = anthropic.Anthropic(api_key=settings.anthropic_api_key)
        response = client.messages.parse(
            model=settings.anthropic_model,
            max_tokens=2000,
            system=SYSTEM_PROMPT,
            messages=[{"role": "user", "content": text}],
            output_format=ParsedIntent,
        )
        return response.parsed_output
    except Exception as exc:  # noqa: BLE001 — never let a model outage break the flow
        log.warning("Claude intent parsing failed, falling back to rules: %s", exc)
        return None


def parse_intent_text(text: str) -> tuple[ParsedIntent, str]:
    """Returns the parsed intent and which parser produced it."""
    parsed = parse_with_claude(text)
    if parsed is not None:
        return parsed, "claude"
    return parse_with_rules(text), "rule-based"
