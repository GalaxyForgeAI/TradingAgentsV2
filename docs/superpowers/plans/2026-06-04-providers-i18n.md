# Providers / api_base / UI i18n Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move the LLM provider list to a YAML data source (single truth for engine + web), expose `backend_url` and `output_language` through the Web schema + wizard + persisted Settings, and add Simplified Chinese UI localization via `next-intl` (cookie-driven, no URL changes).

**Architecture:** Engine and web backend both read `tradingagents/llm_clients/providers.yaml` via `factory.get_providers()` — there is no second list anywhere. A new `webapp/backend/workbench_config.py` persists user defaults to `~/.tradingagents/webapp/config.json` (atomic writes, whitelist), surfaced through `GET/PUT /api/config`. The frontend uses `next-intl` with cookie + `Accept-Language` resolution (no URL prefix); all visible strings live in `messages/{en,zh}.json` and are accessed via `t("namespace.key")`. Output language (agents) and UI language (chrome) stay strictly independent.

**Tech Stack:** Python 3.10+ · pydantic v2 · PyYAML · FastAPI · pytest · Next.js 15 · `next-intl` · TypeScript · Tailwind v4 · vitest.

---

## File Structure

### Engine

```
tradingagents/llm_clients/
├── providers.yaml          NEW  — provider metadata (id/label/env_key/openai_compatible/client/default_base_url/default_*_model)
└── factory.py              MODIFIED — load YAML, validate, dispatch via meta
tests/test_llm_clients/
├── __init__.py             NEW
└── test_providers_yaml.py  NEW
```

### Backend

```
webapp/backend/
├── workbench_config.py     NEW — atomic JSON persistence at ~/.tradingagents/webapp/config.json
├── schemas.py              MODIFIED — RunRequest.backend_url: HttpUrl | None
├── routes/
│   ├── runs.py             MODIFIED — pass req.backend_url into config
│   ├── providers.py        MODIFIED — read from factory.get_providers()
│   └── config.py           MODIFIED — GET merges defaults + overrides, PUT writes overrides
└── tests/
    ├── test_workbench_config.py    NEW
    ├── test_providers_route.py     MODIFIED
    ├── test_config_route.py        MODIFIED
    └── test_runs_route.py          MODIFIED (add backend_url passthrough)
```

### Frontend

```
webapp/frontend/
├── i18n/
│   ├── request.ts          NEW — next-intl getRequestConfig (cookie + Accept-Language)
│   ├── locales.ts          NEW — LOCALES = ["en","zh"], LocaleType, helpers
│   └── messages/
│       ├── en.json         NEW
│       └── zh.json         NEW
├── middleware.ts           NEW — sets NEXT_LOCALE cookie on first visit
├── next.config.mjs         MODIFIED — wrap with createNextIntlPlugin
├── lib/
│   ├── types.ts            MODIFIED — RunRequest gets backend_url; export Locale
│   ├── api.ts              MODIFIED — putConfig(updates)
│   └── format.ts           MODIFIED — pct/elapsed/date take locale
├── stores/
│   └── (no change)
├── components/features/
│   ├── nav.tsx                     MODIFIED — t(), LanguageSwitcher mounted
│   ├── language-switcher.tsx       NEW
│   ├── run-card.tsx                MODIFIED — t()
│   ├── debate-bubbles.tsx          MODIFIED — t() for round labels
│   ├── decision-card.tsx           MODIFIED — t()
│   ├── metrics-panel.tsx           MODIFIED — t()
│   ├── tool-log.tsx                MODIFIED — t()
│   ├── pipeline-stepper.tsx        MODIFIED — t() for group labels
│   └── markdown.tsx                (no change)
├── app/
│   ├── layout.tsx                  MODIFIED — wrap in NextIntlClientProvider, html lang
│   ├── page.tsx                    MODIFIED — t.rich() landing
│   ├── dashboard/page.tsx          MODIFIED — t()
│   ├── runs/new/page.tsx           MODIFIED — t(); add API base + language fields; defaults from /api/config
│   ├── runs/page.tsx               MODIFIED — t()
│   ├── runs/[runId]/page.tsx       MODIFIED — t()
│   ├── markets/[ticker]/page.tsx   MODIFIED — t()
│   ├── compare/page.tsx            MODIFIED — t()
│   └── settings/page.tsx           MODIFIED — controlled form, PUT /api/config, LanguageSwitcher card
├── scripts/
│   └── check-messages.ts   NEW — assert en/zh key parity (run via tsx)
└── package.json            MODIFIED — add next-intl, tsx (devDep)
```

### Docs

```
docs/superpowers/specs/
└── 2026-06-04-glossary.md  NEW — EN ↔ 中文 translation glossary
webapp/
├── README.md               MODIFIED — note new env vars / endpoints / locale
└── README.zh-CN.md         MODIFIED — same
```

---

## Phase 1 — Providers YAML (single source of truth)

### Task 1.1: Add PyYAML check + scaffold tests dir

PyYAML is already in the env (`yaml 6.0.3`). Add the test package marker and confirm.

**Files:**
- Create: `tests/test_llm_clients/__init__.py`

- [ ] **Step 1: Create the empty package file**

`tests/test_llm_clients/__init__.py`: empty.

- [ ] **Step 2: Verify pytest discovers it**

```bash
pytest --collect-only -q tests/test_llm_clients 2>&1 | tail -3
```
Expected: `no tests collected` (the dir exists but has no test modules yet) — no errors.

- [ ] **Step 3: Commit**

```bash
git add tests/test_llm_clients/__init__.py
git commit -m "test: scaffold tests/test_llm_clients package"
```

### Task 1.2: providers.yaml + ProviderMeta dataclass (TDD)

**Files:**
- Create: `tradingagents/llm_clients/providers.yaml`
- Modify: `tradingagents/llm_clients/factory.py`
- Create: `tests/test_llm_clients/test_providers_yaml.py`

- [ ] **Step 1: Write the failing test**

`tests/test_llm_clients/test_providers_yaml.py`:

```python
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
```

- [ ] **Step 2: Run the test (expect ImportError on `ProviderMeta`)**

```bash
pytest tests/test_llm_clients/test_providers_yaml.py -v
```
Expected: ImportError.

- [ ] **Step 3: Create providers.yaml**

`tradingagents/llm_clients/providers.yaml`:

```yaml
- id: openai
  label: OpenAI
  env_key: OPENAI_API_KEY
  openai_compatible: true
  default_base_url: null
  default_deep_model: gpt-5.5
  default_quick_model: gpt-5.4-mini

- id: anthropic
  label: Anthropic
  env_key: ANTHROPIC_API_KEY
  openai_compatible: false
  client: anthropic

- id: google
  label: Google
  env_key: GOOGLE_API_KEY
  openai_compatible: false
  client: google

- id: azure
  label: Azure OpenAI
  env_key: AZURE_OPENAI_API_KEY
  openai_compatible: false
  client: azure

- id: xai
  label: xAI
  env_key: XAI_API_KEY
  openai_compatible: true

- id: deepseek
  label: DeepSeek
  env_key: DEEPSEEK_API_KEY
  openai_compatible: true
  default_base_url: https://api.deepseek.com

- id: qwen
  label: Qwen (International)
  env_key: DASHSCOPE_API_KEY
  openai_compatible: true
  default_base_url: https://dashscope-intl.aliyuncs.com/compatible-mode/v1

- id: qwen-cn
  label: Qwen (China)
  env_key: DASHSCOPE_CN_API_KEY
  openai_compatible: true
  default_base_url: https://dashscope.aliyuncs.com/compatible-mode/v1

- id: glm
  label: GLM (Z.AI international)
  env_key: ZHIPU_API_KEY
  openai_compatible: true
  default_base_url: https://api.z.ai/api/paas/v4

- id: glm-cn
  label: GLM (China)
  env_key: ZHIPU_CN_API_KEY
  openai_compatible: true
  default_base_url: https://open.bigmodel.cn/api/paas/v4

- id: minimax
  label: MiniMax (Global)
  env_key: MINIMAX_API_KEY
  openai_compatible: true
  default_base_url: https://api.minimax.io/v1

- id: minimax-cn
  label: MiniMax (China)
  env_key: MINIMAX_CN_API_KEY
  openai_compatible: true
  default_base_url: https://api.minimaxi.com/v1

- id: openrouter
  label: OpenRouter
  env_key: OPENROUTER_API_KEY
  openai_compatible: true
  default_base_url: https://openrouter.ai/api/v1

- id: ollama
  label: Ollama (local)
  env_key: ""
  openai_compatible: true
  default_base_url: http://localhost:11434/v1
```

- [ ] **Step 4: Refactor factory.py — add ProviderMeta + loader, KEEP existing create_llm_client behavior**

Read the current `tradingagents/llm_clients/factory.py`. Replace the entire file with:

```python
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
```

- [ ] **Step 5: Run the YAML tests (expect pass)**

```bash
pytest tests/test_llm_clients/test_providers_yaml.py -v
```
Expected: 5 passed.

- [ ] **Step 6: Run the FULL test suite to check for regressions**

```bash
pytest -q
```
Expected: 0 new failures vs baseline. The old `_OPENAI_COMPATIBLE` tuple is gone, so any test referencing it directly would fail — search and fix:

```bash
grep -rn "_OPENAI_COMPATIBLE" tradingagents/ tests/ webapp/ 2>/dev/null
```
Expected: no matches (the tuple was internal to factory.py).

- [ ] **Step 7: Commit**

```bash
git add tradingagents/llm_clients/providers.yaml tradingagents/llm_clients/factory.py tests/test_llm_clients/test_providers_yaml.py
git commit -m "feat(engine): YAML-driven provider registry (single source for engine + web)"
```

### Task 1.3: Dispatch coverage tests

**Files:**
- Modify: `tests/test_llm_clients/test_providers_yaml.py`

- [ ] **Step 1: Add dispatch tests**

Append to `tests/test_llm_clients/test_providers_yaml.py`:

```python
def test_create_llm_client_routes_to_openai_for_compatible(monkeypatch):
    from tradingagents.llm_clients import factory

    seen = {}

    class Stub:
        def __init__(self, model, base_url, **kw):
            seen["model"] = model
            seen["base_url"] = base_url
            seen["provider"] = kw.get("provider")

    monkeypatch.setattr(factory, "_providers", lambda: factory._providers.__wrapped__())
    factory._providers.cache_clear()
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

    factory._providers.cache_clear()
    monkeypatch.setattr(
        "tradingagents.llm_clients.openai_client.OpenAIClient", Stub
    )
    factory.create_llm_client("deepseek", "deepseek-chat")
    assert seen["base_url"] == "https://api.deepseek.com"


def test_create_llm_client_unknown_provider_raises():
    from tradingagents.llm_clients.factory import create_llm_client

    with pytest.raises(ValueError, match="Unsupported"):
        create_llm_client("nonesuch", "model")
```

- [ ] **Step 2: Run**

```bash
pytest tests/test_llm_clients/test_providers_yaml.py -v
```
Expected: all pass (8 total now).

- [ ] **Step 3: Commit**

```bash
git add tests/test_llm_clients/test_providers_yaml.py
git commit -m "test(engine): dispatch + default base_url coverage"
```

---

## Phase 2 — Workbench config persistence

### Task 2.1: workbench_config module (TDD)

**Files:**
- Create: `webapp/backend/workbench_config.py`
- Create: `webapp/backend/tests/test_workbench_config.py`

- [ ] **Step 1: Write the failing tests**

`webapp/backend/tests/test_workbench_config.py`:

```python
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
```

- [ ] **Step 2: Run (expect ImportError)**

```bash
pytest webapp/backend/tests/test_workbench_config.py -v
```
Expected: ImportError on `workbench_config`.

- [ ] **Step 3: Implement**

`webapp/backend/workbench_config.py`:

```python
"""Atomic JSON persistence for workbench user defaults.

This file is independent of DEFAULT_CONFIG: it only affects what the web
wizard prefills, not the engine or CLI. Allowed keys are constrained
via SAFE_KEYS.
"""

from __future__ import annotations

import json
import os
import tempfile
from pathlib import Path
from typing import Any


SAFE_KEYS = frozenset({
    "llm_provider",
    "deep_think_llm",
    "quick_think_llm",
    "backend_url",
    "temperature",
    "output_language",
})


class InvalidConfigKey(ValueError):
    """Raised when save() is given a key outside SAFE_KEYS."""


def _default_path() -> Path:
    base = os.environ.get("TRADINGAGENTS_CACHE_DIR")
    root = Path(base).expanduser() if base else Path.home() / ".tradingagents"
    return root / "webapp" / "config.json"


def _config_path() -> Path:
    """Indirection so tests can monkeypatch the location."""
    return _default_path()


def load() -> dict[str, Any]:
    path = _config_path()
    if not path.exists():
        return {}
    try:
        return json.loads(path.read_text())
    except json.JSONDecodeError:
        return {}


def save(updates: dict[str, Any]) -> dict[str, Any]:
    bad = set(updates.keys()) - SAFE_KEYS
    if bad:
        raise InvalidConfigKey(f"Unknown config keys: {sorted(bad)}")
    merged = {**load(), **updates}
    path = _config_path()
    path.parent.mkdir(parents=True, exist_ok=True)
    fd, tmp = tempfile.mkstemp(prefix=".config-", suffix=".tmp", dir=path.parent)
    try:
        with os.fdopen(fd, "w") as f:
            json.dump(merged, f, indent=2, sort_keys=True)
        os.replace(tmp, path)
    except Exception:
        try:
            os.unlink(tmp)
        except FileNotFoundError:
            pass
        raise
    return merged
```

- [ ] **Step 4: Run**

```bash
pytest webapp/backend/tests/test_workbench_config.py -v
```
Expected: 6 passed.

- [ ] **Step 5: Commit**

```bash
git add webapp/backend/workbench_config.py webapp/backend/tests/test_workbench_config.py
git commit -m "feat(backend): workbench_config — atomic JSON persistence for user defaults"
```

### Task 2.2: GET + PUT /api/config

**Files:**
- Modify: `webapp/backend/routes/config.py`
- Modify: `webapp/backend/tests/test_config_route.py`

- [ ] **Step 1: Extend the failing test**

Replace `webapp/backend/tests/test_config_route.py` with:

```python
import pytest
from httpx import ASGITransport, AsyncClient

from webapp.backend.main import create_app
from webapp.backend import workbench_config


@pytest.mark.asyncio
async def test_get_config_returns_defaults():
    app = create_app()
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        resp = await c.get("/api/config")
        assert resp.status_code == 200
        body = resp.json()
        assert "llm_provider" in body
        assert "max_debate_rounds" in body


@pytest.mark.asyncio
async def test_get_config_merges_workbench_overrides(tmp_path, monkeypatch):
    monkeypatch.setattr(workbench_config, "_config_path", lambda: tmp_path / "c.json")
    workbench_config.save({"output_language": "Chinese", "backend_url": "https://proxy/v1"})
    app = create_app()
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        body = (await c.get("/api/config")).json()
        assert body["output_language"] == "Chinese"
        assert body["backend_url"] == "https://proxy/v1"


@pytest.mark.asyncio
async def test_put_config_persists_whitelisted_keys(tmp_path, monkeypatch):
    monkeypatch.setattr(workbench_config, "_config_path", lambda: tmp_path / "c.json")
    app = create_app()
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        resp = await c.put("/api/config", json={"llm_provider": "qwen"})
        assert resp.status_code == 200
        body = (await c.get("/api/config")).json()
        assert body["llm_provider"] == "qwen"


@pytest.mark.asyncio
async def test_put_config_rejects_unknown_keys(tmp_path, monkeypatch):
    monkeypatch.setattr(workbench_config, "_config_path", lambda: tmp_path / "c.json")
    app = create_app()
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        resp = await c.put("/api/config", json={"max_debate_rounds": 5})
        assert resp.status_code == 422
```

- [ ] **Step 2: Run (3 of 4 should fail)**

```bash
pytest webapp/backend/tests/test_config_route.py -v
```

- [ ] **Step 3: Implement**

Replace `webapp/backend/routes/config.py`:

```python
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
```

- [ ] **Step 4: Run**

```bash
pytest webapp/backend/tests/test_config_route.py -v
```
Expected: 4 passed.

- [ ] **Step 5: Commit**

```bash
git add webapp/backend/routes/config.py webapp/backend/tests/test_config_route.py
git commit -m "feat(backend): PUT /api/config persists workbench user defaults"
```

### Task 2.3: providers route reads from factory.get_providers()

**Files:**
- Modify: `webapp/backend/routes/providers.py`
- Modify: `webapp/backend/tests/test_providers_route.py`

- [ ] **Step 1: Update the test (the existing one already asserts behavior; tighten it to YAML truth)**

Replace `webapp/backend/tests/test_providers_route.py`:

```python
import pytest
from httpx import ASGITransport, AsyncClient

from webapp.backend.main import create_app


@pytest.mark.asyncio
async def test_provider_health_reports_each_provider(monkeypatch):
    monkeypatch.delenv("OPENAI_API_KEY", raising=False)
    monkeypatch.setenv("ANTHROPIC_API_KEY", "x")

    app = create_app()
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        resp = await c.get("/api/providers/health")
        assert resp.status_code == 200
        items = {p["id"]: p for p in resp.json()["providers"]}
        assert items["openai"]["configured"] is False
        assert items["anthropic"]["configured"] is True
        # ollama has empty env_key — always configured
        assert items["ollama"]["configured"] is True


@pytest.mark.asyncio
async def test_provider_health_exposes_yaml_metadata():
    app = create_app()
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        items = {p["id"]: p for p in (await c.get("/api/providers/health")).json()["providers"]}
        assert items["deepseek"]["default_base_url"] == "https://api.deepseek.com"
        assert items["qwen"]["default_base_url"].startswith("https://dashscope-intl")
        assert items["openai"]["default_base_url"] is None
```

- [ ] **Step 2: Run (the metadata test should fail under the old hardcoded route)**

```bash
pytest webapp/backend/tests/test_providers_route.py -v
```

- [ ] **Step 3: Replace routes/providers.py**

`webapp/backend/routes/providers.py`:

```python
from __future__ import annotations

import os

from fastapi import APIRouter

from tradingagents.llm_clients.factory import get_providers

router = APIRouter(prefix="/api/providers", tags=["providers"])


@router.get("/health")
def health() -> dict:
    items = []
    for meta in get_providers():
        configured = (not meta.env_key) or bool(os.environ.get(meta.env_key))
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
```

- [ ] **Step 4: Run**

```bash
pytest webapp/backend/tests/test_providers_route.py -v
```
Expected: 2 passed.

- [ ] **Step 5: Run the full backend suite**

```bash
pytest webapp/backend -q
```
Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add webapp/backend/routes/providers.py webapp/backend/tests/test_providers_route.py
git commit -m "feat(backend): /api/providers/health reads from providers.yaml (single source)"
```

---

## Phase 3 — Expose backend_url through the run path

### Task 3.1: RunRequest schema + route wiring + tests

**Files:**
- Modify: `webapp/backend/schemas.py`
- Modify: `webapp/backend/routes/runs.py`
- Modify: `webapp/backend/tests/test_runs_route.py`

- [ ] **Step 1: Add a failing test**

In `webapp/backend/tests/test_runs_route.py`, append:

```python
@pytest.mark.asyncio
async def test_post_run_forwards_backend_url(stub_graph, monkeypatch):
    captured = {}

    def factory(req, callbacks=None):
        captured["backend_url"] = req.backend_url
        return stub_graph

    monkeypatch.setattr(runs_route, "_graph_factory", factory)
    app = create_app()
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        resp = await c.post(
            "/api/runs",
            json={
                "ticker": "AAPL",
                "trade_date": "2026-01-15",
                "backend_url": "https://corp.proxy/v1",
            },
        )
        assert resp.status_code == 201
        assert str(captured["backend_url"]).rstrip("/") == "https://corp.proxy/v1"


@pytest.mark.asyncio
async def test_post_run_rejects_invalid_backend_url():
    app = create_app()
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        resp = await c.post(
            "/api/runs",
            json={"ticker": "AAPL", "trade_date": "2026-01-15", "backend_url": "not-a-url"},
        )
        assert resp.status_code == 422
```

- [ ] **Step 2: Run (expect import + test failures because `backend_url` is unknown on RunRequest)**

```bash
pytest webapp/backend/tests/test_runs_route.py -v
```

- [ ] **Step 3: Add `backend_url` to RunRequest**

In `webapp/backend/schemas.py`, locate `class RunRequest(BaseModel):` and add the field next to `temperature`:

```python
    backend_url: AnyHttpUrl | None = None
```

At the top of the file, ensure `AnyHttpUrl` is imported from pydantic:

```python
from pydantic import AnyHttpUrl, BaseModel, Field, field_validator
```

- [ ] **Step 4: Pass it into config in routes/runs.py**

Open `webapp/backend/routes/runs.py`. Locate the `_graph_factory` function. After the existing `if req.temperature is not None:` block, add:

```python
    if req.backend_url is not None:
        config["backend_url"] = str(req.backend_url).rstrip("/")
```

- [ ] **Step 5: Run the run-route tests**

```bash
pytest webapp/backend/tests/test_runs_route.py -v
```
Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add webapp/backend/schemas.py webapp/backend/routes/runs.py webapp/backend/tests/test_runs_route.py
git commit -m "feat(backend): RunRequest.backend_url forwarded to engine config"
```

---

## Phase 4 — Wizard + Settings UX (English only for now)

### Task 4.1: Frontend types + putConfig

**Files:**
- Modify: `webapp/frontend/lib/types.ts`
- Modify: `webapp/frontend/lib/api.ts`

- [ ] **Step 1: Update types**

In `webapp/frontend/lib/types.ts`, locate `interface RunRequest` and add inside it (before the closing `}`):

```ts
  backend_url?: string | null;
```

Locate `interface ProviderHealth` and replace it with:

```ts
export interface ProviderHealth {
  id: string;
  label: string;
  env_key: string;
  configured: boolean;
  default_base_url: string | null;
  openai_compatible: boolean;
  default_deep_model: string | null;
  default_quick_model: string | null;
}
```

- [ ] **Step 2: Add putConfig to api client**

In `webapp/frontend/lib/api.ts`, inside the `export const api = { ... }` object, after `config: () => ...`, add:

```ts
  putConfig: (updates: Record<string, unknown>) =>
    json<Record<string, unknown>>("/api/config", { method: "PUT", body: JSON.stringify(updates) }),
```

- [ ] **Step 3: Confirm types compile**

```bash
cd webapp/frontend && npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add webapp/frontend/lib/types.ts webapp/frontend/lib/api.ts
git commit -m "feat(frontend): putConfig + ProviderHealth metadata fields"
```

### Task 4.2: Wizard — API base URL field, language dropdown, defaults from /api/config

**Files:**
- Modify: `webapp/frontend/app/runs/new/page.tsx`

- [ ] **Step 1: Read the current file**

Open `webapp/frontend/app/runs/new/page.tsx`. Note the current Step 3 (provider/models) and Step 4 (debate rounds/checkpoint).

- [ ] **Step 2: Replace the file**

Replace `webapp/frontend/app/runs/new/page.tsx` entirely with:

```tsx
"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { api } from "@/lib/api";
import type { ProviderHealth, RunRequest } from "@/lib/types";

const ANALYSTS = [
  { id: "market", label: "Market" },
  { id: "social", label: "Sentiment" },
  { id: "news", label: "News" },
  { id: "fundamentals", label: "Fundamentals" },
] as const;

const LANGUAGES = [
  { value: "English", label: "English" },
  { value: "Chinese", label: "Chinese (中文)" },
  { value: "Japanese", label: "Japanese (日本語)" },
];

export default function NewRun() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [providers, setProviders] = useState<ProviderHealth[]>([]);
  const [form, setForm] = useState<RunRequest>({
    ticker: "AAPL",
    trade_date: new Date().toISOString().slice(0, 10),
    analysts: ["market", "social", "news", "fundamentals"],
    llm_provider: "openai",
    max_debate_rounds: 1,
    max_risk_discuss_rounds: 1,
    output_language: "English",
  });
  const [customLang, setCustomLang] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Pull defaults from /api/config + provider list from /api/providers/health.
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [cfg, ph] = await Promise.all([api.config(), api.providers()]);
        if (!alive) return;
        setProviders(ph.providers);
        setForm((f) => ({
          ...f,
          llm_provider: (cfg.llm_provider as string) ?? f.llm_provider,
          deep_think_llm: (cfg.deep_think_llm as string) ?? f.deep_think_llm,
          quick_think_llm: (cfg.quick_think_llm as string) ?? f.quick_think_llm,
          temperature: cfg.temperature as number | undefined,
          backend_url: (cfg.backend_url as string | null) ?? null,
          output_language: (cfg.output_language as string) ?? "English",
        }));
      } catch {
        // fall through to hardcoded defaults
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const selectedProvider = useMemo(
    () => providers.find((p) => p.id === form.llm_provider),
    [providers, form.llm_provider],
  );

  async function submit() {
    setSubmitting(true);
    setError(null);
    try {
      const payload: RunRequest = {
        ...form,
        output_language:
          form.output_language === "__custom__" ? customLang || "English" : form.output_language,
        backend_url: form.backend_url ? form.backend_url.replace(/\/+$/, "") : null,
      };
      const { run_id } = await api.createRun(payload);
      router.push(`/runs/${run_id}`);
    } catch (e) {
      setError((e as Error).message);
      setSubmitting(false);
    }
  }

  return (
    <main className="mx-auto max-w-3xl p-8">
      <h1 className="mb-6 text-2xl font-semibold">New Analysis</h1>
      <div className="mb-6 flex gap-2">
        {[1, 2, 3, 4].map((n) => (
          <div
            key={n}
            className={`h-1 flex-1 rounded ${n <= step ? "bg-zinc-100" : "bg-zinc-800"}`}
          />
        ))}
      </div>

      {step === 1 && (
        <div className="space-y-4">
          <Field label="Ticker">
            <input
              value={form.ticker}
              onChange={(e) => setForm({ ...form, ticker: e.target.value })}
              className="w-full rounded border border-zinc-700 bg-zinc-950 px-3 py-2"
            />
          </Field>
          <Field label="Trade date">
            <input
              type="date"
              value={form.trade_date}
              onChange={(e) => setForm({ ...form, trade_date: e.target.value })}
              className="w-full rounded border border-zinc-700 bg-zinc-950 px-3 py-2"
            />
          </Field>
        </div>
      )}

      {step === 2 && (
        <div className="grid grid-cols-2 gap-3">
          {ANALYSTS.map((a) => {
            const on = form.analysts!.includes(a.id);
            return (
              <button
                key={a.id}
                type="button"
                onClick={() =>
                  setForm({
                    ...form,
                    analysts: on
                      ? form.analysts!.filter((x) => x !== a.id)
                      : [...form.analysts!, a.id],
                  })
                }
                className={`rounded-md border p-4 text-left ${
                  on ? "border-zinc-100 bg-zinc-900" : "border-zinc-800"
                }`}
              >
                <div className="font-medium">{a.label}</div>
              </button>
            );
          })}
        </div>
      )}

      {step === 3 && (
        <div className="space-y-4">
          <Field label="LLM provider">
            <select
              value={form.llm_provider}
              onChange={(e) => setForm({ ...form, llm_provider: e.target.value })}
              className="w-full rounded border border-zinc-700 bg-zinc-950 px-3 py-2"
            >
              {providers.map((p) => (
                <option key={p.id} value={p.id} disabled={!p.configured}>
                  {p.label}
                  {!p.configured ? " (missing key)" : ""}
                </option>
              ))}
            </select>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Deep think model (optional)">
              <input
                value={form.deep_think_llm ?? ""}
                placeholder={selectedProvider?.default_deep_model ?? ""}
                onChange={(e) =>
                  setForm({ ...form, deep_think_llm: e.target.value || undefined })
                }
                className="w-full rounded border border-zinc-700 bg-zinc-950 px-3 py-2"
              />
            </Field>
            <Field label="Quick think model (optional)">
              <input
                value={form.quick_think_llm ?? ""}
                placeholder={selectedProvider?.default_quick_model ?? ""}
                onChange={(e) =>
                  setForm({ ...form, quick_think_llm: e.target.value || undefined })
                }
                className="w-full rounded border border-zinc-700 bg-zinc-950 px-3 py-2"
              />
            </Field>
          </div>
          <Field label="API base URL (optional)">
            <input
              type="url"
              value={form.backend_url ?? ""}
              placeholder={selectedProvider?.default_base_url ?? "https://..."}
              onChange={(e) =>
                setForm({ ...form, backend_url: e.target.value || null })
              }
              className="w-full rounded border border-zinc-700 bg-zinc-950 px-3 py-2"
            />
          </Field>
        </div>
      )}

      {step === 4 && (
        <div className="space-y-4">
          <Field label={`Debate rounds: ${form.max_debate_rounds}`}>
            <input
              type="range"
              min={1}
              max={5}
              value={form.max_debate_rounds}
              onChange={(e) =>
                setForm({ ...form, max_debate_rounds: Number(e.target.value) })
              }
              className="w-full"
            />
          </Field>
          <Field label={`Risk debate rounds: ${form.max_risk_discuss_rounds}`}>
            <input
              type="range"
              min={1}
              max={5}
              value={form.max_risk_discuss_rounds}
              onChange={(e) =>
                setForm({ ...form, max_risk_discuss_rounds: Number(e.target.value) })
              }
              className="w-full"
            />
          </Field>
          <Field label="Output language (what the agents write in)">
            <select
              value={
                LANGUAGES.find((l) => l.value === form.output_language)
                  ? form.output_language
                  : "__custom__"
              }
              onChange={(e) => {
                const v = e.target.value;
                if (v === "__custom__") {
                  setCustomLang(form.output_language ?? "");
                  setForm({ ...form, output_language: "__custom__" });
                } else {
                  setForm({ ...form, output_language: v });
                }
              }}
              className="w-full rounded border border-zinc-700 bg-zinc-950 px-3 py-2"
            >
              {LANGUAGES.map((l) => (
                <option key={l.value} value={l.value}>
                  {l.label}
                </option>
              ))}
              <option value="__custom__">Custom…</option>
            </select>
          </Field>
          {form.output_language === "__custom__" && (
            <Field label="Custom language name">
              <input
                value={customLang}
                onChange={(e) => setCustomLang(e.target.value)}
                placeholder="e.g. Korean"
                className="w-full rounded border border-zinc-700 bg-zinc-950 px-3 py-2"
              />
            </Field>
          )}
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.checkpoint_enabled}
              onChange={(e) =>
                setForm({ ...form, checkpoint_enabled: e.target.checked })
              }
            />
            Enable checkpoint resume
          </label>
        </div>
      )}

      <div className="mt-8 flex items-center justify-between">
        <button
          type="button"
          onClick={() => setStep((s) => Math.max(1, s - 1))}
          disabled={step === 1}
          className="rounded border border-zinc-700 px-4 py-2 text-sm disabled:opacity-50"
        >
          Back
        </button>
        {step < 4 ? (
          <button
            type="button"
            onClick={() => setStep((s) => s + 1)}
            className="rounded bg-zinc-100 px-4 py-2 text-sm font-medium text-zinc-900"
          >
            Next
          </button>
        ) : (
          <button
            type="button"
            onClick={submit}
            disabled={submitting}
            className="rounded bg-emerald-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {submitting ? "Starting…" : "Start analysis"}
          </button>
        )}
      </div>
      {error && <div className="mt-4 text-sm text-red-500">{error}</div>}
    </main>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium">{label}</span>
      {children}
    </label>
  );
}
```

- [ ] **Step 3: Build to confirm**

```bash
cd webapp/frontend && npm run build 2>&1 | grep -E "Compiled|Failed|error" | head
```
Expected: `Compiled successfully`.

- [ ] **Step 4: Commit**

```bash
git add webapp/frontend/app/runs/new/page.tsx
git commit -m "feat(frontend): wizard reads /api/config defaults; adds API base + language fields"
```

### Task 4.3: Settings page — controlled form, PUT on save

**Files:**
- Modify: `webapp/frontend/app/settings/page.tsx`

- [ ] **Step 1: Replace the settings page**

Replace `webapp/frontend/app/settings/page.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";

import { api } from "@/lib/api";
import type { ProviderHealth } from "@/lib/types";

const SAFE_KEYS = [
  "llm_provider",
  "deep_think_llm",
  "quick_think_llm",
  "backend_url",
  "temperature",
  "output_language",
] as const;

type SafeKey = (typeof SAFE_KEYS)[number];

export default function Settings() {
  const [providers, setProviders] = useState<ProviderHealth[]>([]);
  const [form, setForm] = useState<Record<SafeKey, string>>({
    llm_provider: "openai",
    deep_think_llm: "",
    quick_think_llm: "",
    backend_url: "",
    temperature: "",
    output_language: "English",
  });
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      const [{ providers }, cfg] = await Promise.all([api.providers(), api.config()]);
      if (!alive) return;
      setProviders(providers);
      setForm({
        llm_provider: (cfg.llm_provider as string) ?? "openai",
        deep_think_llm: (cfg.deep_think_llm as string) ?? "",
        quick_think_llm: (cfg.quick_think_llm as string) ?? "",
        backend_url: (cfg.backend_url as string) ?? "",
        temperature: cfg.temperature == null ? "" : String(cfg.temperature),
        output_language: (cfg.output_language as string) ?? "English",
      });
    })();
    return () => {
      alive = false;
    };
  }, []);

  async function save() {
    setStatus("saving");
    setErr(null);
    const updates: Record<string, unknown> = {
      llm_provider: form.llm_provider,
      deep_think_llm: form.deep_think_llm || null,
      quick_think_llm: form.quick_think_llm || null,
      backend_url: form.backend_url ? form.backend_url.replace(/\/+$/, "") : null,
      temperature: form.temperature === "" ? null : Number(form.temperature),
      output_language: form.output_language,
    };
    try {
      await api.putConfig(updates);
      setStatus("saved");
      setTimeout(() => setStatus("idle"), 1500);
    } catch (e) {
      setStatus("error");
      setErr((e as Error).message);
    }
  }

  return (
    <main className="mx-auto max-w-3xl space-y-8 p-8">
      <h1 className="text-2xl font-semibold">Settings</h1>

      <section>
        <h2 className="mb-3 text-lg font-medium">Providers</h2>
        <ul className="space-y-1 text-sm">
          {providers.map((p) => (
            <li
              key={p.id}
              className="flex items-center justify-between rounded border border-zinc-800 px-3 py-2"
            >
              <span>{p.label}</span>
              <span className={p.configured ? "text-emerald-500" : "text-zinc-500"}>
                {p.configured ? "Configured" : "Missing key"}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-medium">Workbench defaults</h2>
        <p className="text-xs text-zinc-500">
          These prefill the New Analysis wizard. The wizard can still override them per run.
        </p>
        <FormRow label="LLM provider">
          <select
            value={form.llm_provider}
            onChange={(e) => setForm({ ...form, llm_provider: e.target.value })}
            className="w-full rounded border border-zinc-700 bg-zinc-950 px-3 py-2"
          >
            {providers.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>
        </FormRow>
        <div className="grid grid-cols-2 gap-3">
          <FormRow label="Deep think model">
            <input
              value={form.deep_think_llm}
              onChange={(e) => setForm({ ...form, deep_think_llm: e.target.value })}
              className="w-full rounded border border-zinc-700 bg-zinc-950 px-3 py-2"
            />
          </FormRow>
          <FormRow label="Quick think model">
            <input
              value={form.quick_think_llm}
              onChange={(e) => setForm({ ...form, quick_think_llm: e.target.value })}
              className="w-full rounded border border-zinc-700 bg-zinc-950 px-3 py-2"
            />
          </FormRow>
        </div>
        <FormRow label="API base URL">
          <input
            type="url"
            value={form.backend_url}
            placeholder="https://…"
            onChange={(e) => setForm({ ...form, backend_url: e.target.value })}
            className="w-full rounded border border-zinc-700 bg-zinc-950 px-3 py-2"
          />
        </FormRow>
        <FormRow label="Temperature">
          <input
            type="number"
            step={0.05}
            min={0}
            max={2}
            value={form.temperature}
            onChange={(e) => setForm({ ...form, temperature: e.target.value })}
            className="w-full rounded border border-zinc-700 bg-zinc-950 px-3 py-2"
          />
        </FormRow>
        <FormRow label="Output language (agent reports)">
          <input
            value={form.output_language}
            onChange={(e) => setForm({ ...form, output_language: e.target.value })}
            className="w-full rounded border border-zinc-700 bg-zinc-950 px-3 py-2"
          />
        </FormRow>
        <div className="flex items-center gap-3 pt-2">
          <button
            type="button"
            onClick={save}
            disabled={status === "saving"}
            className="rounded bg-emerald-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {status === "saving" ? "Saving…" : "Save defaults"}
          </button>
          {status === "saved" && <span className="text-sm text-emerald-500">Saved ✓</span>}
          {status === "error" && <span className="text-sm text-red-500">Error: {err}</span>}
        </div>
      </section>
    </main>
  );
}

function FormRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium">{label}</span>
      {children}
    </label>
  );
}
```

- [ ] **Step 2: Build**

```bash
cd webapp/frontend && npm run build 2>&1 | grep -E "Compiled|Failed|error" | head
```
Expected: `Compiled successfully`.

- [ ] **Step 3: Commit**

```bash
git add webapp/frontend/app/settings/page.tsx
git commit -m "feat(frontend): /settings controlled form persists defaults via PUT /api/config"
```

---

## Phase 5 — i18n: scaffolding (next-intl, cookie-based, no URL rewriting)

### Task 5.1: Install dependencies and write the glossary

**Files:**
- Modify: `webapp/frontend/package.json`
- Create: `docs/superpowers/specs/2026-06-04-glossary.md`

- [ ] **Step 1: Install next-intl + tsx**

```bash
cd webapp/frontend && npm install --legacy-peer-deps next-intl@3.26.0 && npm install --save-dev --legacy-peer-deps tsx@4.19.0
```
Expected: completes without errors.

- [ ] **Step 2: Write the glossary**

`docs/superpowers/specs/2026-06-04-glossary.md`:

```markdown
# Translation Glossary

| English | 中文 |
|---|---|
| Run | 运行 |
| Reflection | 复盘 |
| Pending reflection | 待复盘 |
| Raw return | 原始收益 |
| Alpha (α) | 超额收益 (α) |
| Benchmark | 基准 |
| Bull vs Bear | 多空辩论 |
| Risk committee | 风险委员会 |
| Aggressive | 激进 |
| Conservative | 保守 |
| Neutral | 中性 |
| Portfolio manager | 投资经理 |
| Trader | 交易员 |
| Research manager | 研究主管 |
| Decision log | 决策日志 |
| Checkpoint resume | 检查点恢复 |
| Workbench | 工作台 |
| Dashboard | 总览 |
| Provider | 提供商 |
| API base URL | API 基址 |
| Missing key | 缺少密钥 |
| Configured | 已配置 |
| Save defaults | 保存默认值 |
| Debate rounds | 辩论轮数 |
| Risk debate rounds | 风险辩论轮数 |
| Output language | 报告语言 |
| Display language | 界面语言 |
| New Analysis | 新建分析 |
| Recent runs | 最近运行 |
| Compare runs | 对比运行 |
| Start an analysis | 发起分析 |
| Open dashboard | 打开总览 |
| How it works | 工作原理 |
| Five stages, one decision | 五个阶段，一项决策 |
| Live agent streaming | 智能体实时流 |
| Per-ticker charts | 按标的的图表 |
| Decision log & reflections | 决策日志与复盘 |
| Compare & replay | 对比与回放 |
| Any model, any market | 任意模型、任意市场 |
| Built for watching the work, not just the verdict | 既看结论，更看过程 |
```

- [ ] **Step 3: Commit**

```bash
git add webapp/frontend/package.json webapp/frontend/package-lock.json docs/superpowers/specs/2026-06-04-glossary.md
git commit -m "build(frontend): add next-intl + tsx; commit translation glossary"
```

### Task 5.2: i18n config + middleware + provider wiring

**Files:**
- Create: `webapp/frontend/i18n/locales.ts`
- Create: `webapp/frontend/i18n/request.ts`
- Create: `webapp/frontend/i18n/messages/en.json`
- Create: `webapp/frontend/i18n/messages/zh.json`
- Create: `webapp/frontend/middleware.ts`
- Modify: `webapp/frontend/next.config.mjs`
- Modify: `webapp/frontend/app/layout.tsx`

- [ ] **Step 1: locales.ts**

`webapp/frontend/i18n/locales.ts`:

```ts
export const LOCALES = ["en", "zh"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "en";

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (LOCALES as readonly string[]).includes(value);
}

/** Pick a locale from an Accept-Language header. */
export function negotiate(acceptLanguage: string | null): Locale {
  if (!acceptLanguage) return DEFAULT_LOCALE;
  const tags = acceptLanguage
    .split(",")
    .map((s) => s.split(";")[0].trim().toLowerCase());
  for (const tag of tags) {
    if (tag.startsWith("zh")) return "zh";
    if (tag.startsWith("en")) return "en";
  }
  return DEFAULT_LOCALE;
}
```

- [ ] **Step 2: empty message files (will be filled in Phase 6)**

`webapp/frontend/i18n/messages/en.json`:

```json
{}
```

`webapp/frontend/i18n/messages/zh.json`:

```json
{}
```

- [ ] **Step 3: request config**

`webapp/frontend/i18n/request.ts`:

```ts
import { cookies, headers } from "next/headers";
import { getRequestConfig } from "next-intl/server";

import { DEFAULT_LOCALE, isLocale, negotiate, type Locale } from "./locales";

export default getRequestConfig(async () => {
  const cookieStore = await cookies();
  const fromCookie = cookieStore.get("NEXT_LOCALE")?.value;
  let locale: Locale = DEFAULT_LOCALE;
  if (isLocale(fromCookie)) {
    locale = fromCookie;
  } else {
    const accept = (await headers()).get("accept-language");
    locale = negotiate(accept);
  }
  const messages = (await import(`./messages/${locale}.json`)).default;
  return { locale, messages };
});
```

- [ ] **Step 4: middleware**

`webapp/frontend/middleware.ts`:

```ts
import { type NextRequest, NextResponse } from "next/server";

import { DEFAULT_LOCALE, isLocale, negotiate } from "./i18n/locales";

export function middleware(req: NextRequest) {
  const existing = req.cookies.get("NEXT_LOCALE")?.value;
  if (isLocale(existing)) {
    return NextResponse.next();
  }
  const locale = negotiate(req.headers.get("accept-language"));
  const res = NextResponse.next();
  res.cookies.set("NEXT_LOCALE", locale ?? DEFAULT_LOCALE, {
    path: "/",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 365,
  });
  return res;
}

export const config = {
  matcher: ["/((?!_next|api|.*\\..*).*)"],
};
```

- [ ] **Step 5: wrap next.config.mjs**

Replace `webapp/frontend/next.config.mjs`:

```js
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./i18n/request.ts");

/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    return [
      { source: "/api/:path*", destination: "http://localhost:8000/api/:path*" },
    ];
  },
  reactStrictMode: true,
};
export default withNextIntl(nextConfig);
```

- [ ] **Step 6: wrap layout**

Replace `webapp/frontend/app/layout.tsx`:

```tsx
import "./globals.css";

import type { Metadata } from "next";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages } from "next-intl/server";
import type { ReactNode } from "react";

import { Nav } from "@/components/features/nav";

export const metadata: Metadata = {
  title: "TradingAgents Workbench",
  description:
    "A trading firm of LLM agents — analysts, researchers, trader, and risk team that debate every trade, live in your browser.",
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  const locale = await getLocale();
  const messages = await getMessages();
  return (
    <html lang={locale} className="dark">
      <body className="min-h-screen bg-zinc-950 text-zinc-100 antialiased">
        <NextIntlClientProvider locale={locale} messages={messages}>
          <Nav />
          {children}
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
```

- [ ] **Step 7: Build**

```bash
rm -rf .next && npm run build 2>&1 | grep -E "Compiled|Failed|error" | head -5
```
Expected: `Compiled successfully`.

- [ ] **Step 8: Commit**

```bash
git add webapp/frontend/i18n webapp/frontend/middleware.ts webapp/frontend/next.config.mjs webapp/frontend/app/layout.tsx
git commit -m "feat(frontend): next-intl scaffolding (cookie-driven, no URL prefix)"
```

### Task 5.3: LanguageSwitcher + nav mount

**Files:**
- Create: `webapp/frontend/components/features/language-switcher.tsx`
- Modify: `webapp/frontend/components/features/nav.tsx`

- [ ] **Step 1: Implement LanguageSwitcher**

`webapp/frontend/components/features/language-switcher.tsx`:

```tsx
"use client";

import { clsx } from "clsx";
import { useRouter } from "next/navigation";
import { useLocale } from "next-intl";

import { LOCALES, type Locale } from "@/i18n/locales";

const LABEL: Record<Locale, string> = { en: "EN", zh: "中" };

export function LanguageSwitcher() {
  const current = useLocale() as Locale;
  const router = useRouter();

  function set(next: Locale) {
    if (next === current) return;
    document.cookie = `NEXT_LOCALE=${next}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;
    router.refresh();
  }

  return (
    <div
      role="group"
      aria-label="Language"
      className="ml-auto flex items-center rounded-md border border-zinc-800 text-xs"
    >
      {LOCALES.map((l) => (
        <button
          key={l}
          type="button"
          onClick={() => set(l)}
          aria-pressed={l === current}
          className={clsx(
            "px-2 py-1 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400",
            l === current
              ? "bg-zinc-100 text-zinc-900"
              : "text-zinc-400 hover:text-zinc-100",
          )}
        >
          {LABEL[l]}
        </button>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Mount in nav**

Replace `webapp/frontend/components/features/nav.tsx`:

```tsx
"use client";

import { clsx } from "clsx";
import { Activity } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";

import { LanguageSwitcher } from "@/components/features/language-switcher";

const LINKS: { href: string; key: "dashboard" | "runs" | "new" | "compare" | "settings" }[] = [
  { href: "/dashboard", key: "dashboard" },
  { href: "/runs", key: "runs" },
  { href: "/runs/new", key: "new" },
  { href: "/compare", key: "compare" },
  { href: "/settings", key: "settings" },
];

function isActive(path: string, href: string): boolean {
  if (href === "/") return path === "/";
  return path === href || path.startsWith(`${href}/`);
}

export function Nav() {
  const path = usePathname();
  const t = useTranslations("nav");
  return (
    <nav className="sticky top-0 z-40 border-b border-zinc-800/80 bg-zinc-950/80 backdrop-blur supports-[backdrop-filter]:bg-zinc-950/60">
      <div className="mx-auto flex max-w-7xl items-center gap-1 px-4 py-3 sm:px-6">
        <Link href="/" className="mr-3 flex items-center gap-2 font-semibold tracking-tight">
          <span className="flex h-7 w-7 items-center justify-center rounded-md bg-blue-600/15 text-blue-400 ring-1 ring-blue-500/30">
            <Activity className="h-4 w-4" />
          </span>
          <span>
            Trading<span className="text-blue-400">Agents</span>
          </span>
        </Link>
        <ul className="flex items-center gap-0.5 overflow-x-auto text-sm">
          {LINKS.map((l) => {
            const active = isActive(path, l.href);
            return (
              <li key={l.href}>
                <Link
                  href={l.href}
                  aria-current={active ? "page" : undefined}
                  className={clsx(
                    "relative rounded-md px-3 py-1.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400",
                    active ? "text-zinc-50" : "text-zinc-400 hover:text-zinc-100",
                  )}
                >
                  {t(l.key)}
                  {active && (
                    <span className="absolute inset-x-2 -bottom-px h-px bg-gradient-to-r from-transparent via-blue-400 to-transparent" />
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
        <LanguageSwitcher />
      </div>
    </nav>
  );
}
```

(Nav uses `t("nav.<key>")` even though en.json is still empty — next-intl will fall back to the key, which is fine pre-Phase-6.)

- [ ] **Step 3: Build**

```bash
rm -rf .next && npm run build 2>&1 | grep -E "Compiled|Failed|error" | head
```
Expected: `Compiled successfully`.

- [ ] **Step 4: Commit**

```bash
git add webapp/frontend/components/features/language-switcher.tsx webapp/frontend/components/features/nav.tsx
git commit -m "feat(frontend): LanguageSwitcher mounted in nav (writes NEXT_LOCALE cookie)"
```

### Task 5.4: Key-parity check script

**Files:**
- Create: `webapp/frontend/scripts/check-messages.ts`
- Modify: `webapp/frontend/package.json` (add script)

- [ ] **Step 1: Write the script**

`webapp/frontend/scripts/check-messages.ts`:

```ts
import en from "../i18n/messages/en.json";
import zh from "../i18n/messages/zh.json";

function flatten(obj: unknown, prefix = ""): string[] {
  if (obj === null || typeof obj !== "object") return [prefix];
  const out: string[] = [];
  for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === "object" && !Array.isArray(v)) {
      out.push(...flatten(v, key));
    } else {
      out.push(key);
    }
  }
  return out;
}

const enKeys = new Set(flatten(en));
const zhKeys = new Set(flatten(zh));
const missingInZh = [...enKeys].filter((k) => !zhKeys.has(k));
const missingInEn = [...zhKeys].filter((k) => !enKeys.has(k));

if (missingInZh.length || missingInEn.length) {
  if (missingInZh.length) console.error("Missing in zh.json:", missingInZh);
  if (missingInEn.length) console.error("Missing in en.json:", missingInEn);
  process.exit(1);
}
console.log(`Message key parity OK — ${enKeys.size} keys.`);
```

- [ ] **Step 2: Add to package.json scripts**

In `webapp/frontend/package.json`, locate the `"scripts"` block and add:

```json
    "check:messages": "tsx scripts/check-messages.ts",
```

- [ ] **Step 3: Run**

```bash
cd webapp/frontend && npm run check:messages
```
Expected: `Message key parity OK — 0 keys.` (both files empty so far).

- [ ] **Step 4: Commit**

```bash
git add webapp/frontend/scripts/check-messages.ts webapp/frontend/package.json
git commit -m "build(frontend): check-messages.ts asserts en/zh key parity"
```

---

## Phase 6 — Extract strings into messages, namespace by namespace

Each task below: edit the targeted component(s) to use `t("<ns>.<key>")` (or `t.rich(...)` for fragments with embedded markup); add the matching keys to **both** `en.json` and `zh.json`; run `npm run check:messages`; commit. The end state is **zero hardcoded user-visible English strings** in `app/**` or `components/features/**`.

> **For every task in this phase, the strings to write are listed verbatim. Copy them in. Do not improvise translations — they have been chosen with the glossary.**

### Task 6.1: `common` + `nav`

**Files:**
- Modify: `webapp/frontend/i18n/messages/en.json`
- Modify: `webapp/frontend/i18n/messages/zh.json`

- [ ] **Step 1: Replace en.json**

`webapp/frontend/i18n/messages/en.json`:

```json
{
  "common": {
    "back": "Back",
    "next": "Next",
    "cancel": "Cancel",
    "save": "Save",
    "saved": "Saved",
    "saving": "Saving…",
    "loading": "Loading…",
    "error": "Error",
    "optional": "optional",
    "missingKey": "Missing key",
    "configured": "Configured"
  },
  "nav": {
    "dashboard": "Dashboard",
    "runs": "Runs",
    "new": "New",
    "compare": "Compare",
    "settings": "Settings"
  }
}
```

- [ ] **Step 2: Replace zh.json**

`webapp/frontend/i18n/messages/zh.json`:

```json
{
  "common": {
    "back": "返回",
    "next": "下一步",
    "cancel": "取消",
    "save": "保存",
    "saved": "已保存",
    "saving": "保存中…",
    "loading": "加载中…",
    "error": "错误",
    "optional": "可选",
    "missingKey": "缺少密钥",
    "configured": "已配置"
  },
  "nav": {
    "dashboard": "总览",
    "runs": "运行",
    "new": "新建",
    "compare": "对比",
    "settings": "设置"
  }
}
```

- [ ] **Step 3: Verify parity**

```bash
cd webapp/frontend && npm run check:messages
```
Expected: `Message key parity OK — 16 keys.`

- [ ] **Step 4: Commit**

```bash
git add webapp/frontend/i18n/messages
git commit -m "i18n: common + nav namespaces (EN + 中文)"
```

### Task 6.2: Landing page (`/`)

**Files:**
- Modify: `webapp/frontend/i18n/messages/en.json`
- Modify: `webapp/frontend/i18n/messages/zh.json`
- Modify: `webapp/frontend/app/page.tsx`

- [ ] **Step 1: Add `landing` namespace to en.json**

Add a `"landing"` sibling block to en.json:

```json
  "landing": {
    "badge": "v0.2.5 · Multi-Agent LLM Trading Framework",
    "headlinePart1": "A trading firm,",
    "headlinePart2": "staffed by <accent>LLM agents</accent>.",
    "subhead": "TradingAgents runs a full desk over any ticker — specialist analysts, a bull-vs-bear research debate, a trader, and a risk committee — then streams every step of their reasoning to your browser in real time.",
    "ctaStart": "Start an analysis",
    "ctaOpenDashboard": "Open dashboard",
    "pipeline": {
      "analysts": "Analysts",
      "analystsSub": "×4",
      "bullBear": "Bull vs Bear",
      "bullBearSub": "debate",
      "trader": "Trader",
      "traderSub": "plan",
      "riskTeam": "Risk team",
      "riskTeamSub": "×3",
      "portfolioMgr": "Portfolio Mgr",
      "portfolioMgrSub": "decision"
    },
    "stats": {
      "agents": "Specialized agents",
      "analystLenses": "Analyst lenses",
      "providers": "LLM providers",
      "markets": "Yahoo markets"
    },
    "stagesEyebrow": "How it works",
    "stagesTitle": "Five stages, one decision",
    "stagesSub": "Each ticker flows through specialized roles. The handoffs are exactly what you watch stream live on the run page.",
    "stageLabel": "Stage {n}",
    "stage": {
      "analystsTitle": "Analysts",
      "analystsBody": "Market, sentiment, news, and fundamentals analysts each file a grounded report.",
      "researchTitle": "Research debate",
      "researchBody": "Bull and bear researchers argue it out over multiple rounds; a manager synthesizes.",
      "traderTitle": "Trader",
      "traderBody": "The trader turns the research into a concrete investment plan.",
      "riskTitle": "Risk committee",
      "riskBody": "Aggressive, conservative, and neutral analysts stress-test the plan.",
      "pmTitle": "Portfolio manager",
      "pmBody": "The PM issues the final BUY / SELL / HOLD with a rated confidence."
    },
    "featuresEyebrow": "In the workbench",
    "featuresTitle": "Built for watching the work, not just the verdict",
    "featuresSub": "The CLI gave you a final call. The workbench gives you the whole desk — live, replayable, and comparable.",
    "feature": {
      "streamingTitle": "Live agent streaming",
      "streamingBody": "Watch every report, tool call, and debate message arrive over SSE — pause, resume, and replay.",
      "debateTitle": "Bull vs Bear, visualized",
      "debateBody": "Debates render as side-by-side bubbles by round, so you can read the argument, not just the result.",
      "logTitle": "Decision log & reflections",
      "logBody": "Every run is recorded with its realized return and an after-the-fact reflection on what worked.",
      "chartsTitle": "Per-ticker charts",
      "chartsBody": "Candlesticks with your historical decisions overlaid, plus the indicators the analysts cite.",
      "modelsTitle": "Any model, any market",
      "modelsBody": "OpenAI, Anthropic, Google, Qwen, GLM, and more — across every market Yahoo Finance covers.",
      "compareTitle": "Compare & replay",
      "compareBody": "Re-run the same ticker on different models and put the decisions side by side."
    },
    "ctaTitle": "Put the desk to work",
    "ctaBody": "Pick a ticker and a date, choose your models, and watch the agents debate it out — from the first analyst report to the portfolio manager's final call.",
    "ctaDisclaimer": "Research framework · not financial advice"
  }
```

- [ ] **Step 2: Add `landing` to zh.json (translations curated per glossary)**

```json
  "landing": {
    "badge": "v0.2.5 · 多智能体 LLM 交易框架",
    "headlinePart1": "一家交易公司，",
    "headlinePart2": "由 <accent>LLM 智能体</accent> 担纲。",
    "subhead": "TradingAgents 为任意标的运转一支完整的交易团队 —— 专业分析师、多空研究辩论、交易员与风险委员会 —— 并把每一步推理实时流式发送到你的浏览器。",
    "ctaStart": "发起分析",
    "ctaOpenDashboard": "打开总览",
    "pipeline": {
      "analysts": "分析师",
      "analystsSub": "×4",
      "bullBear": "多空辩论",
      "bullBearSub": "辩论",
      "trader": "交易员",
      "traderSub": "计划",
      "riskTeam": "风险委员会",
      "riskTeamSub": "×3",
      "portfolioMgr": "投资经理",
      "portfolioMgrSub": "决策"
    },
    "stats": {
      "agents": "专业智能体",
      "analystLenses": "分析师视角",
      "providers": "LLM 提供商",
      "markets": "Yahoo 覆盖市场"
    },
    "stagesEyebrow": "工作原理",
    "stagesTitle": "五个阶段，一项决策",
    "stagesSub": "每只标的依次流经各个专业角色。这些交接正是你在运行详情页看到的实时流。",
    "stageLabel": "阶段 {n}",
    "stage": {
      "analystsTitle": "分析师",
      "analystsBody": "市场、情绪、新闻、基本面四位分析师各自给出有据可查的报告。",
      "researchTitle": "研究辩论",
      "researchBody": "多头与空头研究员多轮辩论，最终由研究主管整合结论。",
      "traderTitle": "交易员",
      "traderBody": "交易员把研究结论转化为具体的投资计划。",
      "riskTitle": "风险委员会",
      "riskBody": "激进、保守、中性三位分析师对计划进行压力测试。",
      "pmTitle": "投资经理",
      "pmBody": "投资经理给出最终 BUY / SELL / HOLD 与评级置信度。"
    },
    "featuresEyebrow": "工作台特性",
    "featuresTitle": "既看结论，更看过程",
    "featuresSub": "CLI 只给你结论。工作台把整支交易团队都展现给你 —— 实时、可回放、可对比。",
    "feature": {
      "streamingTitle": "智能体实时流",
      "streamingBody": "通过 SSE 实时接收每份报告、每次工具调用、每条辩论 —— 支持暂停、继续、回放。",
      "debateTitle": "可视化的多空辩论",
      "debateBody": "辩论按轮次以并排气泡呈现，让你读到推理本身，而不仅是结论。",
      "logTitle": "决策日志与复盘",
      "logBody": "每次运行都记录其实际收益，并附事后复盘说明什么有效。",
      "chartsTitle": "按标的的图表",
      "chartsBody": "K 线上叠加历次决策，并同步分析师所引用的技术指标。",
      "modelsTitle": "任意模型、任意市场",
      "modelsBody": "支持 OpenAI、Anthropic、Google、Qwen、GLM 等，覆盖 Yahoo Finance 全部市场。",
      "compareTitle": "对比与回放",
      "compareBody": "用不同模型重跑同一标的，把决策并排对比。"
    },
    "ctaTitle": "让团队开始工作",
    "ctaBody": "选定标的与日期、挑好模型，看智能体辩论 —— 从第一份分析师报告，到投资经理的最终决策。",
    "ctaDisclaimer": "研究框架 · 不构成任何投资建议"
  }
```

- [ ] **Step 3: Update `app/page.tsx` to consume the namespace**

Read the current `webapp/frontend/app/page.tsx`. Replace every hardcoded user-visible string with `t("landing.<key>")`. Specifically:

- Add at the top of the component: `const t = useTranslations("landing");` and `import { useTranslations } from "next-intl";`.
- Badge text → `{t("badge")}`.
- Headline: split into two lines. Line 1 → `{t("headlinePart1")}`. Line 2 → `t.rich("headlinePart2", { accent: (chunks) => <span className="text-blue-400 text-glow">{chunks}</span> })`.
- Subhead → `{t("subhead")}`.
- CTAs → `{t("ctaStart")}`, `{t("ctaOpenDashboard")}`.
- Pipeline node labels and sub-labels → `{t("pipeline.<key>")}`. The pipeline data structure becomes:
  ```tsx
  const nodes = [
    { key: "analysts", subKey: "analystsSub", tone: "blue" },
    { key: "bullBear", subKey: "bullBearSub", tone: "amber" },
    { key: "trader", subKey: "traderSub", tone: "blue" },
    { key: "riskTeam", subKey: "riskTeamSub", tone: "amber" },
    { key: "portfolioMgr", subKey: "portfolioMgrSub", tone: "emerald" },
  ];
  // … render <div>{t(`pipeline.${n.key}`)}</div> / <div>{t(`pipeline.${n.subKey}`)}</div>
  ```
- Stats: rename the `STATS` array to use translation keys and a `value` literal:
  ```tsx
  const STATS = [
    { value: "12", labelKey: "agents" },
    { value: "4",  labelKey: "analystLenses" },
    { value: "13", labelKey: "providers" },
    { value: "∞", labelKey: "markets" },
  ];
  // render: {t(`stats.${s.labelKey}`)}
  ```
- Section heading: `<SectionHeading eyebrow={t("stagesEyebrow")} title={t("stagesTitle")} sub={t("stagesSub")} />`. (`SectionHeading` already accepts these as props.)
- Stages: rewrite `STAGES` as:
  ```tsx
  const STAGES = [
    { titleKey: "analystsTitle", bodyKey: "analystsBody", icon: <LineChart className="h-5 w-5" /> },
    { titleKey: "researchTitle", bodyKey: "researchBody", icon: <Users className="h-5 w-5" /> },
    { titleKey: "traderTitle",   bodyKey: "traderBody",   icon: <GitBranch className="h-5 w-5" /> },
    { titleKey: "riskTitle",     bodyKey: "riskBody",     icon: <Scale className="h-5 w-5" /> },
    { titleKey: "pmTitle",       bodyKey: "pmBody",       icon: <Brain className="h-5 w-5" /> },
  ];
  // render: {t("stageLabel", { n: i + 1 })}; {t(`stage.${s.titleKey}`)}; {t(`stage.${s.bodyKey}`)}
  ```
- Features: same pattern with `feature.<key>` keys.
- CTA panel: title/body/disclaimer/button → translated keys.

- [ ] **Step 4: Verify and build**

```bash
cd webapp/frontend && npm run check:messages
rm -rf .next && npm run build 2>&1 | grep -E "Compiled|Failed|error" | head
```
Expected: parity OK, build succeeds.

- [ ] **Step 5: Commit**

```bash
git add webapp/frontend/i18n/messages webapp/frontend/app/page.tsx
git commit -m "i18n: landing page (EN + 中文)"
```

### Task 6.3: Dashboard (`/dashboard`)

**Files:**
- Modify: `webapp/frontend/i18n/messages/en.json`
- Modify: `webapp/frontend/i18n/messages/zh.json`
- Modify: `webapp/frontend/app/dashboard/page.tsx`

- [ ] **Step 1: Add `dashboard` to en.json**

```json
  "dashboard": {
    "title": "Workbench",
    "subtitle": "Your analyses, decisions, and outcomes at a glance.",
    "newAnalysis": "New Analysis",
    "stat": {
      "runs": "Runs",
      "alpha": "Avg α vs benchmark",
      "pending": "Pending reflections",
      "lastRun": "Last run"
    },
    "recentRuns": "Recent runs",
    "emptyTitle": "No runs yet.",
    "emptyLink": "Start your first analysis →"
  }
```

- [ ] **Step 2: Add `dashboard` to zh.json**

```json
  "dashboard": {
    "title": "工作台",
    "subtitle": "一眼看完你所有的分析、决策与结果。",
    "newAnalysis": "新建分析",
    "stat": {
      "runs": "运行数",
      "alpha": "相对基准的平均超额收益",
      "pending": "待复盘",
      "lastRun": "上次运行"
    },
    "recentRuns": "最近运行",
    "emptyTitle": "暂无运行。",
    "emptyLink": "发起首次分析 →"
  }
```

- [ ] **Step 3: Update the dashboard page**

In `webapp/frontend/app/dashboard/page.tsx`:

- Since this is a server component, use `getTranslations` (not `useTranslations`):
  ```tsx
  import { getTranslations } from "next-intl/server";
  // inside the async function:
  const t = await getTranslations("dashboard");
  ```
- Replace strings: title, subtitle, button label, the four stat labels, "Recent runs", and the two empty-state strings.
- The Stat helper currently takes a `label` prop; pass translated strings.

- [ ] **Step 4: Verify + commit**

```bash
cd webapp/frontend && npm run check:messages && rm -rf .next && npm run build 2>&1 | grep -E "Compiled|Failed" | head
git add webapp/frontend/i18n/messages webapp/frontend/app/dashboard/page.tsx
git commit -m "i18n: dashboard page (EN + 中文)"
```

### Task 6.4: Wizard (`/runs/new`)

**Files:**
- Modify: `webapp/frontend/i18n/messages/en.json`
- Modify: `webapp/frontend/i18n/messages/zh.json`
- Modify: `webapp/frontend/app/runs/new/page.tsx`

- [ ] **Step 1: Add `wizard` to en.json**

```json
  "wizard": {
    "title": "New Analysis",
    "step1": { "ticker": "Ticker", "tradeDate": "Trade date" },
    "step3": {
      "provider": "LLM provider",
      "deepModel": "Deep think model (optional)",
      "quickModel": "Quick think model (optional)",
      "baseUrl": "API base URL (optional)"
    },
    "step4": {
      "debateRounds": "Debate rounds: {n}",
      "riskRounds": "Risk debate rounds: {n}",
      "outputLanguage": "Output language (what the agents write in)",
      "customLanguage": "Custom language name",
      "customPlaceholder": "e.g. Korean",
      "checkpoint": "Enable checkpoint resume",
      "languageCustom": "Custom…"
    },
    "submit": "Start analysis",
    "submitting": "Starting…",
    "providerMissing": " (missing key)"
  }
```

- [ ] **Step 2: Add `wizard` to zh.json**

```json
  "wizard": {
    "title": "新建分析",
    "step1": { "ticker": "标的", "tradeDate": "分析日期" },
    "step3": {
      "provider": "LLM 提供商",
      "deepModel": "深思模型（可选）",
      "quickModel": "快思模型（可选）",
      "baseUrl": "API 基址（可选）"
    },
    "step4": {
      "debateRounds": "辩论轮数：{n}",
      "riskRounds": "风险辩论轮数：{n}",
      "outputLanguage": "报告语言（智能体输出语言）",
      "customLanguage": "自定义语言名称",
      "customPlaceholder": "例如 Korean",
      "checkpoint": "启用检查点恢复",
      "languageCustom": "自定义…"
    },
    "submit": "发起分析",
    "submitting": "启动中…",
    "providerMissing": "（缺少密钥）"
  }
```

- [ ] **Step 3: Update the wizard page**

In `webapp/frontend/app/runs/new/page.tsx`:

- Add `import { useTranslations } from "next-intl";` and at the top of the component `const t = useTranslations("wizard"); const tc = useTranslations("common");`.
- Replace all visible labels and button strings with `t("...")` / `tc("...")`.
- For the "Debate rounds: N" pattern, use `t("step4.debateRounds", { n: form.max_debate_rounds })` and same for risk rounds. (next-intl handles the `{n}` placeholder.)
- "Custom…" option label → `t("step4.languageCustom")`.

- [ ] **Step 4: Verify + commit**

```bash
cd webapp/frontend && npm run check:messages && rm -rf .next && npm run build 2>&1 | grep -E "Compiled|Failed" | head
git add webapp/frontend/i18n/messages webapp/frontend/app/runs/new/page.tsx
git commit -m "i18n: wizard page (EN + 中文)"
```

### Task 6.5: Runs history (`/runs`)

**Files:**
- Modify: `webapp/frontend/i18n/messages/en.json`
- Modify: `webapp/frontend/i18n/messages/zh.json`
- Modify: `webapp/frontend/app/runs/page.tsx`

- [ ] **Step 1: Add `history` to en.json**

```json
  "history": {
    "title": "All runs",
    "col": {
      "date": "Date",
      "ticker": "Ticker",
      "rating": "Rating",
      "raw": "Raw",
      "alpha": "α",
      "reflection": "Reflection"
    },
    "pending": "pending"
  }
```

- [ ] **Step 2: Add `history` to zh.json**

```json
  "history": {
    "title": "全部运行",
    "col": {
      "date": "日期",
      "ticker": "标的",
      "rating": "评级",
      "raw": "原始收益",
      "alpha": "α",
      "reflection": "复盘"
    },
    "pending": "待复盘"
  }
```

- [ ] **Step 3: Update `app/runs/page.tsx`**

It's a server component — use `await getTranslations("history")`. Replace header text, column headers, and the `(e.pending ? "pending" : "—")` fallback.

- [ ] **Step 4: Verify + commit**

```bash
cd webapp/frontend && npm run check:messages && rm -rf .next && npm run build 2>&1 | grep -E "Compiled|Failed" | head
git add webapp/frontend/i18n/messages webapp/frontend/app/runs/page.tsx
git commit -m "i18n: runs history page (EN + 中文)"
```

### Task 6.6: Markets (`/markets/[ticker]`) + Compare (`/compare`)

**Files:**
- Modify: `webapp/frontend/i18n/messages/en.json`
- Modify: `webapp/frontend/i18n/messages/zh.json`
- Modify: `webapp/frontend/app/markets/[ticker]/page.tsx`
- Modify: `webapp/frontend/app/compare/page.tsx`

- [ ] **Step 1: Add `markets` and `compare` to en.json**

```json
  "markets": {
    "decisionHistory": "Decision history",
    "pendingReflection": "Pending reflection"
  },
  "compare": {
    "title": "Compare runs",
    "instructions": "Select up to 4 runs from the history table; pass their ids as <code>?ids=a,b,c</code> to compare. (Selection UI lands in a follow-up.)"
  }
```

- [ ] **Step 2: Add `markets` and `compare` to zh.json**

```json
  "markets": {
    "decisionHistory": "历次决策",
    "pendingReflection": "尚未复盘"
  },
  "compare": {
    "title": "对比运行",
    "instructions": "在「全部运行」中勾选最多 4 个运行，将其 id 以 <code>?ids=a,b,c</code> 方式带入即可对比（选择 UI 将在后续版本提供）。"
  }
```

- [ ] **Step 3: Update both pages**

In `app/markets/[ticker]/page.tsx` (server component) use `await getTranslations("markets")` and translate "Decision history" and the "Pending reflection" fallback.

In `app/compare/page.tsx`:

- Make it a client component (`"use client"` at top) so we can use `t.rich`.
- `const t = useTranslations("compare");`
- Render `t.rich("instructions", { code: (c) => <code>{c}</code> })` for the body.

- [ ] **Step 4: Verify + commit**

```bash
cd webapp/frontend && npm run check:messages && rm -rf .next && npm run build 2>&1 | grep -E "Compiled|Failed" | head
git add webapp/frontend/i18n/messages webapp/frontend/app/markets/[ticker]/page.tsx webapp/frontend/app/compare/page.tsx
git commit -m "i18n: markets + compare pages (EN + 中文)"
```

### Task 6.7: Settings (`/settings`)

**Files:**
- Modify: `webapp/frontend/i18n/messages/en.json`
- Modify: `webapp/frontend/i18n/messages/zh.json`
- Modify: `webapp/frontend/app/settings/page.tsx`

- [ ] **Step 1: Add `settings` to en.json**

```json
  "settings": {
    "title": "Settings",
    "providers": "Providers",
    "defaults": "Workbench defaults",
    "defaultsHelp": "These prefill the New Analysis wizard. The wizard can still override them per run.",
    "field": {
      "provider": "LLM provider",
      "deepModel": "Deep think model",
      "quickModel": "Quick think model",
      "baseUrl": "API base URL",
      "temperature": "Temperature",
      "outputLanguage": "Output language (agent reports)"
    },
    "saveDefaults": "Save defaults",
    "errorPrefix": "Error: "
  }
```

- [ ] **Step 2: Add `settings` to zh.json**

```json
  "settings": {
    "title": "设置",
    "providers": "提供商",
    "defaults": "工作台默认值",
    "defaultsHelp": "这些值用于预填「新建分析」向导，每次运行仍可在向导内单独覆盖。",
    "field": {
      "provider": "LLM 提供商",
      "deepModel": "深思模型",
      "quickModel": "快思模型",
      "baseUrl": "API 基址",
      "temperature": "采样温度",
      "outputLanguage": "报告语言（智能体输出）"
    },
    "saveDefaults": "保存默认值",
    "errorPrefix": "错误："
  }
```

- [ ] **Step 3: Update `app/settings/page.tsx`**

Add `import { useTranslations } from "next-intl";` and `const t = useTranslations("settings"); const tc = useTranslations("common");`. Replace every literal heading / label / button / status message with the matching `t("...")` / `tc("...")` call.

- [ ] **Step 4: Verify + commit**

```bash
cd webapp/frontend && npm run check:messages && rm -rf .next && npm run build 2>&1 | grep -E "Compiled|Failed" | head
git add webapp/frontend/i18n/messages webapp/frontend/app/settings/page.tsx
git commit -m "i18n: settings page (EN + 中文)"
```

### Task 6.8: Run detail (`/runs/[runId]`) — agent labels + status

**Files:**
- Modify: `webapp/frontend/i18n/messages/en.json`
- Modify: `webapp/frontend/i18n/messages/zh.json`
- Modify: `webapp/frontend/app/runs/[runId]/page.tsx`
- Modify: `webapp/frontend/components/features/pipeline-stepper.tsx`
- Modify: `webapp/frontend/components/features/debate-bubbles.tsx`
- Modify: `webapp/frontend/components/features/decision-card.tsx`
- Modify: `webapp/frontend/components/features/metrics-panel.tsx`
- Modify: `webapp/frontend/components/features/tool-log.tsx`

- [ ] **Step 1: Add `runDetail` namespace to en.json**

```json
  "runDetail": {
    "status": "Status: {state}",
    "waiting": "Waiting for output…",
    "errorTitleFallback": "Unknown error",
    "agent": {
      "market_analyst": "Market Analyst",
      "social_analyst": "Sentiment Analyst",
      "news_analyst": "News Analyst",
      "fundamentals_analyst": "Fundamentals Analyst",
      "bull_researcher": "Bull Researcher",
      "bear_researcher": "Bear Researcher",
      "research_manager": "Research Manager",
      "trader": "Trader",
      "aggressive_analyst": "Aggressive Risk",
      "conservative_analyst": "Conservative Risk",
      "neutral_analyst": "Neutral Risk",
      "portfolio_manager": "Portfolio Manager"
    },
    "group": {
      "Analysts": "Analysts",
      "Research": "Research",
      "Trade": "Trade",
      "Risk": "Risk",
      "Decision": "Decision"
    },
    "debate": {
      "round": "Round {n}",
      "side": {
        "bull": "Bull",
        "bear": "Bear",
        "aggressive": "Aggressive",
        "conservative": "Conservative",
        "neutral": "Neutral"
      }
    },
    "decision": {
      "finalLabel": "Final Decision",
      "tookSeconds": "Run took {s}s"
    },
    "metrics": {
      "llm": "LLM calls",
      "tools": "Tool calls",
      "tokensIn": "Tokens ↑",
      "tokensOut": "Tokens ↓",
      "elapsed": "Elapsed"
    },
    "toolLog": {
      "empty": "No tool calls yet",
      "heading": "Tool calls"
    }
  }
```

- [ ] **Step 2: Add `runDetail` namespace to zh.json**

```json
  "runDetail": {
    "status": "状态：{state}",
    "waiting": "等待输出…",
    "errorTitleFallback": "未知错误",
    "agent": {
      "market_analyst": "市场分析师",
      "social_analyst": "情绪分析师",
      "news_analyst": "新闻分析师",
      "fundamentals_analyst": "基本面分析师",
      "bull_researcher": "多头研究员",
      "bear_researcher": "空头研究员",
      "research_manager": "研究主管",
      "trader": "交易员",
      "aggressive_analyst": "激进风险",
      "conservative_analyst": "保守风险",
      "neutral_analyst": "中性风险",
      "portfolio_manager": "投资经理"
    },
    "group": {
      "Analysts": "分析师",
      "Research": "研究",
      "Trade": "交易",
      "Risk": "风险",
      "Decision": "决策"
    },
    "debate": {
      "round": "第 {n} 轮",
      "side": {
        "bull": "多头",
        "bear": "空头",
        "aggressive": "激进",
        "conservative": "保守",
        "neutral": "中性"
      }
    },
    "decision": {
      "finalLabel": "最终决策",
      "tookSeconds": "本次运行用时 {s} 秒"
    },
    "metrics": {
      "llm": "LLM 调用",
      "tools": "工具调用",
      "tokensIn": "Token 入",
      "tokensOut": "Token 出",
      "elapsed": "用时"
    },
    "toolLog": {
      "empty": "尚无工具调用",
      "heading": "工具调用"
    }
  }
```

- [ ] **Step 3: Update PipelineStepper**

In `webapp/frontend/components/features/pipeline-stepper.tsx`:

- Remove the hardcoded English label/group strings in `AGENT_ORDER`. Keep ids and tone. Replace the rendered text with `t(\`agent.${a.id}\`)` and `t(\`group.${a.group}\`)`.
- Add `import { useTranslations } from "next-intl";` and `const t = useTranslations("runDetail");`.
- The `AGENT_ORDER` becomes:
  ```tsx
  const AGENT_ORDER: { id: AgentName; group: "Analysts" | "Research" | "Trade" | "Risk" | "Decision" }[] = [
    { id: "market_analyst", group: "Analysts" },
    { id: "social_analyst", group: "Analysts" },
    { id: "news_analyst", group: "Analysts" },
    { id: "fundamentals_analyst", group: "Analysts" },
    { id: "bull_researcher", group: "Research" },
    { id: "bear_researcher", group: "Research" },
    { id: "research_manager", group: "Research" },
    { id: "trader", group: "Trade" },
    { id: "aggressive_analyst", group: "Risk" },
    { id: "conservative_analyst", group: "Risk" },
    { id: "neutral_analyst", group: "Risk" },
    { id: "portfolio_manager", group: "Decision" },
  ];
  ```

- [ ] **Step 4: Update DebateBubbles**

In `webapp/frontend/components/features/debate-bubbles.tsx`:

- The component currently accepts `sides: { side, label, messages, tone? }[]`. Drop the `label` prop and translate from `side`:
  ```tsx
  import { useTranslations } from "next-intl";
  // inside:
  const t = useTranslations("runDetail");
  // and replace <h4>{s.label}</h4> with <h4>{t(`debate.side.${s.side}`)}</h4>
  // and replace "Round {m.round}" with t("debate.round", { n: m.round })
  ```
- Update the caller in `app/runs/[runId]/page.tsx` to no longer pass `label`.

- [ ] **Step 5: Update DecisionCard**

In `webapp/frontend/components/features/decision-card.tsx`:

- `import { useTranslations } from "next-intl";` `const t = useTranslations("runDetail.decision");`
- "Final Decision" → `t("finalLabel")`
- "Run took N.Ns" → `t("tookSeconds", { s: (durationMs/1000).toFixed(1) })`

- [ ] **Step 6: Update MetricsPanel + ToolLog**

In `metrics-panel.tsx`:

- `const t = useTranslations("runDetail.metrics");`
- Replace the five labels: `llm`, `tools`, `tokensIn`, `tokensOut`, `elapsed`.

In `tool-log.tsx`:

- `const t = useTranslations("runDetail.toolLog");`
- Empty state → `t("empty")`.

- [ ] **Step 7: Update the page itself**

In `app/runs/[runId]/page.tsx`:

- Add `import { useTranslations } from "next-intl"; const t = useTranslations("runDetail");`.
- Status line: `Status: {state.status}` → `{t("status", { state: state.status })}`.
- "Waiting for output…" → `{t("waiting")}`.
- Error fallback → `{state.errorMessage ?? t("errorTitleFallback")}`.
- "Tool calls" heading → `{t("toolLog.heading")}`.

- [ ] **Step 8: Verify + commit**

```bash
cd webapp/frontend && npm run check:messages && rm -rf .next && npm run build 2>&1 | grep -E "Compiled|Failed" | head
git add webapp/frontend/i18n/messages webapp/frontend/app/runs/\[runId\]/page.tsx webapp/frontend/components/features/pipeline-stepper.tsx webapp/frontend/components/features/debate-bubbles.tsx webapp/frontend/components/features/decision-card.tsx webapp/frontend/components/features/metrics-panel.tsx webapp/frontend/components/features/tool-log.tsx
git commit -m "i18n: run detail page + child components (EN + 中文)"
```

---

## Phase 7 — Locale-aware number/date formatting

### Task 7.1: lib/format.ts gains locale

**Files:**
- Modify: `webapp/frontend/lib/format.ts`
- Modify: `webapp/frontend/components/features/run-card.tsx`
- Modify: `webapp/frontend/app/dashboard/page.tsx`
- Modify: `webapp/frontend/app/runs/page.tsx`
- Modify: `webapp/frontend/app/markets/[ticker]/page.tsx`

- [ ] **Step 1: Update format.ts**

Replace `webapp/frontend/lib/format.ts`:

```ts
export function ratingColor(rating: string | null | undefined): string {
  if (!rating) return "text-zinc-500";
  const r = rating.toUpperCase();
  if (r.includes("BUY")) return "text-bull";
  if (r.includes("SELL")) return "text-bear";
  return "text-hold";
}

export function pct(n: number | null | undefined, locale = "en", digits = 2): string {
  if (n == null || Number.isNaN(n)) return "—";
  return new Intl.NumberFormat(locale, {
    signDisplay: "exceptZero",
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(n) + "%";
}

export function elapsed(ms: number): string {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  return m ? `${m}m ${s % 60}s` : `${s}s`;
}

/** Format an ISO date (yyyy-mm-dd) in the given locale. */
export function fmtDate(iso: string, locale = "en"): string {
  // Construct as UTC midnight so 2026-01-15 doesn't drift backwards in some zones.
  const d = new Date(`${iso}T00:00:00Z`);
  return new Intl.DateTimeFormat(locale, { year: "numeric", month: "short", day: "numeric" })
    .format(d);
}
```

- [ ] **Step 2: Use locale in RunCard**

In `webapp/frontend/components/features/run-card.tsx`:

- Add `import { useLocale } from "next-intl";` and call `const locale = useLocale();` inside the component.
- Replace `{entry.date}` with `{fmtDate(entry.date, locale)}` (and import `fmtDate`).
- Replace `pct(entry.alpha)` with `pct(entry.alpha, locale)`.

- [ ] **Step 3: Use locale in server components**

In `app/dashboard/page.tsx`, `app/runs/page.tsx`, and `app/markets/[ticker]/page.tsx`:

- Add `import { getLocale } from "next-intl/server";` at the top.
- Inside the async function: `const locale = await getLocale();`.
- Pass `locale` to every `pct(...)` and `fmtDate(...)` call.

- [ ] **Step 4: Build**

```bash
cd webapp/frontend && rm -rf .next && npm run build 2>&1 | grep -E "Compiled|Failed" | head
```
Expected: `Compiled successfully`.

- [ ] **Step 5: Commit**

```bash
git add webapp/frontend/lib/format.ts webapp/frontend/components/features/run-card.tsx webapp/frontend/app/dashboard/page.tsx webapp/frontend/app/runs/page.tsx webapp/frontend/app/markets/\[ticker\]/page.tsx
git commit -m "i18n: locale-aware number + date formatting"
```

---

## Phase 8 — Final verification + docs

### Task 8.1: Frontend test sweep

**Files:**
- Modify: `webapp/frontend/tests/run-store.test.ts` (sanity — no changes expected, just re-run)
- Modify: `webapp/frontend/tests/pipeline-stepper.test.tsx`

The pipeline stepper test renders with English labels in its assertions; under i18n it would fail because the component now consults `t(...)`. Wrap the test render with the provider.

- [ ] **Step 1: Update pipeline-stepper test to provide a messages context**

Replace the rendering helper inside `webapp/frontend/tests/pipeline-stepper.test.tsx` so each `render(...)` call wraps with `<NextIntlClientProvider>`:

```tsx
import { NextIntlClientProvider } from "next-intl";
// near the top of the file
const messages = {
  runDetail: {
    agent: {
      market_analyst: "Market Analyst",
      social_analyst: "Sentiment Analyst",
      news_analyst: "News Analyst",
      fundamentals_analyst: "Fundamentals Analyst",
      bull_researcher: "Bull Researcher",
      bear_researcher: "Bear Researcher",
      research_manager: "Research Manager",
      trader: "Trader",
      aggressive_analyst: "Aggressive Risk",
      conservative_analyst: "Conservative Risk",
      neutral_analyst: "Neutral Risk",
      portfolio_manager: "Portfolio Manager",
    },
    group: {
      Analysts: "Analysts", Research: "Research", Trade: "Trade", Risk: "Risk", Decision: "Decision",
    },
  },
};

function renderWithI18n(ui: React.ReactNode) {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      {ui}
    </NextIntlClientProvider>,
  );
}
```

Then replace every `render(<PipelineStepper ... />)` with `renderWithI18n(<PipelineStepper ... />)`.

- [ ] **Step 2: Run all frontend tests**

```bash
cd webapp/frontend && npm test 2>&1 | grep -E "Test Files|Tests "
```
Expected: all pass.

- [ ] **Step 3: Run all backend tests**

```bash
cd ../../ && pytest webapp/backend tests/test_llm_clients -q
```
Expected: all pass.

- [ ] **Step 4: Commit**

```bash
git add webapp/frontend/tests/pipeline-stepper.test.tsx
git commit -m "test(frontend): wrap PipelineStepper tests with NextIntlClientProvider"
```

### Task 8.2: Update workbench README (EN + 中文)

**Files:**
- Modify: `webapp/README.md`
- Modify: `webapp/README.zh-CN.md`

- [ ] **Step 1: Add new env vars + endpoints**

In both READMEs, in the environment-variables table, add (or update):

EN:
```
| `TRADINGAGENTS_CACHE_DIR` | engine + workbench | `~/.tradingagents` | Base path; workbench writes user defaults under `webapp/config.json` here. |
```

zh:
```
| `TRADINGAGENTS_CACHE_DIR` | 引擎 + 工作台 | `~/.tradingagents` | 基础路径；工作台把用户默认值写到该路径下的 `webapp/config.json`。 |
```

In the HTTP API table, add a row for `PUT /api/config` in both languages.

In the "Known limitations" section, **remove** the entries that are no longer limitations (token metrics is already wired in an earlier commit; you may keep it for context — but the SSE reconnect limitation stays).

In the EN README add a new section "Adding a provider" — three lines explaining how to edit `tradingagents/llm_clients/providers.yaml` and restart. Mirror to the zh README.

- [ ] **Step 2: Commit**

```bash
git add webapp/README.md webapp/README.zh-CN.md
git commit -m "docs: workbench README updates for providers.yaml, PUT /api/config, UI i18n"
```

### Task 8.3: Live smoke

This task is manual; reads observable behavior.

- [ ] **Step 1: Start backend**

```bash
uvicorn webapp.backend.main:app --port 8000 &
```

- [ ] **Step 2: Start frontend**

```bash
cd webapp/frontend && npm run dev
```

- [ ] **Step 3: Verify EN**

Open <http://localhost:3000>. Confirm:
- Landing renders all sections in English.
- Nav shows "Dashboard / Runs / New / Compare / Settings" and an "EN / 中" switcher at the right.
- `/settings` → Workbench defaults form is editable; pressing "Save defaults" shows the "Saved ✓" message and returns immediately on PUT /api/config.

- [ ] **Step 4: Switch to 中**

Click "中". The page reloads. Confirm:
- Nav and landing render in Simplified Chinese.
- Stat labels, headings, debate column titles, "未知错误" fallback, etc. all translate.
- Dates show in Chinese locale (e.g. "2026年1月15日") on dashboard / runs / markets.
- The cookie `NEXT_LOCALE=zh` is set.

- [ ] **Step 5: Verify the two language axes are independent**

In the wizard's Step 4, with the UI in Chinese, the "报告语言" dropdown still offers `English / Chinese (中文) / Japanese / Custom…` and submitting `output_language: "English"` produces an English report stream. (Smoke check via SSE event sequence.)

If anything is off, fix the relevant key/binding and re-commit; otherwise no commit needed.

---

## Self-Review Notes

- **Spec coverage**:
  - §3 providers YAML → Phase 1.
  - §6 factory refactor → Task 1.2.
  - §7 workbench_config + PUT /api/config → Phase 2.
  - §8 wizard fields → Task 4.2.
  - §9 Settings page → Task 4.3.
  - §10 i18n architecture (cookie-driven, no URL prefix) → Phase 5 (Tasks 5.1–5.4) + LanguageSwitcher → Task 5.3.
  - §11 output-language vs UI-language separation → wizard's "Output language" field stays where it is; LanguageSwitcher is purely UI; copy in Settings (§9 messages "outputLanguage" label) is explicit. Verified by Task 8.3 Step 5.
  - §12 glossary → Task 5.1.
  - §13 errors → providers.yaml errors covered by Task 1.2 tests; HttpUrl 422 in Task 3.1; PUT 422 in Task 2.2; missing key behavior preserved.
  - §14 testing strategy → tests added in Tasks 1.2, 1.3, 2.1, 2.2, 2.3, 3.1, 8.1.
  - §15 out of scope honored.
- **Type consistency**: `ProviderMeta` field names match between Python and the wire schema in `/api/providers/health`; `RunRequest.backend_url` matches `lib/types.ts`; the `LOCALES = ["en","zh"]` tuple is the single source of truth for locales.
- **No placeholders detected.**
- **One small risk**: Task 6.2 changes the data structures inside `app/page.tsx`. The instructions describe the new shapes in prose rather than as a full replacement file (because the existing file is ~280 lines and rewriting it inline would dwarf the rest of the plan). The implementer must read the current file before making the change and apply the substitutions described. Estimated risk: moderate; mitigated by the build check at the end of the task.
