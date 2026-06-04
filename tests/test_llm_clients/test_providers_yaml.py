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


def test_create_llm_client_routes_to_openai_for_compatible(monkeypatch):
    from tradingagents.llm_clients import factory

    seen = {}

    class Stub:
        def __init__(self, model, base_url, **kw):
            seen["model"] = model
            seen["base_url"] = base_url
            seen["provider"] = kw.get("provider")

    _providers.cache_clear()
    monkeypatch.setattr(
        "tradingagents.llm_clients.openai_client.OpenAIClient", Stub
    )
    factory.create_llm_client("xai", "grok-4", base_url="https://corp/proxy")
    assert seen["model"] == "grok-4"
    assert seen["base_url"] == "https://corp/proxy"
    assert seen["provider"] == "xai"


def test_create_llm_client_falls_back_to_default_base_url(monkeypatch):
    from tradingagents.llm_clients import factory

    seen = {}

    class Stub:
        def __init__(self, model, base_url, **kw):
            seen["base_url"] = base_url

    _providers.cache_clear()
    monkeypatch.setattr(
        "tradingagents.llm_clients.openai_client.OpenAIClient", Stub
    )
    factory.create_llm_client("deepseek", "deepseek-chat")
    assert seen["base_url"] == "https://api.deepseek.com"


def test_create_llm_client_unknown_provider_raises():
    from tradingagents.llm_clients.factory import create_llm_client

    with pytest.raises(ValueError, match="Unsupported"):
        create_llm_client("nonesuch", "model")
