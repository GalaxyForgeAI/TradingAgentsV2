from __future__ import annotations

import json
import logging
import os
import re
from typing import Any

from fastapi import APIRouter, HTTPException, Request
from sse_starlette.sse import EventSourceResponse

from webapp.backend import workbench_config
from webapp.backend.graph_runner import GraphRunner
from webapp.backend.run_registry import RunRegistry
from webapp.backend.schemas import RunRequest

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/runs", tags=["runs"])

_registry = RunRegistry()

_CRYPTO_RE = re.compile(r"-USDT?$", re.IGNORECASE)


class _StreamingGraph:
    """Adapter exposing ``stream(ticker, trade_date)`` over a real
    ``TradingAgentsGraph``.

    The engine has no top-level ``stream`` method; the live run path is
    ``graph.graph.stream(init_state, **args)`` with ``stream_mode="values"``
    (see ``TradingAgentsGraph._run_graph``). This wrapper replicates that —
    building the initial state with memory + instrument context, attaching the
    callbacks, yielding each full-state chunk for SSE, and persisting the
    decision to the memory log on completion so the run shows up in history.
    """

    def __init__(self, ta: Any, callbacks: list[Any]):
        self._ta = ta
        self._callbacks = callbacks or []

    def stream(self, ticker: str, trade_date: str):
        ta = self._ta
        asset_type = "crypto" if _CRYPTO_RE.search(ticker) else "stock"
        ta.ticker = ticker
        past_context = ta.memory_log.get_past_context(ticker)
        instrument_context = ta.resolve_instrument_context(ticker, asset_type)
        init_state = ta.propagator.create_initial_state(
            ticker,
            trade_date,
            asset_type=asset_type,
            past_context=past_context,
            instrument_context=instrument_context,
        )
        args = ta.propagator.get_graph_args(callbacks=self._callbacks)

        final_state: dict[str, Any] = {}
        for chunk in ta.graph.stream(init_state, **args):
            if isinstance(chunk, dict):
                final_state = chunk
            yield chunk

        # Best-effort: persist the decision so the run lands in the decision
        # log / history. Never let bookkeeping failures break the stream.
        try:
            decision = final_state.get("final_trade_decision")
            if decision:
                ta.curr_state = final_state
                ta._log_state(trade_date, final_state)
                ta.memory_log.store_decision(
                    ticker=ticker,
                    trade_date=trade_date,
                    final_trade_decision=decision,
                )
        except Exception:  # noqa: BLE001
            logger.exception("post-run bookkeeping failed for %s %s", ticker, trade_date)


def _graph_factory(req: RunRequest, callbacks: list[Any] | None = None) -> Any:
    """Default factory; overridden in tests."""
    from tradingagents.default_config import DEFAULT_CONFIG
    from tradingagents.graph.trading_graph import TradingAgentsGraph
    from tradingagents.llm_clients.factory import get_providers

    # If the user saved an API key for this provider in the workbench Settings
    # (rather than via an env var), inject it into the process environment so
    # the engine's per-provider client picks it up.
    stored_keys = workbench_config.get_api_keys()
    if stored_keys:
        meta = next((m for m in get_providers() if m.id == req.llm_provider), None)
        if meta and meta.env_key and stored_keys.get(req.llm_provider):
            os.environ[meta.env_key] = stored_keys[req.llm_provider]

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

    ta = TradingAgentsGraph(
        selected_analysts=req.analysts,
        debug=False,
        config=config,
        callbacks=callbacks or [],
    )
    return _StreamingGraph(ta, callbacks or [])


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
