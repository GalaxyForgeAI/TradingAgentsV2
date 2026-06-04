from __future__ import annotations

import os

from fastapi import APIRouter

router = APIRouter(prefix="/api/providers", tags=["providers"])

PROVIDERS: list[tuple[str, str, str]] = [
    ("openai", "OpenAI", "OPENAI_API_KEY"),
    ("anthropic", "Anthropic", "ANTHROPIC_API_KEY"),
    ("google", "Google", "GOOGLE_API_KEY"),
    ("xai", "xAI", "XAI_API_KEY"),
    ("deepseek", "DeepSeek", "DEEPSEEK_API_KEY"),
    ("qwen", "Qwen", "DASHSCOPE_API_KEY"),
    ("qwen-cn", "Qwen (CN)", "DASHSCOPE_CN_API_KEY"),
    ("glm", "GLM", "ZHIPU_API_KEY"),
    ("glm-cn", "GLM (CN)", "ZHIPU_CN_API_KEY"),
    ("minimax", "MiniMax", "MINIMAX_API_KEY"),
    ("minimax-cn", "MiniMax (CN)", "MINIMAX_CN_API_KEY"),
    ("openrouter", "OpenRouter", "OPENROUTER_API_KEY"),
    ("ollama", "Ollama", ""),
]


@router.get("/health")
def health() -> dict:
    items = []
    for pid, label, env_key in PROVIDERS:
        configured = pid == "ollama" or bool(env_key and os.environ.get(env_key))
        items.append({"id": pid, "label": label, "env_key": env_key, "configured": configured})
    return {"providers": items}
