import pytest
from httpx import ASGITransport, AsyncClient

from webapp.backend.main import create_app


@pytest.mark.asyncio
async def test_provider_health_reports_each_provider(monkeypatch):
    monkeypatch.delenv("OPENAI_API_KEY", raising=False)
    monkeypatch.setenv("ANTHROPIC_API_KEY", "x")

    app = create_app()
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        resp = await client.get("/api/providers/health")
        assert resp.status_code == 200
        body = resp.json()
        providers = {p["id"]: p for p in body["providers"]}
        assert providers["openai"]["configured"] is False
        assert providers["anthropic"]["configured"] is True
