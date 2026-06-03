from __future__ import annotations

import time
from typing import Any

from webapp.backend.schemas import (
    AgentName,
    EventEnvelope,
    EventType,
)

REPORT_TO_AGENT: dict[str, AgentName] = {
    "market_report": AgentName.MARKET_ANALYST,
    "sentiment_report": AgentName.SOCIAL_ANALYST,
    "news_report": AgentName.NEWS_ANALYST,
    "fundamentals_report": AgentName.FUNDAMENTALS_ANALYST,
    "investment_plan": AgentName.RESEARCH_MANAGER,
    "trader_investment_plan": AgentName.TRADER,
    "final_trade_decision": AgentName.PORTFOLIO_MANAGER,
}


def _split_lines(prev: str, curr: str) -> list[str]:
    if not curr:
        return []
    if not prev:
        return [line for line in curr.splitlines() if line.strip()]
    if curr.startswith(prev):
        delta = curr[len(prev) :]
        return [line for line in delta.splitlines() if line.strip()]
    return [line for line in curr.splitlines() if line.strip()]


class StreamAdapter:
    def __init__(self, run_id: str) -> None:
        self._run_id = run_id
        self._next_id = 1
        self._started = False
        self._started_at = time.monotonic()
        self._prev: dict[str, Any] = {}

    def _next(self, event_type: EventType, payload: dict[str, Any]) -> EventEnvelope:
        evt = EventEnvelope(id=self._next_id, type=event_type, run_id=self._run_id, payload=payload)
        self._next_id += 1
        return evt

    def translate(self, chunk: dict[str, Any]) -> list[EventEnvelope]:
        events: list[EventEnvelope] = []
        if not self._started:
            events.append(
                self._next(
                    EventType.RUN_STARTED,
                    {
                        "ticker": chunk.get("company_of_interest", ""),
                        "trade_date": chunk.get("trade_date", ""),
                    },
                )
            )
            self._started = True

        for field, agent in REPORT_TO_AGENT.items():
            if field in chunk and chunk[field] and chunk[field] != self._prev.get(field):
                events.append(
                    self._next(
                        EventType.AGENT_REPORT,
                        {"field": field, "markdown": chunk[field]},
                    )
                )
                events.append(
                    self._next(
                        EventType.AGENT_STATE,
                        {"agent": agent.value, "status": "done"},
                    )
                )

        debate = chunk.get("investment_debate_state")
        if isinstance(debate, dict):
            prev_debate = self._prev.get("investment_debate_state", {}) or {}
            for side, key in (("bull", "bull_history"), ("bear", "bear_history")):
                new_lines = _split_lines(prev_debate.get(key, ""), debate.get(key, ""))
                for i, line in enumerate(new_lines):
                    events.append(
                        self._next(
                            EventType.DEBATE_MESSAGE,
                            {
                                "side": side,
                                "round": int(debate.get("count", 0)) // 2 + i + 1,
                                "text": line,
                            },
                        )
                    )

        risk = chunk.get("risk_debate_state")
        if isinstance(risk, dict):
            prev_risk = self._prev.get("risk_debate_state", {}) or {}
            for side, key in (
                ("aggressive", "risky_history"),
                ("conservative", "safe_history"),
                ("neutral", "neutral_history"),
            ):
                new_lines = _split_lines(prev_risk.get(key, ""), risk.get(key, ""))
                for i, line in enumerate(new_lines):
                    events.append(
                        self._next(
                            EventType.DEBATE_MESSAGE,
                            {
                                "side": side,
                                "round": int(risk.get("count", 0)) // 3 + i + 1,
                                "text": line,
                            },
                        )
                    )

        events.append(
            self._next(
                EventType.METRICS_TICK,
                {"elapsed_ms": int((time.monotonic() - self._started_at) * 1000)},
            )
        )

        self._prev = {**self._prev, **chunk}
        return events

    def final(self, decision: str, rating: str | None) -> EventEnvelope:
        return self._next(
            EventType.RUN_DONE,
            {
                "decision": decision,
                "rating": rating,
                "duration_ms": int((time.monotonic() - self._started_at) * 1000),
            },
        )

    def error(self, message: str, stack: str | None = None) -> EventEnvelope:
        return self._next(EventType.RUN_ERROR, {"message": message, "stack": stack})
