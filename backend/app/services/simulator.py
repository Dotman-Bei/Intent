"""Strategy projection.

Deliberately simple and deliberately explicit about its assumptions: compounding is daily at the
advertised APY, impermanent-loss risk is a flat haircut derived from the registry risk score, and
gas is a measured constant. Every number the UI shows comes from here so the caveats stay attached.
"""

from __future__ import annotations

from app.models.schemas import Simulation, StrategyOption

HORIZON_DAYS = {"short": 30, "medium": 90, "long": 365}

# Risk score (1-10) -> assumed impermanent loss / drawdown haircut over the horizon.
IL_BY_RISK = {1: 0.0, 2: 0.0, 3: 0.0, 4: 0.01, 5: 0.02, 6: 0.03, 7: 0.05, 8: 0.07, 9: 0.1, 10: 0.15}


def horizon_days(time_horizon: str) -> int:
    return HORIZON_DAYS.get(time_horizon, 30)


def simulate_strategy(strategy: StrategyOption, amount: float, days: int = 30) -> Simulation:
    daily_rate = strategy.projected_apy / 100 / 365
    gross_return = amount * ((1 + daily_rate) ** days - 1)

    il_risk = IL_BY_RISK.get(strategy.risk_score, 0.05)
    net_return = gross_return - (amount * il_risk * days / 365) - strategy.gas_estimate

    daily_profit = gross_return / days if days else 0.0
    break_even = (
        max(1, int(strategy.gas_estimate / daily_profit) + 1) if daily_profit > 0 else 999
    )

    return Simulation(
        horizon_days=days,
        projected_return=round(net_return, 6),
        projected_return_pct=round((net_return / amount * 100) if amount else 0.0, 3),
        impermanent_loss_risk=il_risk,
        gas_cost_bot=strategy.gas_estimate,
        net_apr=round(strategy.projected_apy * (1 - il_risk), 3),
        break_even_days=break_even,
        # A bad month: yield halves and the full IL haircut lands.
        worst_case_return=round(gross_return * 0.5 - amount * il_risk - strategy.gas_estimate, 6),
    )


def rank(strategies: list[StrategyOption], risk_tolerance: str) -> list[StrategyOption]:
    """Risk-adjusted ranking. Low tolerance divides harder by risk, so a 12% APY at risk 5 loses to
    an 8.5% APY at risk 3 — which is the behaviour a user asking for 'safe' expects to see."""
    weight = {"low": 1.6, "medium": 1.0, "high": 0.5}.get(risk_tolerance, 1.0)
    return sorted(
        strategies,
        key=lambda s: s.projected_apy / (max(s.risk_score, 1) ** weight),
        reverse=True,
    )


def risk_band(risk_tolerance: str) -> range:
    return {
        "low": range(1, 4),
        "medium": range(1, 7),
        "high": range(1, 11),
    }.get(risk_tolerance, range(1, 4))
