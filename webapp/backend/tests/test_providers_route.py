import pytest
from httpx import ASGITransport, AsyncClient

from webapp.backend import workbench_config
from webapp.backend.main import create_app


@pytest.mark.asyncio
async def test_provider_health_reports_each_provider(tmp_path, monkeypatch):
    # Isolate from any real ~/.tradingagents/webapp/config.json so stored keys
    # don't bleed into the env-var assertions below.
    monkeypatch.setattr(workbench_config, "_config_path", lambda: tmp_path / "none.json")
    monkeypatch.delenv("OPENAI_API_KEY", raising=False)
    monkeypatch.setenv("ANTHROPIC_API_KEY", "x")

    app = create_app()
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        resp = await c.get("/api/providers/health")
        assert resp.status_code == 200
        items = {p["id"]: p for p in resp.json()["providers"]}
        assert items["openai"]["configured"] is False
        assert items["anthropic"]["configured"] is True
        # ollama has empty env_key — always configured
        assert items["ollama"]["configured"] is True


@pytest.mark.asyncio
async def test_provider_health_exposes_yaml_metadata():
    app = create_app()
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        items = {p["id"]: p for p in (await c.get("/api/providers/health")).json()["providers"]}
        assert items["deepseek"]["default_base_url"] == "https://api.deepseek.com"
        assert items["qwen"]["default_base_url"].startswith("https://dashscope-intl")
        assert items["openai"]["default_base_url"] is None
