from webapp.backend.schemas import EventType
from webapp.backend.streaming import StreamAdapter


def test_first_chunk_emits_run_started():
    a = StreamAdapter(run_id="r1")
    events = a.translate({"company_of_interest": "AAPL", "trade_date": "2026-01-15"})
    assert events[0].type == EventType.RUN_STARTED
    assert events[0].payload["ticker"] == "AAPL"


def test_new_report_field_emits_agent_report_and_done_state():
    a = StreamAdapter(run_id="r1")
    a.translate({"company_of_interest": "AAPL", "trade_date": "2026-01-15"})
    events = a.translate({"market_report": "# header\nbody"})
    types = [e.type for e in events]
    assert EventType.AGENT_REPORT in types
    assert EventType.AGENT_STATE in types
    report = next(e for e in events if e.type == EventType.AGENT_REPORT)
    assert report.payload["field"] == "market_report"


def test_debate_history_growth_emits_debate_messages():
    a = StreamAdapter(run_id="r1")
    a.translate({"company_of_interest": "AAPL", "trade_date": "2026-01-15"})
    a.translate({"investment_debate_state": {"bull_history": "B1", "bear_history": "", "count": 1}})
    events = a.translate({"investment_debate_state": {"bull_history": "B1\nB2", "bear_history": "BR1", "count": 3}})
    types = [e.type for e in events]
    assert types.count(EventType.DEBATE_MESSAGE) == 2


def test_event_ids_are_monotonic():
    a = StreamAdapter(run_id="r1")
    e1 = a.translate({"company_of_interest": "AAPL", "trade_date": "2026-01-15"})
    e2 = a.translate({"market_report": "x"})
    ids = [e.id for e in e1 + e2]
    assert ids == sorted(ids)
    assert ids[0] == 1


def test_multiline_debate_message_keeps_single_round():
    a = StreamAdapter(run_id="r1")
    a.translate({"company_of_interest": "AAPL", "trade_date": "2026-01-15"})
    events = a.translate({"investment_debate_state": {"bull_history": "line1\nline2\nline3", "bear_history": "", "count": 0}})
    from webapp.backend.schemas import EventType
    rounds = [e.payload["round"] for e in events if e.type == EventType.DEBATE_MESSAGE]
    assert rounds == [1, 1, 1]
