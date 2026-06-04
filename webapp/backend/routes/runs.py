from __future__ import annotations

import json
from typing import Any

from fastapi import APIRouter, HTTPException, Request
from sse_starlette.sse import EventSourceResponse

from webapp.backend.graph_runner import GraphRunner
from webapp.backend.run_registry import RunRegistry
from webapp.backend.schemas import RunRequest

router = APIRouter(prefix="/api/runs", tags=["runs"])

_registry = RunRegistry()


def _graph_factory(req: RunRequest, callbacks: list[Any] | None = None) -> Any:
    """Default factory; overridden in tests."""
    from tradingagents.default_config import DEFAULT_CONFIG
    from tradingagents.graph.trading_graph import TradingAgentsGraph

    config = DEFAULT_CONFIG.copy()
    if req.deep_think_llm:
        config["deep_think_llm"] = req.deep_think_llm
    if req.quick_think_llm:
        config["quick_think_llm"] = req.quick_think_llm
    if req.temperature is not None:
        config["temperature"] = req.temperature
    if req.backend_url is not None:
        config["backend_url"] = str(req.backend_url).rstrip("/")
    config["llm_provider"] = req.llm_provider
    config["max_debate_rounds"] = req.max_debate_rounds
    config["max_risk_discuss_rounds"] = req.max_risk_discuss_rounds
    config["checkpoint_enabled"] = req.checkpoint_enabled
    config["output_language"] = req.output_language

    return TradingAgentsGraph(
        selected_analysts=req.analysts,
        debug=False,
        config=config,
        callbacks=callbacks or [],
    )


_runner = GraphRunner(
    _registry, graph_factory=lambda req, callbacks: _graph_factory(req, callbacks)
)


@router.post("", status_code=201)
async def create_run(req: RunRequest) -> dict[str, str]:
    run_id = await _runner.start(req)
    return {"run_id": run_id}


@router.get("/{run_id}/stream")
async def stream_run(run_id: str, request: Request) -> EventSourceResponse:
    last_event_id = request.headers.get("last-event-id")
    last_id = int(last_event_id) if last_event_id and last_event_id.isdigit() else None
    try:
        _registry.get(run_id)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail="unknown run") from exc

    async def event_gen():
        async for evt in _registry.subscribe(run_id, last_event_id=last_id):
            yield {
                "id": str(evt.id),
                "event": evt.type.value,
                "data": json.dumps(
                    {
                        "id": evt.id,
                        "type": evt.type.value,
                        "run_id": evt.run_id,
                        "ts": evt.ts.isoformat(),
                        "payload": evt.payload,
                    }
                ),
            }

    return EventSourceResponse(event_gen())


@router.post("/{run_id}/cancel")
def cancel_run(run_id: str) -> dict[str, bool]:
    return {"cancelled": _runner.cancel(run_id)}
