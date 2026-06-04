import pytest
from httpx import ASGITransport, AsyncClient

from webapp.backend.main import create_app


@pytest.mark.asyncio
async def test_get_config_returns_defaults():
    app = create_app()
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        resp = await client.get("/api/config")
        assert resp.status_code == 200
        body = resp.json()
        assert "llm_provider" in body
        assert "max_debate_rounds" in body
