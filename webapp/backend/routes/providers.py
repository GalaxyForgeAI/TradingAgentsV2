from __future__ import annotations

import os

from fastapi import APIRouter

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
