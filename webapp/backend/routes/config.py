from __future__ import annotations

from typing import Any

from fastapi import APIRouter, HTTPException

from webapp.backend import workbench_config

router = APIRouter(prefix="/api/config", tags=["config"])

_SAFE_KEYS = {
    "llm_provider",
    "deep_think_llm",
    "quick_think_llm",
    "backend_url",
    "temperature",
    "max_debate_rounds",
    "max_risk_discuss_rounds",
    "analyst_concurrency_limit",
    "checkpoint_enabled",
    "memory_log_path",
    "news_article_limit",
    "global_news_article_limit",
    "global_news_lookback_days",
    "data_vendors",
    "tool_vendors",
    "benchmark_ticker",
    "benchmark_map",
    "output_language",
    "google_thinking_level",
    "openai_reasoning_effort",
    "anthropic_effort",
}


def _safe_defaults() -> dict[str, Any]:
    from tradingagents.default_config import DEFAULT_CONFIG

    return {k: v for k, v in DEFAULT_CONFIG.items() if k in _SAFE_KEYS}


def _public(merged: dict[str, Any]) -> dict[str, Any]:
    """Build the client-facing config, never exposing raw secrets.

    `api_keys` is replaced by `api_keys_set` — a list of provider ids that
    have a key stored — so the UI can show "configured" without the value
    ever reaching the browser.
    """
    out = {**_safe_defaults(), **merged}
    keys = out.pop("api_keys", None)
    out["api_keys_set"] = sorted(keys.keys()) if isinstance(keys, dict) else []
    return out


@router.get("")
def get_config() -> dict[str, Any]:
    return _public(workbench_config.load())


@router.put("")
def put_config(updates: dict[str, Any]) -> dict[str, Any]:
    try:
        merged = workbench_config.save(updates)
    except workbench_config.InvalidConfigKey as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    return _public(merged)
