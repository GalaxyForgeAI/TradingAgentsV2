from __future__ import annotations

import asyncio
import os
import time

from fastapi import APIRouter
from pydantic import BaseModel

from tradingagents.llm_clients.factory import get_providers
from webapp.backend import workbench_config

router = APIRouter(prefix="/api/providers", tags=["providers"])


@router.get("/health")
def health() -> dict:
    stored = workbench_config.get_api_keys()
    items = []
    for meta in get_providers():
        configured = (
            (not meta.env_key)
            or bool(os.environ.get(meta.env_key))
            or bool(stored.get(meta.id))
        )
        items.append({
            "id": meta.id,
            "label": meta.label,
            "env_key": meta.env_key,
            "configured": configured,
            "default_base_url": meta.default_base_url,
            "openai_compatible": meta.openai_compatible,
            "default_deep_model": meta.default_deep_model,
            "default_quick_model": meta.default_quick_model,
        })
    return {"providers": items}


class ProviderTestRequest(BaseModel):
    provider: str
    model: str | None = None
    backend_url: str | None = None


def _probe(provider: str, model: str | None, backend_url: str | None) -> tuple[bool, str]:
    """Make one tiny LLM call to verify provider/model/base_url/key work.

    Never raises — failures come back as (False, reason).
    """
    try:
        from tradingagents.llm_clients.factory import create_llm_client

        metas = {m.id: m for m in get_providers()}
        meta = metas.get(provider)
        if meta is None:
            return False, f"Unknown provider: {provider}"

        # A UI-stored key is injected into the env the client reads from.
        stored = workbench_config.get_api_keys().get(provider)
        if meta.env_key and stored:
            os.environ[meta.env_key] = stored

        use_model = model or meta.default_quick_model or meta.default_deep_model
        if not use_model:
            return False, "No model specified and the provider has no default."

        base = (backend_url or "").rstrip("/") or None
        llm = create_llm_client(provider, use_model, base).get_llm()
        resp = llm.invoke("Reply with the single word: ok")
        text = getattr(resp, "content", resp)
        if not isinstance(text, str):
            text = str(text)
        return True, text.strip()[:200] or "(empty response)"
    except Exception as exc:  # noqa: BLE001 — report any failure verbatim
        return False, f"{type(exc).__name__}: {exc}"[:400]


@router.post("/test")
async def test_provider(req: ProviderTestRequest) -> dict:
    """Probe connectivity for a provider with a minimal LLM call (30s cap)."""
    start = time.monotonic()
    try:
        ok, message = await asyncio.wait_for(
            asyncio.to_thread(_probe, req.provider, req.model, req.backend_url),
            timeout=30,
        )
    except asyncio.TimeoutError:
        return {"ok": False, "message": "Timed out after 30s", "latency_ms": 30000}
    return {"ok": ok, "message": message, "latency_ms": int((time.monotonic() - start) * 1000)}
