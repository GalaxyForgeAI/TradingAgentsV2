import pytest
from httpx import ASGITransport, AsyncClient

from webapp.backend.main import create_app
from webapp.backend import workbench_config


@pytest.mark.asyncio
async def test_get_config_returns_defaults():
    app = create_app()
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        resp = await c.get("/api/config")
        assert resp.status_code == 200
        body = resp.json()
        assert "llm_provider" in body
        assert "max_debate_rounds" in body


@pytest.mark.asyncio
async def test_get_config_merges_workbench_overrides(tmp_path, monkeypatch):
    monkeypatch.setattr(workbench_config, "_config_path", lambda: tmp_path / "c.json")
    workbench_config.save({"output_language": "Chinese", "backend_url": "https://proxy/v1"})
    app = create_app()
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        body = (await c.get("/api/config")).json()
        assert body["output_language"] == "Chinese"
        assert body["backend_url"] == "https://proxy/v1"


@pytest.mark.asyncio
async def test_put_config_persists_whitelisted_keys(tmp_path, monkeypatch):
    monkeypatch.setattr(workbench_config, "_config_path", lambda: tmp_path / "c.json")
    app = create_app()
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        resp = await c.put("/api/config", json={"llm_provider": "qwen"})
        assert resp.status_code == 200
        body = (await c.get("/api/config")).json()
        assert body["llm_provider"] == "qwen"


@pytest.mark.asyncio
async def test_put_config_rejects_unknown_keys(tmp_path, monkeypatch):
    monkeypatch.setattr(workbench_config, "_config_path", lambda: tmp_path / "c.json")
    app = create_app()
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        resp = await c.put("/api/config", json={"max_debate_rounds": 5})
        assert resp.status_code == 422
