import pytest

from tradingagents.llm_clients.factory import (
    ProviderConfigError,
    ProviderMeta,
    get_providers,
    _providers,
)


def test_providers_yaml_loads_at_least_one_openai_compatible():
    _providers.cache_clear()
    metas = {m.id: m for m in get_providers()}
    assert "openai" in metas
    assert metas["openai"].openai_compatible is True
    assert metas["openai"].env_key == "OPENAI_API_KEY"


def test_providers_yaml_includes_heterogeneous_clients():
    _providers.cache_clear()
    metas = {m.id: m for m in get_providers()}
    assert metas["anthropic"].openai_compatible is False
    assert metas["anthropic"].client == "anthropic"
    assert metas["google"].client == "google"
    assert metas["azure"].client == "azure"


def test_provider_meta_is_immutable():
    m = ProviderMeta(id="x", label="X", env_key="K", openai_compatible=True)
    with pytest.raises(Exception):
        m.id = "y"  # type: ignore[misc]


def test_duplicate_ids_raise(tmp_path, monkeypatch):
    bad = tmp_path / "providers.yaml"
    bad.write_text(
        "- id: a\n  label: A\n  env_key: K\n  openai_compatible: true\n"
        "- id: a\n  label: A\n  env_key: K\n  openai_compatible: true\n"
    )
    from tradingagents.llm_clients import factory

    _providers.cache_clear()
    monkeypatch.setattr(factory, "_PROVIDERS_PATH", bad)
    with pytest.raises(ProviderConfigError):
        get_providers()
    _providers.cache_clear()


def test_invalid_client_value_raises(tmp_path, monkeypatch):
    bad = tmp_path / "providers.yaml"
    bad.write_text(
        "- id: weird\n  label: W\n  env_key: K\n  openai_compatible: false\n  client: nope\n"
    )
    from tradingagents.llm_clients import factory

    _providers.cache_clear()
    monkeypatch.setattr(factory, "_PROVIDERS_PATH", bad)
    with pytest.raises(ProviderConfigError):
        get_providers()
    _providers.cache_clear()
