"""LLM client factory — provider metadata is loaded from providers.yaml."""

from __future__ import annotations

from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path
from typing import Optional

import yaml

from .base_client import BaseLLMClient


_PROVIDERS_PATH = Path(__file__).parent / "providers.yaml"
_VALID_HETERO_CLIENTS = {"anthropic", "google", "azure"}


@dataclass(frozen=True)
class ProviderMeta:
    id: str
    label: str
    env_key: str
    openai_compatible: bool
    default_base_url: Optional[str] = None
    client: Optional[str] = None
    default_deep_model: Optional[str] = None
    default_quick_model: Optional[str] = None


class ProviderConfigError(RuntimeError):
    """Raised when providers.yaml is malformed."""


@lru_cache(maxsize=1)
def _providers() -> dict[str, ProviderMeta]:
    try:
        rows = yaml.safe_load(_PROVIDERS_PATH.read_text()) or []
    except yaml.YAMLError as exc:
        raise ProviderConfigError(f"Failed to parse {_PROVIDERS_PATH}: {exc}") from exc
    seen: dict[str, ProviderMeta] = {}
    for r in rows:
        try:
            meta = ProviderMeta(**r)
        except TypeError as exc:
            raise ProviderConfigError(f"Invalid provider row {r!r}: {exc}") from exc
        if meta.id in seen:
            raise ProviderConfigError(f"Duplicate provider id: {meta.id}")
        if not meta.openai_compatible and meta.client not in _VALID_HETERO_CLIENTS:
            raise ProviderConfigError(
                f"Provider {meta.id}: invalid client={meta.client!r}"
            )
        seen[meta.id] = meta
    if not seen:
        raise ProviderConfigError(f"No providers defined in {_PROVIDERS_PATH}")
    return seen


def get_providers() -> list[ProviderMeta]:
    """Public read-only view; used by both the engine and the web backend."""
    return list(_providers().values())


def create_llm_client(
    provider: str,
    model: str,
    base_url: Optional[str] = None,
    **kwargs,
) -> BaseLLMClient:
    """Create an LLM client for the specified provider.

    Provider dispatch is driven by providers.yaml. Heavy SDKs are imported
    lazily so simply importing this factory does not pull them in.

    Args:
        provider: provider id (case-insensitive) — must match an entry in providers.yaml
        model: model name/identifier
        base_url: explicit base URL; when None, the provider's default_base_url applies

    Raises:
        ValueError: if the provider id is unknown
        ProviderConfigError: if providers.yaml is malformed
    """
    meta = _providers().get(provider.lower())
    if meta is None:
        raise ValueError(f"Unsupported LLM provider: {provider}")
    base = base_url or meta.default_base_url

    if meta.openai_compatible:
        from .openai_client import OpenAIClient
        return OpenAIClient(model, base, provider=meta.id, **kwargs)
    if meta.client == "anthropic":
        from .anthropic_client import AnthropicClient
        return AnthropicClient(model, base, **kwargs)
    if meta.client == "google":
        from .google_client import GoogleClient
        return GoogleClient(model, base, **kwargs)
    if meta.client == "azure":
        from .azure_client import AzureOpenAIClient
        return AzureOpenAIClient(model, base, **kwargs)
    raise ProviderConfigError(
        f"Unreachable: provider {meta.id} validated but no client matched"
    )
