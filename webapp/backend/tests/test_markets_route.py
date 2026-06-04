from datetime import datetime, timedelta

import pandas as pd
import pytest
from httpx import ASGITransport, AsyncClient

from webapp.backend.main import create_app
from webapp.backend.routes import markets as markets_route


@pytest.mark.asyncio
async def test_markets_returns_bars(monkeypatch):
    dates = pd.date_range(end=datetime.today(), periods=5)
    df = pd.DataFrame(
        {
            "Open": [1, 2, 3, 4, 5],
            "High": [2, 3, 4, 5, 6],
            "Low": [0.5, 1.5, 2.5, 3.5, 4.5],
            "Close": [1.5, 2.5, 3.5, 4.5, 5.5],
            "Volume": [100, 100, 100, 100, 100],
        },
        index=dates,
    )

    monkeypatch.setattr(markets_route, "_fetch_ohlc", lambda ticker, period: df)

    app = create_app()
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        resp = await client.get("/api/markets/AAPL?range=5d")
        assert resp.status_code == 200
        body = resp.json()
        assert body["ticker"] == "AAPL"
        assert len(body["bars"]) == 5
        assert {"t", "o", "h", "l", "c", "v"} <= set(body["bars"][0].keys())


@pytest.mark.asyncio
async def test_markets_rejects_bad_ticker():
    app = create_app()
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        resp = await client.get("/api/markets/..%2F..%2Fetc")
        assert resp.status_code in (400, 404)
