"""Agent tests. These run fully offline: no RPC, no API key — the graph falls back to the
rule-based parser and the strategy catalog, which is exactly the CI/demo-safe path."""

from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.agent.graph import agent  # noqa: E402
from app.agent.state import new_state  # noqa: E402
from app.services import blockchain, simulator  # noqa: E402
from app.services.llm import parse_with_rules  # noqa: E402

USER = "0x70997970C51812dc3A010C7d01b50e0d17dc79C8"


def run(text: str):
    return agent.invoke(new_state(text, USER))


class TestRuleParser:
    def test_reads_amount_asset_risk_and_horizon(self):
        parsed = parse_with_rules("I have 100 BOT and want low risk yield for 30 days")
        assert parsed.amount == 100
        assert parsed.asset == "BOT"
        assert parsed.goal == "yield"
        assert parsed.risk_tolerance == "low"
        assert parsed.time_horizon == "short"
        assert parsed.confidence >= 0.9

    def test_ignores_percentages_and_durations_when_finding_the_amount(self):
        parsed = parse_with_rules("Earn 8% APY on 250 BOT over 30 days")
        assert parsed.amount == 250

    def test_reads_k_suffix(self):
        assert parse_with_rules("stake 1.5k BOT aggressively").amount == 1500

    def test_flags_high_risk_wording(self):
        parsed = parse_with_rules("max yield on 40 BOT, I don't care about risk")
        assert parsed.risk_tolerance == "high"

    def test_non_defi_request_scores_low(self):
        parsed = parse_with_rules("Buy me a pizza")
        assert parsed.goal == "unknown"
        assert parsed.confidence < 0.35


class TestGraph:
    def test_happy_path_produces_a_recommendation_and_simulation(self):
        result = run("Earn yield on 50 BOT with low risk for 30 days")

        assert result["error"] is None
        assert result["selected_strategy"] is not None
        assert result["simulation"].horizon_days == 30
        assert result["simulation"].projected_return > 0
        assert result["trace"]

    def test_low_risk_mandate_excludes_higher_risk_venues(self):
        result = run("Earn yield on 50 BOT with low risk")
        assert all(s.risk_score <= 3 for s in result["strategies"])
        assert result["selected_strategy"].risk_score <= 3

    def test_high_risk_mandate_opens_the_band_and_picks_the_higher_apy(self):
        result = run("Maximum yield on 50 BOT, aggressive, I want the highest APY")
        assert max(s.risk_score for s in result["strategies"]) > 3
        assert result["selected_strategy"].projected_apy >= 12

    def test_long_horizon_extends_the_simulation_window(self):
        result = run("Earn yield on 50 BOT with low risk for 2 years")
        assert result["simulation"].horizon_days == 365

    def test_it_reports_what_it_refused_and_why(self):
        result = run("Earn yield on 50 BOT with low risk")
        rejected = result["excluded"]

        assert [s.name for s in rejected] == ["BOTLend Supply Market"]
        assert rejected[0].projected_apy > result["selected_strategy"].projected_apy
        assert any("excluded BOTLend" in line for line in result["trace"])

    def test_an_aggressive_mandate_refuses_nothing(self):
        assert run("Maximum yield on 50 BOT, aggressive")["excluded"] == []

    def test_nonsense_is_rejected_with_a_usable_message(self):
        result = run("Buy me a pizza")
        assert result["error"]
        assert "DeFi" in result["error"]
        assert result["selected_strategy"] is None

    def test_missing_amount_asks_for_one(self):
        result = run("earn some yield on BOT please")
        assert result["error"]
        assert "How much" in result["error"]

    def test_unreachable_gate_falls_back_to_requiring_a_signature(self):
        """ApprovalGate's own default is "ask me" for any user who has not called setConfig, and
        an unreachable gate must not be more permissive than the contract it stands in for —
        promising auto-execution here produces a transaction that reverts with ApprovalRequired."""
        for amount in ("25", "500"):
            result = run(f"Earn yield on {amount} BOT with low risk")
            assert result["requires_approval"] is True
            assert result["threshold_configured"] is False
            assert any("approval gate" in line for line in result["trace"])


class TestSimulator:
    def test_ranking_is_risk_adjusted_for_a_cautious_user(self):
        options, _ = blockchain.fetch_strategies()
        ranked = simulator.rank(options, "low")
        assert ranked[0].risk_score == 3  # 8.5% at risk 3 beats 12.4% at risk 5

    def test_ranking_prefers_raw_apy_for_an_aggressive_user(self):
        options, _ = blockchain.fetch_strategies()
        ranked = simulator.rank(options, "high")
        assert ranked[0].projected_apy == 12.4

    def test_projection_nets_off_gas_and_impermanent_loss(self):
        options, _ = blockchain.fetch_strategies()
        strategy = options[1]  # risk 5 -> 2% IL haircut
        sim = simulator.simulate_strategy(strategy, 100, 30)

        gross = 100 * ((1 + 0.124 / 365) ** 30 - 1)
        assert sim.projected_return < gross
        assert sim.gas_cost_bot > 0
        assert sim.worst_case_return < sim.projected_return
        assert sim.net_apr < strategy.projected_apy


class TestChainEncoding:
    def test_intent_hash_is_canonical_and_order_independent(self):
        a = blockchain.intent_hash({"user": "0xabc", "amount_wei": "1", "strategy_id": 0})
        b = blockchain.intent_hash({"strategy_id": 0, "amount_wei": "1", "user": "0xabc"})
        assert a == b
        assert a.startswith("0x") and len(a) == 66

    def test_intent_hash_changes_with_the_payload(self):
        a = blockchain.intent_hash({"amount_wei": "1"})
        b = blockchain.intent_hash({"amount_wei": "2"})
        assert a != b

    def test_deposit_calldata_matches_the_mock_venue_signature(self):
        token = "0x5FbDB2315678afecb367f032d93F642f64180aa3"
        data = blockchain.encode_deposit_calldata(token, 10**18)
        # keccak("deposit(address,uint256)")[:4]
        assert data.startswith("0x47e7ef24")
        assert data[34:74].lower() == token[2:].lower()
        assert len(data) == 2 + 8 + 64 * 2

    def test_wei_conversion_round_trips(self):
        assert blockchain.from_wei(blockchain.to_wei(12.5, 18), 18) == 12.5
