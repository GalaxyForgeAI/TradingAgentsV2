from __future__ import annotations

import pytest


class StubGraph:
    """Mimics TradingAgentsGraph for tests; yields scripted chunks."""

    def __init__(self, chunks: list[dict] | None = None, decision: str = "BUY") -> None:
        self.chunks = chunks or [
            {"company_of_interest": "AAPL", "trade_date": "2026-01-15"},
            {"market_report": "# Market\nGood"},
            {"final_trade_decision": "BUY"},
        ]
        self.decision = decision
        self.calls: list[tuple[str, str]] = []

    def stream(self, ticker: str, trade_date: str):
        self.calls.append((ticker, trade_date))
        for c in self.chunks:
            yield c


@pytest.fixture
def stub_graph() -> StubGraph:
    return StubGraph()
