"""LangGraph workflow.

    parse -> strategize -> simulate -> gate -> plan -> END
      |            |
      +------------+---> END   (conditional: stop as soon as a node sets `error`)

The graph holds no memory between calls. All durable truth — positions, approvals, executed intent
hashes — lives on-chain, which is what lets the backend restart mid-demo without losing anything.
"""

from __future__ import annotations

from langgraph.graph import END, StateGraph

from app.agent.nodes import approval_gate, build_plan, fetch_strategies, parse_intent, simulate
from app.agent.state import IntentFlowState


def _continue_or_stop(state: IntentFlowState) -> str:
    return "stop" if state.get("error") else "continue"


def create_workflow():
    workflow = StateGraph(IntentFlowState)

    workflow.add_node("parse", parse_intent)
    workflow.add_node("strategize", fetch_strategies)
    workflow.add_node("simulate", simulate)
    workflow.add_node("gate", approval_gate)
    workflow.add_node("plan", build_plan)

    workflow.set_entry_point("parse")
    workflow.add_conditional_edges(
        "parse", _continue_or_stop, {"continue": "strategize", "stop": END}
    )
    workflow.add_conditional_edges(
        "strategize", _continue_or_stop, {"continue": "simulate", "stop": END}
    )
    workflow.add_edge("simulate", "gate")
    workflow.add_edge("gate", "plan")
    workflow.add_edge("plan", END)

    return workflow.compile()


agent = create_workflow()
