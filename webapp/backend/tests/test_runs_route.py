import asyncio
import json

import pytest
from httpx import ASGITransport, AsyncClient

from webapp.backend.main import create_app
from webapp.backend.routes import runs as runs_route


@pytest.mark.asyncio
async def test_post_run_returns_run_id_and_stream_completes(stub_graph, monkeypatch):
    monkeypatch.setattr(runs_route, "_graph_factory", lambda req, callbacks=None: stub_graph)
    app = create_app()

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        resp = await client.post("/api/runs", json={"ticker": "AAPL", "trade_date": "2026-01-15"})
        assert resp.status_code == 201
        run_id = resp.json()["run_id"]
        assert run_id

        # SSE stream
        async with client.stream("GET", f"/api/runs/{run_id}/stream") as r:
            events: list[dict] = []
            async for line in r.aiter_lines():
                if line.startswith("data: "):
                    events.append(json.loads(line[6:]))
                if events and events[-1]["type"] == "run.done":
                    break

        types = [e["type"] for e in events]
        assert "run.started" in types
        assert "run.done" in types


@pytest.mark.asyncio
async def test_invalid_ticker_rejected():
    app = create_app()
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        resp = await client.post("/api/runs", json={"ticker": "", "trade_date": "2026-01-15"})
        assert resp.status_code == 422
