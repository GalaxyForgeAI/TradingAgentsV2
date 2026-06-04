import pytest
from pydantic import ValidationError

from webapp.backend.schemas import (
    AgentName,
    AgentStatePayload,
    EventEnvelope,
    EventType,
    RunRequest,
)


def test_run_request_minimal_defaults():
    req = RunRequest(ticker="AAPL", trade_date="2026-01-15")
    assert req.ticker == "AAPL"
    assert req.analysts == ["market", "social", "news", "fundamentals"]
    assert req.max_debate_rounds >= 1


def test_run_request_rejects_empty_ticker():
    with pytest.raises(ValidationError):
        RunRequest(ticker="", trade_date="2026-01-15")


def test_event_envelope_round_trip():
    payload = AgentStatePayload(agent=AgentName.MARKET_ANALYST, status="running")
    evt = EventEnvelope(id=1, type=EventType.AGENT_STATE, run_id="r1", payload=payload.model_dump())
    dumped = evt.model_dump_json()
    parsed = EventEnvelope.model_validate_json(dumped)
    assert parsed.type == EventType.AGENT_STATE
    assert parsed.payload["agent"] == "market_analyst"
