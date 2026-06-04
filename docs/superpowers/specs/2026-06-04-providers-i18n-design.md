# Providers / api_base / i18n — Design

> **English** | (Chinese version will follow as needed)

- **Status**: Draft
- **Date**: 2026-06-04
- **Owner**: Workbench follow-up
- **Related**: `tradingagents/llm_clients/factory.py`, `webapp/backend/routes/*`, `webapp/frontend/app/*`

## 1. Problem & Goals

Three follow-up capabilities for the Web Workbench. The engine already supports most of what we need; the gap is exposing it to the browser cleanly and removing a few sources of duplication.

1. **Configurable LLM `api_base` from the UI.** The engine has accepted `backend_url` on every client (`OpenAIClient`, `AnthropicClient`, `GoogleClient`, `AzureOpenAIClient`) for a while. The CLI honors it. The Web `RunRequest` schema does not, so users can't point a run at a self-hosted vLLM, a regional Qwen endpoint, or Ollama on a different host without editing env vars.
2. **Add new LLM providers without touching code.** Today `factory.py` hardcodes a tuple `_OPENAI_COMPATIBLE` and an `if/elif` chain for the four heterogeneous clients; `webapp/backend/routes/providers.py` keeps its **own** parallel list. The two drift. We move both to one YAML source.
3. **Chinese (and beyond) end-to-end.** Two distinct concepts that today are conflated:
   - **Output language** (what the agents write in): already plumbed via `output_language`, but the wizard hardcodes `"English"`.
   - **UI language** (what the workbench chrome displays): not implemented; the whole UI is English.

**Goals.** Land all three behind a single coherent surface: a settings page that persists user defaults, a wizard that lets you override per run, and a workbench whose UI speaks Chinese to Chinese users while letting them still ask for English reports if they want.

**Non-goals.** Runtime-GUI provider CRUD (still done by editing YAML). Translating agent system prompts. CLI changes beyond what falls out of refactoring `factory.py`.

## 2. Users & Top Tasks

Single-user local research tool (same as the workbench). New top tasks unlocked here:

1. Set a default provider, models, base URL, and output language **once** from `/settings`; override any of them per run.
2. Add a new OpenAI-compatible provider (a corporate vLLM gateway, a fresh Together/Groq endpoint, …) by editing `providers.yaml` — no code change, no rebuild.
3. Run the workbench in Simplified Chinese: navigation, wizard, dashboard, settings, history, charts captions — all localized; user can still pick "English" as the report language if they want.

## 3. Scope Summary

| Capability | Engine | CLI | Web (today) | Web (after) |
|---|---|---|---|---|
| Output language | ✅ | ✅ | ⚠️ schema accepts, UI hardcodes `"English"` | ✅ wizard dropdown + Settings default |
| Custom `api_base` | ✅ via `backend_url` | ✅ | ❌ schema missing | ✅ wizard field + Settings default |
| Provider list | ✅ 13 (hardcoded) | ✅ | ✅ (separate hardcoded list — drifts) | ✅ from `providers.yaml`, single source |
| UI i18n | n/a | n/a | ❌ English only | ✅ English + Simplified Chinese (`next-intl`, cookie-driven) |

## 4. File Structure

```
tradingagents/llm_clients/
├── providers.yaml          ← NEW: provider metadata
└── factory.py              ← MODIFIED: load YAML, route by id

tests/test_llm_clients/
└── test_providers_yaml.py  ← NEW

webapp/backend/
├── schemas.py              ← MODIFIED: RunRequest gets `backend_url: HttpUrl | None`
├── workbench_config.py     ← NEW: atomic JSON persistence at ~/.tradingagents/webapp/config.json
├── routes/
│   ├── providers.py        ← MODIFIED: read from factory.get_providers() (single source)
│   ├── runs.py             ← MODIFIED: pass req.backend_url into the engine config
│   └── config.py           ← MODIFIED: GET merges DEFAULT_CONFIG + workbench overrides; new PUT
└── tests/
    ├── test_providers_route.py     ← MODIFIED: adapt to YAML-driven list
    ├── test_config_route.py        ← MODIFIED: cover GET + PUT round trip
    └── test_workbench_config.py    ← NEW

webapp/frontend/
├── i18n/
│   ├── request.ts          ← NEW: next-intl getRequestConfig (cookie + Accept-Language)
│   ├── locales.ts          ← NEW: export const LOCALES = ["en","zh"] as const
│   └── messages/
│       ├── en.json         ← NEW
│       └── zh.json         ← NEW
├── middleware.ts           ← NEW: next-intl middleware (cookie only, no URL rewrite)
├── lib/types.ts            ← MODIFIED: RunRequest gets backend_url; add LOCALE type
├── lib/api.ts              ← MODIFIED: putConfig(...) method
├── components/features/
│   └── language-switcher.tsx   ← NEW
├── next.config.mjs         ← MODIFIED: wrap with createNextIntlPlugin
├── app/
│   ├── layout.tsx          ← MODIFIED: NextIntlClientProvider, html lang={locale}
│   ├── page.tsx            ← MODIFIED: t("landing.*") with rich-text spans
│   ├── runs/new/page.tsx   ← MODIFIED: API base field, language dropdown; t("wizard.*")
│   ├── settings/page.tsx   ← MODIFIED: from static JSON to controlled form with Save
│   ├── dashboard/page.tsx, runs/page.tsx, markets/[ticker]/page.tsx,
│   │   compare/page.tsx, runs/[runId]/page.tsx
│   │                       ← MODIFIED: t("...") for every visible string
│   └── components/features/nav.tsx, run-card.tsx, debate-bubbles.tsx, … ← MODIFIED for t("...")
└── scripts/check-messages.ts  ← NEW: assert en/zh key sets match

docs/superpowers/specs/
├── 2026-06-04-providers-i18n-design.md  ← THIS DOC
└── 2026-06-04-glossary.md               ← NEW: term ↔ 中文 lookup
```

## 5. providers.yaml

Single source of truth for both the engine's `factory.create_llm_client(...)` and the backend's `GET /api/providers/health`.

```yaml
- id: openai
  label: OpenAI
  env_key: OPENAI_API_KEY
  openai_compatible: true
  default_base_url: null            # null → SDK default
  default_deep_model: gpt-5.5
  default_quick_model: gpt-5.4-mini

- id: anthropic
  label: Anthropic
  env_key: ANTHROPIC_API_KEY
  openai_compatible: false
  client: anthropic                 # routes to AnthropicClient
  default_base_url: null
  default_deep_model: claude-4.6-sonnet
  default_quick_model: claude-4.6-haiku

- id: google
  label: Google
  env_key: GOOGLE_API_KEY
  openai_compatible: false
  client: google
  default_base_url: null

- id: azure
  label: Azure OpenAI
  env_key: AZURE_OPENAI_API_KEY
  openai_compatible: false
  client: azure

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

- id: xai
  label: xAI
  env_key: XAI_API_KEY
  openai_compatible: true

- id: deepseek
  label: DeepSeek
  env_key: DEEPSEEK_API_KEY
  openai_compatible: true
  default_base_url: https://api.deepseek.com

- id: openrouter
  label: OpenRouter
  env_key: OPENROUTER_API_KEY
  openai_compatible: true
  default_base_url: https://openrouter.ai/api/v1

- id: ollama
  label: Ollama (local)
  env_key: ""                       # empty → no key check
  openai_compatible: true
  default_base_url: http://localhost:11434/v1
```

`client` is only consulted when `openai_compatible: false`; valid values are `anthropic`, `google`, `azure`. Adding a new OpenAI-compatible provider is six lines of YAML and zero code changes.

## 6. factory.py Refactor

```python
# tradingagents/llm_clients/factory.py
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path
from typing import Optional
import yaml

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
    pass


@lru_cache(maxsize=1)
def _providers() -> dict[str, ProviderMeta]:
    path = Path(__file__).parent / "providers.yaml"
    try:
        rows = yaml.safe_load(path.read_text()) or []
    except yaml.YAMLError as exc:
        raise ProviderConfigError(f"Failed to parse {path}: {exc}") from exc
    seen: dict[str, ProviderMeta] = {}
    for r in rows:
        meta = ProviderMeta(**r)
        if meta.id in seen:
            raise ProviderConfigError(f"Duplicate provider id: {meta.id}")
        if not meta.openai_compatible and meta.client not in {"anthropic", "google", "azure"}:
            raise ProviderConfigError(f"Provider {meta.id}: invalid client={meta.client!r}")
        seen[meta.id] = meta
    return seen


def get_providers() -> list[ProviderMeta]:
    """Public read-only view; used by both the engine and the web backend."""
    return list(_providers().values())


def create_llm_client(provider: str, model: str, base_url: Optional[str] = None, **kw):
    meta = _providers().get(provider.lower())
    if meta is None:
        raise ValueError(f"Unsupported LLM provider: {provider}")
    base = base_url or meta.default_base_url
    if meta.openai_compatible:
        from .openai_client import OpenAIClient
        return OpenAIClient(model, base, provider=meta.id, **kw)
    if meta.client == "anthropic":
        from .anthropic_client import AnthropicClient
        return AnthropicClient(model, base, **kw)
    if meta.client == "google":
        from .google_client import GoogleClient
        return GoogleClient(model, base, **kw)
    if meta.client == "azure":
        from .azure_client import AzureOpenAIClient
        return AzureOpenAIClient(model, base, **kw)
    raise ProviderConfigError(f"Unreachable: provider {meta.id} validated but no client matched")
```

Semantics are identical to today's behavior; only the source of truth moves.

## 7. Settings Persistence

A new module persists user defaults to `~/.tradingagents/webapp/config.json` (path derived from `TRADINGAGENTS_CACHE_DIR` when set):

```python
# webapp/backend/workbench_config.py
SAFE_KEYS = {
    "llm_provider", "deep_think_llm", "quick_think_llm",
    "backend_url", "temperature", "output_language",
}

def load() -> dict: ...      # returns {} if file is absent
def save(updates: dict) -> dict: ...   # whitelist filter + atomic write (tmp + os.replace)
```

`GET /api/config` returns `{...DEFAULT_CONFIG_safe, ...workbench_overrides}`.
`PUT /api/config` accepts a partial dict; unknown keys → 422; merges + saves atomically.

`DEFAULT_CONFIG` in `tradingagents/default_config.py` stays untouched — this file affects only the workbench's "what to prefill" behavior, not the CLI or Python API.

## 8. Wizard UX changes

**Step 3 (LLM provider & models)** gains one optional field:

- **API base URL** *(optional)* — placeholder shows the chosen provider's `default_base_url` (e.g. selecting Qwen shows `https://dashscope-intl.aliyuncs.com/compatible-mode/v1`). Empty → SDK default. Validated as `HttpUrl`, trailing slash stripped client-side.

**Step 4 (advanced)** gains one dropdown:

- **Output language** — English / Chinese (中文) / Japanese / Custom. Custom reveals a text field; `agent_utils._language_directive` accepts any string. Initial value loaded from `GET /api/config`.

Initial values for every wizard field come from `/api/config` so changing a default in Settings really does change what the wizard prefills.

## 9. Settings UX changes

The current static JSON pre-block on `/settings` is replaced by a controlled form with two cards:

- **Workbench defaults** — provider, deep/quick models (with the provider's defaults pre-filled as placeholders), `backend_url`, `temperature`, **Output language** (the engine knob), with a **Save defaults** button calling `PUT /api/config`. Toast on success.
- **Display language** — separate card with the EN/中文 switch. Explicit copy: *"This only affects the workbench UI. Report language is set per run."* — to defuse the obvious confusion between the two language settings.

The providers list (with red/green keys) stays at the top, but now reads from `factory.get_providers()` via `/api/providers/health`.

## 10. i18n architecture (UI localization)

**Library**: `next-intl`. **Mechanism**: cookie + browser `Accept-Language` fallback. **No URL rewriting** — `/`, `/dashboard`, etc. stay locale-neutral.

```
middleware.ts:
  - On first request, read NEXT_LOCALE cookie; if missing, negotiate from
    Accept-Language against LOCALES = ["en","zh"], default "en", set cookie.
  - Never rewrite the URL.

i18n/request.ts (getRequestConfig):
  - Read the cookie set by the middleware
  - Load messages/{locale}.json
  - Return { locale, messages }

app/layout.tsx:
  - Get locale on the server side
  - Set <html lang={locale}>
  - Wrap children in <NextIntlClientProvider locale={locale} messages={...}>
```

**Namespaces** (rough sizes):

| Namespace | ~strings |
|---|---|
| `nav` | 6 |
| `landing` | 35 |
| `dashboard` | 15 |
| `wizard` | 30 |
| `history` | 10 |
| `markets` | 10 |
| `settings` | 20 |
| `compare` | 5 |
| `runDetail` | 15 |
| `common` | 10 |
| **Total** | **~156** |

**Rich-text fragments.** Landing's hero "A trading firm, staffed by <accent>LLM agents</accent>" uses `t.rich("landing.headline", { accent: (c) => <span className="text-blue-400 text-glow">{c}</span> })`. Translators (us in this case) only touch words — styling stays in code.

**Number/date locale.** `lib/format.ts` gets a locale-aware version:

```ts
export function pct(n: number | null, locale: string, digits = 2): string {
  if (n == null || Number.isNaN(n)) return "—";
  return new Intl.NumberFormat(locale, { signDisplay: "exceptZero", minimumFractionDigits: digits, maximumFractionDigits: digits })
    .format(n / 100);
}
```

`runs` list dates pass through `Intl.DateTimeFormat(locale)`.

**LanguageSwitcher.** A compact EN/中 toggle at the right end of the nav, writes the cookie and reloads (or uses `router.refresh()` after `document.cookie = ...`).

## 11. Output language vs UI language

Two independent knobs that the codebase must never conflate:

- `output_language` — sent in `RunRequest`, lives in `default_config.py`, controls the agent prompts. A Chinese user might still want English reports.
- UI locale — cookie-driven, controls `messages/{locale}.json`. An English user might want a 中文 report.

The **only** place we make this explicit to users is the Settings page (§9 copy). Everywhere else, the wizard's "Output language" stays where it is and the LanguageSwitcher stays in the nav.

## 12. Translation glossary

Curated by us (not auto-translated) to keep terminology consistent across all 156 strings. Stored at `docs/superpowers/specs/2026-06-04-glossary.md`:

| English | 中文 |
|---|---|
| Run | 运行 |
| Reflection | 复盘 |
| Pending reflection | 待复盘 |
| Alpha (α) | 超额收益 (α) |
| Raw return | 原始收益 |
| Benchmark | 基准 |
| Bull vs Bear | 多空辩论 |
| Risk committee | 风险委员会 |
| Aggressive / Conservative / Neutral | 激进 / 保守 / 中性 |
| Portfolio manager | 投资经理 |
| Trader | 交易员 |
| Research manager | 研究主管 |
| Decision log | 决策日志 |
| Checkpoint resume | 检查点恢复 |
| Output language | 报告语言 |
| Workbench | 工作台 |
| Provider | 提供商 |
| API base URL | API 基址 |
| Missing key | 缺少密钥 |
| Configured | 已配置 |
| Save defaults | 保存默认值 |
| Debate rounds | 辩论轮数 |
| Risk debate rounds | 风险辩论轮数 |

(The glossary will grow as strings are extracted; this is the bootstrap set.)

## 13. Errors & edges

- **Broken YAML** — `_providers()` raises `ProviderConfigError`; FastAPI lifespan catches and exposes a 500 with a diagnostic message at `/api/providers/health`. The CLI surfaces the same error rather than a random `ValueError`.
- **Invalid `backend_url`** — pydantic `HttpUrl` rejects on the wire (422); frontend strips trailing slashes before submit.
- **PUT /api/config** — unknown key → 422; non-whitelisted key → 403; disk write failure → 500 with reason.
- **Missing API key for selected provider** — already handled: the wizard blocks submission when the chosen provider is "Missing key" red.
- **Missing translation key at runtime** — `next-intl` throws in dev, falls back to the key in production. The `check-messages.ts` script prevents that from shipping.
- **Cookie absent + Accept-Language unparseable** — fall back to `en`.

## 14. Testing strategy

| Layer | Tool | Focus |
|---|---|---|
| Engine unit | pytest | YAML parsing, dup-id rejection, invalid client rejection; `create_llm_client` routes correctly for each `id` (clients mocked) |
| Backend unit | pytest | `workbench_config` atomic write + whitelist; `routes/config` GET/PUT; `routes/providers` reflects YAML; `RunRequest.backend_url` validated by `HttpUrl` |
| Backend integration | pytest + httpx | PUT → GET round trip; PUT with unknown key → 422 |
| Frontend unit | vitest | `lib/api.putConfig`; `pct(n, locale)`; `LanguageSwitcher` writes cookie |
| Key set parity | custom script | `scripts/check-messages.ts` compares en.json vs zh.json key sets; CI fails on drift |
| Frontend visual | manual | Switch to zh, walk all 8 pages: no clipped cards, no broken layouts, dates/numbers locale-aware |

~14 new tests; one new CI script.

## 15. Out of scope (this spec)

- Runtime GUI for adding providers (still done via YAML editing).
- Translating system prompts (agents already use `output_language` for their own output).
- Languages beyond English + Simplified Chinese (the framework supports adding more; we don't ship them).
- Migration of `default_config.py` env-var registry to the same YAML (separate refactor).

## 16. Effort estimate

| Block | Hours |
|---|---|
| §5–§6 `providers.yaml` + `factory.py` refactor + engine unit tests | 2.0 |
| §7 `workbench_config` + `PUT /api/config` + backend tests | 2.0 |
| §8–§9 wizard fields + Settings form | 2.0 |
| §10 `next-intl` plumbing (middleware/provider/config) | 1.5 |
| §10 extract 156 strings + replace with `t("...")` across all pages/components | 4.0 |
| §11–§12 Chinese translation (with glossary curation) | 2.0 |
| `check-messages.ts` + locale-aware `lib/format.ts` + LanguageSwitcher | 1.5 |
| Integration + docs sync (English + Chinese workbench README) | 2.0 |
| **Total** | **~17h** (≈ two focused working days) |
