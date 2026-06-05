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


def _ai_message_result(tokens_in: int, tokens_out: int):
    from langchain_core.messages import AIMessage
    from langchain_core.outputs import ChatGeneration, LLMResult

    message = AIMessage(
        content="ok",
        usage_metadata={
            "input_tokens": tokens_in,
            "output_tokens": tokens_out,
            "total_tokens": tokens_in + tokens_out,
        },
    )
    return LLMResult(generations=[[ChatGeneration(message=message)]])


def test_metrics_tick_reflects_running_stats():
    from cli.stats_handler import StatsCallbackHandler

    stats = StatsCallbackHandler()
    a = StreamAdapter(run_id="r1", stats=stats)

    # First tick: no LLM activity yet.
    first = a.translate({"company_of_interest": "AAPL", "trade_date": "2026-01-15"})
    first_tick = next(e for e in first if e.type == EventType.METRICS_TICK)
    assert first_tick.payload["llm_calls"] == 0
    assert first_tick.payload["tokens_in"] == 0
    assert first_tick.payload["tokens_out"] == 0

    # Simulate one LLM call with token usage between ticks.
    stats.on_chat_model_start({}, [])
    stats.on_llm_end(_ai_message_result(tokens_in=120, tokens_out=40))

    second = a.translate({"market_report": "x"})
    second_tick = next(e for e in second if e.type == EventType.METRICS_TICK)
    assert second_tick.payload["llm_calls"] == 1
    assert second_tick.payload["tokens_in"] == 120
    assert second_tick.payload["tokens_out"] == 40


def test_metrics_tick_defaults_to_zero_without_stats():
    a = StreamAdapter(run_id="r1")
    events = a.translate({"company_of_interest": "AAPL", "trade_date": "2026-01-15"})
    tick = next(e for e in events if e.type == EventType.METRICS_TICK)
    assert tick.payload["llm_calls"] == 0
    assert tick.payload["tokens_in"] == 0
    assert tick.payload["tokens_out"] == 0


def test_risk_debate_uses_real_state_keys():
    """Risk debate must read aggressive/conservative/neutral_history — the keys
    the real AgentState uses (regression: previously read risky/safe_history)."""
    a = StreamAdapter(run_id="r1")
    a.translate({"company_of_interest": "AAPL", "trade_date": "2026-01-15"})
    events = a.translate(
        {
            "risk_debate_state": {
                "aggressive_history": "go big",
                "conservative_history": "be careful",
                "neutral_history": "balance it",
                "count": 0,
            }
        }
    )
    msgs = [e for e in events if e.type == EventType.DEBATE_MESSAGE]
    sides = {m.payload["side"]: m.payload["text"] for m in msgs}
    assert sides == {
        "aggressive": "go big",
        "conservative": "be careful",
        "neutral": "balance it",
    }
