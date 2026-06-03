import pytest

from webapp.backend.graph_runner import GraphRunner
from webapp.backend.run_registry import RunRegistry
from webapp.backend.schemas import EventType, RunRequest


@pytest.mark.asyncio
async def test_runner_publishes_full_lifecycle(stub_graph):
    registry = RunRegistry()
    runner = GraphRunner(registry=registry, graph_factory=lambda req: stub_graph)
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
    runner = GraphRunner(registry=registry, graph_factory=lambda req: BrokenGraph())
    req = RunRequest(ticker="AAPL", trade_date="2026-01-15")
    run_id = await runner.start(req)
    await runner.wait(run_id)

    state = registry.get(run_id)
    err_events = [e for e in state.buffer if e.type == EventType.RUN_ERROR]
    assert len(err_events) == 1
    assert "boom" in err_events[0].payload["message"]
