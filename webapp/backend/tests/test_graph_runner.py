import pytest

from webapp.backend.graph_runner import GraphRunner
from webapp.backend.run_registry import RunRegistry
from webapp.backend.schemas import EventType, RunRequest


@pytest.mark.asyncio
async def test_runner_publishes_full_lifecycle(stub_graph):
    registry = RunRegistry()
    runner = GraphRunner(registry=registry, graph_factory=lambda req, callbacks: stub_graph)
    req = RunRequest(ticker="AAPL", trade_date="2026-01-15")

    run_id = await runner.start(req)
    await runner.wait(run_id)

    state = registry.get(run_id)
    types = [e.type for e in state.buffer]
    assert EventType.RUN_STARTED in types
    assert EventType.RUN_DONE in types
    assert state.completed is True
    assert stub_graph.calls == [("AAPL", "2026-01-15")]


@pytest.mark.asyncio
async def test_runner_emits_error_when_graph_raises(stub_graph):
    class BrokenGraph(type(stub_graph)):
        def stream(self, ticker, trade_date):
            yield {"company_of_interest": ticker, "trade_date": trade_date}
            raise RuntimeError("boom")

    registry = RunRegistry()
    runner = GraphRunner(registry=registry, graph_factory=lambda req, callbacks: BrokenGraph())
    req = RunRequest(ticker="AAPL", trade_date="2026-01-15")
    run_id = await runner.start(req)
    await runner.wait(run_id)

    state = registry.get(run_id)
    err_events = [e for e in state.buffer if e.type == EventType.RUN_ERROR]
    assert len(err_events) == 1
    assert "boom" in err_events[0].payload["message"]


@pytest.mark.asyncio
async def test_metrics_tick_reflects_llm_stats():
    """The stats callback wired into the factory must be the same one the
    StreamAdapter reads, so metrics.tick carries real LLM/token counts."""

    class CountingGraph:
        def __init__(self, callbacks):
            # The runner passes the shared StatsCallbackHandler list here.
            self._stats = callbacks[0]

        def stream(self, ticker, trade_date):
            yield {"company_of_interest": ticker, "trade_date": trade_date}
            self._stats.on_chat_model_start({}, [])
            self._stats.tokens_in += 200
            self._stats.tokens_out += 75
            yield {"market_report": "x"}
            yield {"final_trade_decision": "BUY"}

    registry = RunRegistry()
    runner = GraphRunner(
        registry=registry,
        graph_factory=lambda req, callbacks: CountingGraph(callbacks),
    )
    req = RunRequest(ticker="AAPL", trade_date="2026-01-15")

    run_id = await runner.start(req)
    await runner.wait(run_id)

    ticks = [e for e in registry.get(run_id).buffer if e.type == EventType.METRICS_TICK]
    assert ticks, "expected at least one metrics.tick event"
    last = ticks[-1]
    assert last.payload["llm_calls"] == 1
    assert last.payload["tokens_in"] == 200
    assert last.payload["tokens_out"] == 75


@pytest.mark.asyncio
async def test_errored_run_has_no_run_done(stub_graph):
    class BrokenGraph(type(stub_graph)):
        def stream(self, ticker, trade_date):
            yield {"company_of_interest": ticker, "trade_date": trade_date}
            raise RuntimeError("boom")

    registry = RunRegistry()
    runner = GraphRunner(registry=registry, graph_factory=lambda req, callbacks: BrokenGraph())
    req = RunRequest(ticker="AAPL", trade_date="2026-01-15")
    run_id = await runner.start(req)
    await runner.wait(run_id)
    types = [e.type for e in registry.get(run_id).buffer]
    assert EventType.RUN_ERROR in types
    assert EventType.RUN_DONE not in types
