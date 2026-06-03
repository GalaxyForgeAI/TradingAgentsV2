import textwrap
from pathlib import Path

import pytest
from httpx import ASGITransport, AsyncClient

from webapp.backend.main import create_app
from webapp.backend.routes import memory as memory_route


@pytest.mark.asyncio
async def test_history_returns_entries(tmp_path: Path, monkeypatch):
    log = tmp_path / "trading_memory.md"
    log.write_text(
        textwrap.dedent(
            """
            [2026-01-15 | AAPL | BUY | +2.3% | +1.5% | 5d]

            DECISION:
            BUY AAPL at open.

            REFLECTION:
            Earnings beat carried it.

            <!-- ENTRY_END -->
            """
        ).strip()
    )
    monkeypatch.setattr(memory_route, "_log_path", lambda: log)

    app = create_app()
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        resp = await client.get("/api/runs?source=memory")
        assert resp.status_code == 200
        entries = resp.json()["entries"]
        assert len(entries) == 1
        assert entries[0]["ticker"] == "AAPL"
        assert entries[0]["rating"] == "BUY"
