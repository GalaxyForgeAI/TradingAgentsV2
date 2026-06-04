> [English](./2026-06-04-frontend-workbench.md) | **中文**

> ⚠️ **翻译进行中（未完成）。** 本中文版目前覆盖到 **Phase 1（schemas）** 为止
> （Phase 0、Phase 1）。Phase 2–8（RunRegistry、StreamAdapter、GraphRunner、各路由、
> 整个前端、启动脚本与验证、自查清单）尚未翻译——这些部分以英文原版
> [2026-06-04-frontend-workbench.md](./2026-06-04-frontend-workbench.md) 为准。
> 翻译因会话额度限制中断，待续译。注意：计划中的所有代码块、命令、提交信息均为逐字
> 保留，本就以英文/代码原样呈现，无需翻译。

> **致 agentic 工作者：** 必用子技能：请使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实施本计划。步骤采用复选框（`- [ ]`）语法进行跟踪。

**目标：** 构建一个 Next.js 15 + FastAPI 工作台，为现有的 `TradingAgentsGraph` 引擎封装实时流式传输、运行历史、回放、多次运行对比、按股票代码的图表叠加以及配置管理功能。

**架构：** FastAPI 服务以进程内方式导入 `TradingAgentsGraph`，暴露 REST 端点（用于配置/历史）以及一个 SSE 流——将 `graph.stream(stream_mode="values")` 的数据块转换为固定的事件信封格式。Next.js 15（App Router）前端通过 TanStack Query 和带类型的 `EventSource` hook 消费 API 及 SSE 流，将事件路由至驱动运行详情 UI 的 Zustand 切片。

**技术栈：** Python 3.10+ · FastAPI · uvicorn · pydantic v2 · pytest + httpx · Next.js 15 · TypeScript · Tailwind v4 · shadcn/ui · TanStack Query · Zustand · lightweight-charts · Recharts · Framer Motion · Vitest · Playwright。

---

## 文件结构

### 后端（`webapp/backend/` 下的新包）

```
webapp/backend/
├── __init__.py
├── main.py                FastAPI app factory; CORS; lifespan.
├── settings.py            Reads TRADINGAGENTS_* env; exposes config paths.
├── schemas.py             Pydantic DTOs (RunRequest, RunSummary, EventEnvelope, Config, MarketBars, …).
├── run_registry.py        Process-wide in-memory registry of active runs and their event queues + ring buffer.
├── streaming.py           Translates AgentState chunks → EventEnvelope; persists JSONL after run.
├── graph_runner.py        Thin async wrapper around TradingAgentsGraph.stream + reflection backfill.
├── routes/
│   ├── __init__.py
│   ├── runs.py            POST /api/runs, GET /api/runs, GET /api/runs/{id}, /stream, /cancel, /reflect.
│   ├── config.py          GET/PUT /api/config (merged DEFAULT_CONFIG + env overrides).
│   ├── providers.py       GET /api/providers/health.
│   ├── markets.py         GET /api/markets/{ticker} (OHLC + indicators).
│   └── memory.py          Helpers for parsing trading_memory.md (re-exports TradingMemoryLog).
└── tests/
    ├── conftest.py        Stubbed graph fixture (yields scripted chunks).
    ├── test_streaming.py
    ├── test_runs.py
    ├── test_config.py
    ├── test_markets.py
    └── test_providers.py
```

### 前端（`webapp/frontend/` 下的新应用）

```
webapp/frontend/
├── app/
│   ├── layout.tsx                 Root layout + Tailwind + providers.
│   ├── page.tsx                   / Dashboard
│   ├── runs/page.tsx              /runs history list
│   ├── runs/new/page.tsx          /runs/new wizard
│   ├── runs/[runId]/page.tsx      /runs/[runId] live + replay
│   ├── markets/[ticker]/page.tsx  /markets/[ticker]
│   ├── compare/page.tsx           /compare
│   └── settings/page.tsx          /settings
├── components/
│   ├── ui/                        shadcn primitives (button, card, dialog, …)
│   └── features/
│       ├── pipeline-stepper.tsx
│       ├── debate-bubbles.tsx
│       ├── decision-card.tsx
│       ├── metrics-panel.tsx
│       ├── tool-log.tsx
│       ├── run-card.tsx
│       ├── price-chart.tsx        lightweight-charts wrapper
│       ├── indicator-chart.tsx    Recharts MACD/RSI/BB
│       ├── wizard/*.tsx           one file per step
│       └── compare-grid.tsx
├── lib/
│   ├── api.ts                     Typed REST client.
│   ├── sse.ts                     useEventStream() hook with Last-Event-ID.
│   ├── types.ts                   Shared with backend (DTOs).
│   └── format.ts                  Numbers, dates, ratings → color.
├── stores/
│   ├── run-store.ts               Zustand: per-run state machine.
│   └── ui-store.ts                Global UI prefs (sidebar collapsed, theme).
├── tests/
│   ├── pipeline-stepper.test.tsx
│   ├── run-store.test.ts
│   ├── sse.test.ts
│   └── e2e/                       Playwright specs + recorded JSONL fixture.
├── package.json
├── tsconfig.json
├── tailwind.config.ts
├── postcss.config.js
├── next.config.mjs
└── components.json                shadcn config
```

### 顶层新增文件

```
scripts/web.sh                     Boots uvicorn + next dev concurrently.
pyproject.toml                     Add fastapi/uvicorn/sse-starlette to deps.
```

---

## 阶段 0 — 仓库初始化

### Task 0.1：添加后端依赖

**文件：**
- 修改：`pyproject.toml`

- [ ] **步骤 1：编辑 pyproject.toml**

在 `dependencies` 列表中添加以下内容（保持排序顺序，保留现有条目）：

```
    "fastapi>=0.115.0",
    "uvicorn[standard]>=0.32.0",
    "sse-starlette>=2.1.3",
    "httpx>=0.27.0",
    "pytest-asyncio>=0.24.0",
```

- [ ] **步骤 2：安装**

运行：`pip install -e .`
预期：成功解析并安装 fastapi、uvicorn、sse-starlette、httpx、pytest-asyncio。

- [ ] **步骤 3：验证导入**

运行：`python -c "import fastapi, uvicorn, sse_starlette, httpx; print('ok')"`
预期：`ok`

- [ ] **步骤 4：提交**

```bash
git add pyproject.toml
git commit -m "build: add fastapi/uvicorn/sse-starlette/httpx for web backend"
```

### Task 0.2：后端包骨架

**文件：**
- 创建：`webapp/__init__.py`
- 创建：`webapp/backend/__init__.py`
- 创建：`webapp/backend/tests/__init__.py`
- 创建：`webapp/backend/main.py`
- 创建：`webapp/backend/tests/test_health.py`

- [ ] **步骤 1：编写失败的测试**

`webapp/backend/tests/test_health.py`：

```python
from fastapi.testclient import TestClient

from webapp.backend.main import create_app


def test_health_endpoint_ok():
    client = TestClient(create_app())
    resp = client.get("/api/health")
    assert resp.status_code == 200
    assert resp.json() == {"status": "ok"}
```

- [ ] **步骤 2：运行测试以确认失败**

运行：`pytest webapp/backend/tests/test_health.py -v`
预期：`webapp.backend.main` 的 ImportError。

- [ ] **步骤 3：创建空包文件**

`webapp/__init__.py`：空文件。
`webapp/backend/__init__.py`：空文件。
`webapp/backend/tests/__init__.py`：空文件。

- [ ] **步骤 4：实现应用工厂**

`webapp/backend/main.py`：

```python
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware


def create_app() -> FastAPI:
    app = FastAPI(title="TradingAgents Workbench API", version="0.1.0")
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["http://localhost:3000"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.get("/api/health")
    def health() -> dict[str, str]:
        return {"status": "ok"}

    return app


app = create_app()
```

- [ ] **步骤 5：运行测试**

运行：`pytest webapp/backend/tests/test_health.py -v`
预期：PASS。

- [ ] **步骤 6：更新 pyproject 测试路径**

在 `pyproject.toml` 中，更新 `[tool.pytest.ini_options]`：

```toml
[tool.pytest.ini_options]
testpaths = ["tests", "webapp/backend/tests"]
addopts = "-ra --strict-markers"
asyncio_mode = "auto"
markers = [
    "unit: fast isolated unit tests",
    "integration: tests requiring external services",
    "smoke: quick sanity-check tests",
]
filterwarnings = [
    "ignore::DeprecationWarning",
]
```

- [ ] **步骤 7：运行全量测试**

运行：`pytest -q`
预期：现有测试套件继续通过，且新测试也被包含在内。

- [ ] **步骤 8：提交**

```bash
git add webapp pyproject.toml
git commit -m "feat(backend): scaffold FastAPI app with /api/health"
```

---

## 阶段 1 — Schemas

### Task 1.1：Pydantic DTOs

**文件：**
- 创建：`webapp/backend/schemas.py`
- 创建：`webapp/backend/tests/test_schemas.py`

- [ ] **步骤 1：编写失败的测试**

`webapp/backend/tests/test_schemas.py`：

```python
import pytest
from pydantic import ValidationError

from webapp.backend.schemas import (
    AgentName,
    AgentStatePayload,
    EventEnvelope,
    EventType,
    RunRequest,
)


def test_run_request_minimal_defaults():
    req = RunRequest(ticker="AAPL", trade_date="2026-01-15")
    assert req.ticker == "AAPL"
    assert req.analysts == ["market", "social", "news", "fundamentals"]
    assert req.max_debate_rounds >= 1


def test_run_request_rejects_empty_ticker():
    with pytest.raises(ValidationError):
        RunRequest(ticker="", trade_date="2026-01-15")


def test_event_envelope_round_trip():
    payload = AgentStatePayload(agent=AgentName.MARKET_ANALYST, status="running")
    evt = EventEnvelope(id=1, type=EventType.AGENT_STATE, run_id="r1", payload=payload.model_dump())
    dumped = evt.model_dump_json()
    parsed = EventEnvelope.model_validate_json(dumped)
    assert parsed.type == EventType.AGENT_STATE
    assert parsed.payload["agent"] == "market_analyst"
```

- [ ] **步骤 2：运行测试以确认失败**

运行：`pytest webapp/backend/tests/test_schemas.py -v`
预期：ImportError。

- [ ] **步骤 3：实现 schemas**

`webapp/backend/schemas.py`：

```python
from __future__ import annotations

import enum
from datetime import datetime, timezone
from typing import Any, Literal

from pydantic import BaseModel, Field, field_validator


class AgentName(str, enum.Enum):
    MARKET_ANALYST = "market_analyst"
    SOCIAL_ANALYST = "social_analyst"
    NEWS_ANALYST = "news_analyst"
    FUNDAMENTALS_ANALYST = "fundamentals_analyst"
    BULL_RESEARCHER = "bull_researcher"
    BEAR_RESEARCHER = "bear_researcher"
    RESEARCH_MANAGER = "research_manager"
    TRADER = "trader"
    AGGRESSIVE_ANALYST = "aggressive_analyst"
    CONSERVATIVE_ANALYST = "conservative_analyst"
    NEUTRAL_ANALYST = "neutral_analyst"
    PORTFOLIO_MANAGER = "portfolio_manager"


class EventType(str, enum.Enum):
    RUN_STARTED = "run.started"
    AGENT_STATE = "agent.state"
    AGENT_REPORT = "agent.report"
    TOOL_CALL = "tool.call"
    DEBATE_MESSAGE = "debate.message"
    METRICS_TICK = "metrics.tick"
    RUN_DONE = "run.done"
    RUN_ERROR = "run.error"


AgentStatus = Literal["pending", "running", "done", "error"]


class RunRequest(BaseModel):
    ticker: str = Field(min_length=1, max_length=24)
    trade_date: str = Field(pattern=r"^\d{4}-\d{2}-\d{2}$")
    analysts: list[Literal["market", "social", "news", "fundamentals"]] = Field(
        default_factory=lambda: ["market", "social", "news", "fundamentals"]
    )
    llm_provider: str = "openai"
    deep_think_llm: str | None = None
    quick_think_llm: str | None = None
    max_debate_rounds: int = Field(default=1, ge=1, le=10)
    max_risk_discuss_rounds: int = Field(default=1, ge=1, le=10)
    temperature: float | None = Field(default=None, ge=0.0, le=2.0)
    checkpoint_enabled: bool = False
    output_language: str = "English"

    @field_validator("ticker")
    @classmethod
    def upper_ticker(cls, v: str) -> str:
        return v.strip().upper()


class AgentStatePayload(BaseModel):
    agent: AgentName
    status: AgentStatus


class AgentReportPayload(BaseModel):
    field: str
    markdown: str


class ToolCallPayload(BaseModel):
    agent: AgentName
    tool: str
    args: dict[str, Any] = Field(default_factory=dict)
    result_preview: str | None = None


class DebateMessagePayload(BaseModel):
    side: Literal["bull", "bear", "aggressive", "conservative", "neutral"]
    round: int
    text: str


class MetricsTickPayload(BaseModel):
    llm_calls: int = 0
    tools: int = 0
    tokens_in: int = 0
    tokens_out: int = 0
    elapsed_ms: int = 0


class RunDonePayload(BaseModel):
    decision: str
    rating: str | None = None
    duration_ms: int


class RunErrorPayload(BaseModel):
    message: str
    stack: str | None = None


class EventEnvelope(BaseModel):
    id: int
    type: EventType
    run_id: str
    ts: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    payload: dict[str, Any] = Field(default_factory=dict)


class RunSummary(BaseModel):
    run_id: str
    ticker: str
    trade_date: str
    status: Literal["queued", "running", "done", "error", "cancelled"]
    rating: str | None = None
    raw_return: float | None = None
    alpha: float | None = None
    elapsed_ms: int | None = None
    created_at: datetime
```

- [ ] **步骤 4：运行测试**

运行：`pytest webapp/backend/tests/test_schemas.py -v`
预期：PASS。

- [ ] **步骤 5：提交**

```bash
git add webapp/backend/schemas.py webapp/backend/tests/test_schemas.py
git commit -m "feat(backend): pydantic schemas for runs and SSE events"
```

---
