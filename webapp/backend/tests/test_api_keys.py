import json
import stat

import pytest
from httpx import ASGITransport, AsyncClient

from webapp.backend import workbench_config
from webapp.backend.main import create_app


def test_save_api_keys_nested_merge_and_clear(tmp_path, monkeypatch):
    path = tmp_path / "c.json"
    monkeypatch.setattr(workbench_config, "_config_path", lambda: path)

    workbench_config.save({"api_keys": {"openai": "sk-A"}})
    workbench_config.save({"api_keys": {"qwen": "sk-B"}})
    assert workbench_config.get_api_keys() == {"openai": "sk-A", "qwen": "sk-B"}

    # Blank value clears just that provider, leaving the others intact.
    workbench_config.save({"api_keys": {"openai": ""}})
    assert workbench_config.get_api_keys() == {"qwen": "sk-B"}


def test_config_file_is_owner_only(tmp_path, monkeypatch):
    path = tmp_path / "c.json"
    monkeypatch.setattr(workbench_config, "_config_path", lambda: path)
    workbench_config.save({"api_keys": {"openai": "sk-secret"}})
    mode = stat.S_IMODE(path.stat().st_mode)
    assert mode == 0o600


@pytest.mark.asyncio
async def test_put_api_key_then_get_never_leaks_value(tmp_path, monkeypatch):
    path = tmp_path / "c.json"
    monkeypatch.setattr(workbench_config, "_config_path", lambda: path)
    app = create_app()
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        resp = await c.put("/api/config", json={"api_keys": {"openai": "sk-topsecret"}})
        assert resp.status_code == 200
        body = resp.json()
        assert "api_keys" not in body
        assert body["api_keys_set"] == ["openai"]

        got = (await c.get("/api/config")).json()
        assert "api_keys" not in got
        assert got["api_keys_set"] == ["openai"]
        # The raw secret must never appear anywhere in the serialized response.
        assert "sk-topsecret" not in json.dumps(got)

    # It is, however, persisted on disk for the engine to use.
    assert workbench_config.get_api_keys()["openai"] == "sk-topsecret"


@pytest.mark.asyncio
async def test_provider_health_configured_via_stored_key(tmp_path, monkeypatch):
    path = tmp_path / "c.json"
    monkeypatch.setattr(workbench_config, "_config_path", lambda: path)
    monkeypatch.delenv("DEEPSEEK_API_KEY", raising=False)
    workbench_config.save({"api_keys": {"deepseek": "sk-ds"}})

    app = create_app()
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        items = {p["id"]: p for p in (await c.get("/api/providers/health")).json()["providers"]}
        assert items["deepseek"]["configured"] is True
