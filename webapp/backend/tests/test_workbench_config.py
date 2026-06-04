import json
from pathlib import Path

import pytest

from webapp.backend import workbench_config


def test_load_returns_empty_when_file_missing(tmp_path, monkeypatch):
    monkeypatch.setattr(workbench_config, "_config_path", lambda: tmp_path / "missing.json")
    assert workbench_config.load() == {}


def test_save_atomic_and_round_trip(tmp_path, monkeypatch):
    path = tmp_path / "config.json"
    monkeypatch.setattr(workbench_config, "_config_path", lambda: path)
    out = workbench_config.save({"llm_provider": "qwen", "backend_url": "https://q/v1"})
    assert out["llm_provider"] == "qwen"
    assert json.loads(path.read_text())["backend_url"] == "https://q/v1"
    assert workbench_config.load() == out


def test_save_rejects_unknown_key(tmp_path, monkeypatch):
    monkeypatch.setattr(workbench_config, "_config_path", lambda: tmp_path / "c.json")
    with pytest.raises(workbench_config.InvalidConfigKey):
        workbench_config.save({"secret_thing": "x"})


def test_save_filters_through_whitelist(tmp_path, monkeypatch):
    path = tmp_path / "c.json"
    monkeypatch.setattr(workbench_config, "_config_path", lambda: path)
    # mixing an allowed and a disallowed key still rejects atomically
    with pytest.raises(workbench_config.InvalidConfigKey):
        workbench_config.save({"llm_provider": "openai", "evil": "x"})
    assert not path.exists()


def test_save_merges_with_existing(tmp_path, monkeypatch):
    path = tmp_path / "c.json"
    monkeypatch.setattr(workbench_config, "_config_path", lambda: path)
    workbench_config.save({"llm_provider": "qwen"})
    workbench_config.save({"output_language": "Chinese"})
    merged = workbench_config.load()
    assert merged == {"llm_provider": "qwen", "output_language": "Chinese"}


def test_default_path_uses_TRADINGAGENTS_CACHE_DIR(monkeypatch, tmp_path):
    monkeypatch.setenv("TRADINGAGENTS_CACHE_DIR", str(tmp_path))
    assert workbench_config._default_path().is_relative_to(tmp_path)
