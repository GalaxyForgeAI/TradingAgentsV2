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


@router.get("")
def get_config() -> dict[str, Any]:
    return {**_safe_defaults(), **workbench_config.load()}


@router.put("")
def put_config(updates: dict[str, Any]) -> dict[str, Any]:
    try:
        merged = workbench_config.save(updates)
    except workbench_config.InvalidConfigKey as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    return {**_safe_defaults(), **merged}
