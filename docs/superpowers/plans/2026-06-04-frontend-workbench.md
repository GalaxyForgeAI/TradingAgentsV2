# TradingAgents Web Workbench Implementation Plan

> **English** | [中文](./2026-06-04-frontend-workbench.zh-CN.md)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Next.js 15 + FastAPI workbench that wraps the existing `TradingAgentsGraph` engine with live streaming, run history, replay, multi-run comparison, per-ticker chart overlays, and config management.

**Architecture:** A FastAPI service imports `TradingAgentsGraph` in-process and exposes REST endpoints for config/history plus an SSE stream that translates `graph.stream(stream_mode="values")` chunks into a fixed event envelope. A Next.js 15 (App Router) frontend consumes the API with TanStack Query and the SSE stream via a typed `EventSource` hook, routing events into Zustand slices that drive the Run Detail UI.

**Tech Stack:** Python 3.10+ · FastAPI · uvicorn · pydantic v2 · pytest + httpx · Next.js 15 · TypeScript · Tailwind v4 · shadcn/ui · TanStack Query · Zustand · lightweight-charts · Recharts · Framer Motion · Vitest · Playwright.

---

## File Structure

### Backend (new package under `webapp/backend/`)

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

### Frontend (new app under `webapp/frontend/`)

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

### Top-level additions

```
scripts/web.sh                     Boots uvicorn + next dev concurrently.
pyproject.toml                     Add fastapi/uvicorn/sse-starlette to deps.
```

---

## Phase 0 — Repo Setup

### Task 0.1: Add backend dependencies

**Files:**
- Modify: `pyproject.toml`

- [ ] **Step 1: Edit pyproject.toml**

Add to the `dependencies` list (preserve sort order, keep existing entries):

```
    "fastapi>=0.115.0",
    "uvicorn[standard]>=0.32.0",
    "sse-starlette>=2.1.3",
    "httpx>=0.27.0",
    "pytest-asyncio>=0.24.0",
```

- [ ] **Step 2: Install**

Run: `pip install -e .`
Expected: resolves and installs fastapi, uvicorn, sse-starlette, httpx, pytest-asyncio.

- [ ] **Step 3: Verify imports**

Run: `python -c "import fastapi, uvicorn, sse_starlette, httpx; print('ok')"`
Expected: `ok`

- [ ] **Step 4: Commit**

```bash
git add pyproject.toml
git commit -m "build: add fastapi/uvicorn/sse-starlette/httpx for web backend"
```

### Task 0.2: Backend package skeleton

**Files:**
- Create: `webapp/__init__.py`
- Create: `webapp/backend/__init__.py`
- Create: `webapp/backend/tests/__init__.py`
- Create: `webapp/backend/main.py`
- Create: `webapp/backend/tests/test_health.py`

- [ ] **Step 1: Write the failing test**

`webapp/backend/tests/test_health.py`:

```python
from fastapi.testclient import TestClient

from webapp.backend.main import create_app


def test_health_endpoint_ok():
    client = TestClient(create_app())
    resp = client.get("/api/health")
    assert resp.status_code == 200
    assert resp.json() == {"status": "ok"}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pytest webapp/backend/tests/test_health.py -v`
Expected: ImportError on `webapp.backend.main`.

- [ ] **Step 3: Create empty package files**

`webapp/__init__.py`: empty.
`webapp/backend/__init__.py`: empty.
`webapp/backend/tests/__init__.py`: empty.

- [ ] **Step 4: Implement the app factory**

`webapp/backend/main.py`:

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

- [ ] **Step 5: Run tests**

Run: `pytest webapp/backend/tests/test_health.py -v`
Expected: PASS.

- [ ] **Step 6: Update pyproject test paths**

In `pyproject.toml`, update `[tool.pytest.ini_options]`:

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

- [ ] **Step 7: Run all tests**

Run: `pytest -q`
Expected: existing suite continues to pass + new test included.

- [ ] **Step 8: Commit**

```bash
git add webapp pyproject.toml
git commit -m "feat(backend): scaffold FastAPI app with /api/health"
```

---

## Phase 1 — Schemas

### Task 1.1: Pydantic DTOs

**Files:**
- Create: `webapp/backend/schemas.py`
- Create: `webapp/backend/tests/test_schemas.py`

- [ ] **Step 1: Write the failing test**

`webapp/backend/tests/test_schemas.py`:

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

- [ ] **Step 2: Run test to verify it fails**

Run: `pytest webapp/backend/tests/test_schemas.py -v`
Expected: ImportError.

- [ ] **Step 3: Implement schemas**

`webapp/backend/schemas.py`:

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

- [ ] **Step 4: Run tests**

Run: `pytest webapp/backend/tests/test_schemas.py -v`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add webapp/backend/schemas.py webapp/backend/tests/test_schemas.py
git commit -m "feat(backend): pydantic schemas for runs and SSE events"
```

---

## Phase 2 — Run Registry and Streaming Adapter

### Task 2.1: Run registry with ring buffer

**Files:**
- Create: `webapp/backend/run_registry.py`
- Create: `webapp/backend/tests/test_run_registry.py`

- [ ] **Step 1: Write the failing test**

`webapp/backend/tests/test_run_registry.py`:

```python
import pytest

from webapp.backend.run_registry import RunRegistry
from webapp.backend.schemas import EventEnvelope, EventType


@pytest.mark.asyncio
async def test_publish_and_subscribe_delivers_events():
    reg = RunRegistry(ring_size=10)
    reg.create("r1")

    evt = EventEnvelope(id=1, type=EventType.RUN_STARTED, run_id="r1")
    await reg.publish("r1", evt)

    received: list[EventEnvelope] = []
    async for e in reg.subscribe("r1", last_event_id=None):
        received.append(e)
        break

    assert received[0].id == 1


@pytest.mark.asyncio
async def test_subscribe_replays_from_last_event_id():
    reg = RunRegistry(ring_size=10)
    reg.create("r1")
    for i in range(1, 6):
        await reg.publish("r1", EventEnvelope(id=i, type=EventType.METRICS_TICK, run_id="r1"))

    seen: list[int] = []
    async for e in reg.subscribe("r1", last_event_id=2):
        seen.append(e.id)
        if e.id == 5:
            break

    assert seen == [3, 4, 5]


def test_unknown_run_raises():
    reg = RunRegistry()
    with pytest.raises(KeyError):
        reg.get("missing")
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pytest webapp/backend/tests/test_run_registry.py -v`
Expected: ImportError.

- [ ] **Step 3: Implement RunRegistry**

`webapp/backend/run_registry.py`:

```python
from __future__ import annotations

import asyncio
from collections import deque
from dataclasses import dataclass, field
from typing import AsyncIterator

from webapp.backend.schemas import EventEnvelope


@dataclass
class _RunState:
    run_id: str
    buffer: deque[EventEnvelope]
    subscribers: list[asyncio.Queue[EventEnvelope]] = field(default_factory=list)
    completed: bool = False


class RunRegistry:
    def __init__(self, ring_size: int = 200) -> None:
        self._runs: dict[str, _RunState] = {}
        self._ring_size = ring_size
        self._lock = asyncio.Lock()

    def create(self, run_id: str) -> None:
        if run_id in self._runs:
            raise ValueError(f"run {run_id} already exists")
        self._runs[run_id] = _RunState(run_id=run_id, buffer=deque(maxlen=self._ring_size))

    def get(self, run_id: str) -> _RunState:
        if run_id not in self._runs:
            raise KeyError(run_id)
        return self._runs[run_id]

    async def publish(self, run_id: str, event: EventEnvelope) -> None:
        async with self._lock:
            state = self.get(run_id)
            state.buffer.append(event)
            for q in state.subscribers:
                await q.put(event)

    async def complete(self, run_id: str) -> None:
        async with self._lock:
            state = self.get(run_id)
            state.completed = True
            for q in state.subscribers:
                await q.put(None)  # type: ignore[arg-type]

    async def subscribe(
        self, run_id: str, last_event_id: int | None
    ) -> AsyncIterator[EventEnvelope]:
        state = self.get(run_id)
        queue: asyncio.Queue[EventEnvelope] = asyncio.Queue()

        backlog = [e for e in state.buffer if last_event_id is None or e.id > last_event_id]
        async with self._lock:
            state.subscribers.append(queue)

        try:
            for e in backlog:
                yield e
            while True:
                event = await queue.get()
                if event is None:  # type: ignore[truthy-bool]
                    return
                yield event
        finally:
            async with self._lock:
                if queue in state.subscribers:
                    state.subscribers.remove(queue)
```

- [ ] **Step 4: Run tests**

Run: `pytest webapp/backend/tests/test_run_registry.py -v`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add webapp/backend/run_registry.py webapp/backend/tests/test_run_registry.py
git commit -m "feat(backend): in-memory run registry with ring buffer + fan-out"
```

### Task 2.2: Streaming adapter (chunk → events)

**Files:**
- Create: `webapp/backend/streaming.py`
- Create: `webapp/backend/tests/test_streaming.py`

The adapter receives successive `AgentState`-shaped dicts from `graph.stream(stream_mode="values")`, diffs them, and emits `EventEnvelope`s.

- [ ] **Step 1: Write the failing test**

`webapp/backend/tests/test_streaming.py`:

```python
from webapp.backend.schemas import EventType
from webapp.backend.streaming import StreamAdapter


def test_first_chunk_emits_run_started():
    a = StreamAdapter(run_id="r1")
    events = a.translate({"company_of_interest": "AAPL", "trade_date": "2026-01-15"})
    assert events[0].type == EventType.RUN_STARTED
    assert events[0].payload["ticker"] == "AAPL"


def test_new_report_field_emits_agent_report_and_done_state():
    a = StreamAdapter(run_id="r1")
    a.translate({"company_of_interest": "AAPL", "trade_date": "2026-01-15"})
    events = a.translate({"market_report": "# header\nbody"})
    types = [e.type for e in events]
    assert EventType.AGENT_REPORT in types
    assert EventType.AGENT_STATE in types
    report = next(e for e in events if e.type == EventType.AGENT_REPORT)
    assert report.payload["field"] == "market_report"


def test_debate_history_growth_emits_debate_messages():
    a = StreamAdapter(run_id="r1")
    a.translate({"company_of_interest": "AAPL", "trade_date": "2026-01-15"})
    a.translate({"investment_debate_state": {"bull_history": "B1", "bear_history": "", "count": 1}})
    events = a.translate({"investment_debate_state": {"bull_history": "B1\nB2", "bear_history": "BR1", "count": 3}})
    types = [e.type for e in events]
    assert types.count(EventType.DEBATE_MESSAGE) == 2


def test_event_ids_are_monotonic():
    a = StreamAdapter(run_id="r1")
    e1 = a.translate({"company_of_interest": "AAPL", "trade_date": "2026-01-15"})
    e2 = a.translate({"market_report": "x"})
    ids = [e.id for e in e1 + e2]
    assert ids == sorted(ids)
    assert ids[0] == 1
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pytest webapp/backend/tests/test_streaming.py -v`
Expected: ImportError.

- [ ] **Step 3: Implement StreamAdapter**

`webapp/backend/streaming.py`:

```python
from __future__ import annotations

import time
from typing import Any

from webapp.backend.schemas import (
    AgentName,
    EventEnvelope,
    EventType,
)

REPORT_TO_AGENT: dict[str, AgentName] = {
    "market_report": AgentName.MARKET_ANALYST,
    "sentiment_report": AgentName.SOCIAL_ANALYST,
    "news_report": AgentName.NEWS_ANALYST,
    "fundamentals_report": AgentName.FUNDAMENTALS_ANALYST,
    "investment_plan": AgentName.RESEARCH_MANAGER,
    "trader_investment_plan": AgentName.TRADER,
    "final_trade_decision": AgentName.PORTFOLIO_MANAGER,
}


def _split_lines(prev: str, curr: str) -> list[str]:
    if not curr:
        return []
    if not prev:
        return [line for line in curr.splitlines() if line.strip()]
    if curr.startswith(prev):
        delta = curr[len(prev) :]
        return [line for line in delta.splitlines() if line.strip()]
    return [line for line in curr.splitlines() if line.strip()]


class StreamAdapter:
    def __init__(self, run_id: str) -> None:
        self._run_id = run_id
        self._next_id = 1
        self._started = False
        self._started_at = time.monotonic()
        self._prev: dict[str, Any] = {}

    def _next(self, event_type: EventType, payload: dict[str, Any]) -> EventEnvelope:
        evt = EventEnvelope(id=self._next_id, type=event_type, run_id=self._run_id, payload=payload)
        self._next_id += 1
        return evt

    def translate(self, chunk: dict[str, Any]) -> list[EventEnvelope]:
        events: list[EventEnvelope] = []
        if not self._started:
            events.append(
                self._next(
                    EventType.RUN_STARTED,
                    {
                        "ticker": chunk.get("company_of_interest", ""),
                        "trade_date": chunk.get("trade_date", ""),
                    },
                )
            )
            self._started = True

        for field, agent in REPORT_TO_AGENT.items():
            if field in chunk and chunk[field] and chunk[field] != self._prev.get(field):
                events.append(
                    self._next(
                        EventType.AGENT_REPORT,
                        {"field": field, "markdown": chunk[field]},
                    )
                )
                events.append(
                    self._next(
                        EventType.AGENT_STATE,
                        {"agent": agent.value, "status": "done"},
                    )
                )

        debate = chunk.get("investment_debate_state")
        if isinstance(debate, dict):
            prev_debate = self._prev.get("investment_debate_state", {}) or {}
            for side, key in (("bull", "bull_history"), ("bear", "bear_history")):
                new_lines = _split_lines(prev_debate.get(key, ""), debate.get(key, ""))
                for i, line in enumerate(new_lines):
                    events.append(
                        self._next(
                            EventType.DEBATE_MESSAGE,
                            {
                                "side": side,
                                "round": int(debate.get("count", 0)) // 2 + i + 1,
                                "text": line,
                            },
                        )
                    )

        risk = chunk.get("risk_debate_state")
        if isinstance(risk, dict):
            prev_risk = self._prev.get("risk_debate_state", {}) or {}
            for side, key in (
                ("aggressive", "risky_history"),
                ("conservative", "safe_history"),
                ("neutral", "neutral_history"),
            ):
                new_lines = _split_lines(prev_risk.get(key, ""), risk.get(key, ""))
                for i, line in enumerate(new_lines):
                    events.append(
                        self._next(
                            EventType.DEBATE_MESSAGE,
                            {
                                "side": side,
                                "round": int(risk.get("count", 0)) // 3 + i + 1,
                                "text": line,
                            },
                        )
                    )

        events.append(
            self._next(
                EventType.METRICS_TICK,
                {"elapsed_ms": int((time.monotonic() - self._started_at) * 1000)},
            )
        )

        self._prev = {**self._prev, **chunk}
        return events

    def final(self, decision: str, rating: str | None) -> EventEnvelope:
        return self._next(
            EventType.RUN_DONE,
            {
                "decision": decision,
                "rating": rating,
                "duration_ms": int((time.monotonic() - self._started_at) * 1000),
            },
        )

    def error(self, message: str, stack: str | None = None) -> EventEnvelope:
        return self._next(EventType.RUN_ERROR, {"message": message, "stack": stack})
```

- [ ] **Step 4: Run tests**

Run: `pytest webapp/backend/tests/test_streaming.py -v`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add webapp/backend/streaming.py webapp/backend/tests/test_streaming.py
git commit -m "feat(backend): translate AgentState chunks into SSE event envelopes"
```

### Task 2.3: Graph runner (async wrapper)

**Files:**
- Create: `webapp/backend/graph_runner.py`
- Create: `webapp/backend/tests/conftest.py`
- Create: `webapp/backend/tests/test_graph_runner.py`

- [ ] **Step 1: Write conftest stub**

`webapp/backend/tests/conftest.py`:

```python
from __future__ import annotations

import pytest


class StubGraph:
    """Mimics TradingAgentsGraph for tests; yields scripted chunks."""

    def __init__(self, chunks: list[dict] | None = None, decision: str = "BUY") -> None:
        self.chunks = chunks or [
            {"company_of_interest": "AAPL", "trade_date": "2026-01-15"},
            {"market_report": "# Market\nGood"},
            {"final_trade_decision": "BUY"},
        ]
        self.decision = decision
        self.calls: list[tuple[str, str]] = []

    def stream(self, ticker: str, trade_date: str):
        self.calls.append((ticker, trade_date))
        for c in self.chunks:
            yield c


@pytest.fixture
def stub_graph() -> StubGraph:
    return StubGraph()
```

- [ ] **Step 2: Write the failing test**

`webapp/backend/tests/test_graph_runner.py`:

```python
import pytest

from webapp.backend.graph_runner import GraphRunner
from webapp.backend.run_registry import RunRegistry
from webapp.backend.schemas import EventType, RunRequest


@pytest.mark.asyncio
async def test_runner_publishes_full_lifecycle(stub_graph):
    registry = RunRegistry()
    runner = GraphRunner(registry=registry, graph_factory=lambda req: stub_graph)
    req = RunRequest(ticker="AAPL", trade_date="2026-01-15")

    run_id = await runner.start(req)
    await runner.wait(run_id)

    state = registry.get(run_id)
    types = [e.type for e in state.buffer]
    assert EventType.RUN_STARTED in types
    assert EventType.RUN_DONE in types
    assert state.completed is True
    assert stub_graph.calls == [("AAPL", "2026-01-15")]


@pytest.mark.asyncio
async def test_runner_emits_error_when_graph_raises(stub_graph):
    class BrokenGraph(type(stub_graph)):
        def stream(self, ticker, trade_date):
            yield {"company_of_interest": ticker, "trade_date": trade_date}
            raise RuntimeError("boom")

    registry = RunRegistry()
    runner = GraphRunner(registry=registry, graph_factory=lambda req: BrokenGraph())
    req = RunRequest(ticker="AAPL", trade_date="2026-01-15")
    run_id = await runner.start(req)
    await runner.wait(run_id)

    state = registry.get(run_id)
    err_events = [e for e in state.buffer if e.type == EventType.RUN_ERROR]
    assert len(err_events) == 1
    assert "boom" in err_events[0].payload["message"]
```

- [ ] **Step 3: Run test to verify it fails**

Run: `pytest webapp/backend/tests/test_graph_runner.py -v`
Expected: ImportError on graph_runner.

- [ ] **Step 4: Implement GraphRunner**

`webapp/backend/graph_runner.py`:

```python
from __future__ import annotations

import asyncio
import traceback
import uuid
from typing import Any, Callable, Protocol

from webapp.backend.run_registry import RunRegistry
from webapp.backend.schemas import RunRequest
from webapp.backend.streaming import StreamAdapter


class GraphLike(Protocol):
    def stream(self, ticker: str, trade_date: str) -> Any: ...


class GraphRunner:
    def __init__(
        self,
        registry: RunRegistry,
        graph_factory: Callable[[RunRequest], GraphLike],
        max_concurrent: int = 2,
    ) -> None:
        self._registry = registry
        self._factory = graph_factory
        self._semaphore = asyncio.Semaphore(max_concurrent)
        self._tasks: dict[str, asyncio.Task[None]] = {}

    async def start(self, request: RunRequest) -> str:
        run_id = uuid.uuid4().hex[:12]
        self._registry.create(run_id)
        task = asyncio.create_task(self._run(run_id, request))
        self._tasks[run_id] = task
        return run_id

    async def wait(self, run_id: str) -> None:
        task = self._tasks.get(run_id)
        if task is not None:
            await task

    def cancel(self, run_id: str) -> bool:
        task = self._tasks.get(run_id)
        if task and not task.done():
            task.cancel()
            return True
        return False

    async def _run(self, run_id: str, request: RunRequest) -> None:
        adapter = StreamAdapter(run_id=run_id)
        async with self._semaphore:
            try:
                graph = self._factory(request)
                loop = asyncio.get_running_loop()
                iterator = graph.stream(request.ticker, request.trade_date)

                while True:
                    chunk = await loop.run_in_executor(None, lambda: next(iterator, _SENTINEL))
                    if chunk is _SENTINEL:
                        break
                    for evt in adapter.translate(chunk):
                        await self._registry.publish(run_id, evt)

                decision = self._registry.get(run_id).buffer
                final_decision = ""
                for e in reversed(decision):
                    if e.payload.get("field") == "final_trade_decision":
                        final_decision = e.payload["markdown"]
                        break
                await self._registry.publish(run_id, adapter.final(final_decision, None))
            except Exception as exc:  # noqa: BLE001
                stack = traceback.format_exc()
                await self._registry.publish(run_id, adapter.error(str(exc), stack))
            finally:
                await self._registry.complete(run_id)


_SENTINEL: Any = object()
```

- [ ] **Step 5: Run tests**

Run: `pytest webapp/backend/tests/test_graph_runner.py -v`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add webapp/backend/graph_runner.py webapp/backend/tests/conftest.py webapp/backend/tests/test_graph_runner.py
git commit -m "feat(backend): async graph runner with concurrency cap and error capture"
```

---

## Phase 3 — Routes

### Task 3.1: Runs route (POST + SSE)

**Files:**
- Create: `webapp/backend/routes/__init__.py`
- Create: `webapp/backend/routes/runs.py`
- Modify: `webapp/backend/main.py`
- Create: `webapp/backend/tests/test_runs_route.py`

- [ ] **Step 1: Write the failing test**

`webapp/backend/tests/test_runs_route.py`:

```python
import asyncio
import json

import pytest
from httpx import ASGITransport, AsyncClient

from webapp.backend.main import create_app
from webapp.backend.routes import runs as runs_route


@pytest.mark.asyncio
async def test_post_run_returns_run_id_and_stream_completes(stub_graph, monkeypatch):
    monkeypatch.setattr(runs_route, "_graph_factory", lambda req: stub_graph)
    app = create_app()

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        resp = await client.post("/api/runs", json={"ticker": "AAPL", "trade_date": "2026-01-15"})
        assert resp.status_code == 201
        run_id = resp.json()["run_id"]
        assert run_id

        # SSE stream
        async with client.stream("GET", f"/api/runs/{run_id}/stream") as r:
            events: list[dict] = []
            async for line in r.aiter_lines():
                if line.startswith("data: "):
                    events.append(json.loads(line[6:]))
                if events and events[-1]["type"] == "run.done":
                    break

        types = [e["type"] for e in events]
        assert "run.started" in types
        assert "run.done" in types


@pytest.mark.asyncio
async def test_invalid_ticker_rejected():
    app = create_app()
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        resp = await client.post("/api/runs", json={"ticker": "", "trade_date": "2026-01-15"})
        assert resp.status_code == 422
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pytest webapp/backend/tests/test_runs_route.py -v`
Expected: ImportError.

- [ ] **Step 3: Implement the route**

`webapp/backend/routes/__init__.py`: empty.

`webapp/backend/routes/runs.py`:

```python
from __future__ import annotations

import json
from typing import Any

from fastapi import APIRouter, HTTPException, Request
from sse_starlette.sse import EventSourceResponse

from webapp.backend.graph_runner import GraphRunner
from webapp.backend.run_registry import RunRegistry
from webapp.backend.schemas import RunRequest

router = APIRouter(prefix="/api/runs", tags=["runs"])

_registry = RunRegistry()


def _graph_factory(req: RunRequest) -> Any:
    """Default factory; overridden in tests."""
    from tradingagents.default_config import DEFAULT_CONFIG
    from tradingagents.graph.trading_graph import TradingAgentsGraph

    config = DEFAULT_CONFIG.copy()
    if req.deep_think_llm:
        config["deep_think_llm"] = req.deep_think_llm
    if req.quick_think_llm:
        config["quick_think_llm"] = req.quick_think_llm
    if req.temperature is not None:
        config["temperature"] = req.temperature
    config["llm_provider"] = req.llm_provider
    config["max_debate_rounds"] = req.max_debate_rounds
    config["max_risk_discuss_rounds"] = req.max_risk_discuss_rounds
    config["checkpoint_enabled"] = req.checkpoint_enabled
    config["output_language"] = req.output_language

    return TradingAgentsGraph(
        selected_analysts=req.analysts,
        debug=False,
        config=config,
    )


_runner = GraphRunner(_registry, graph_factory=lambda req: _graph_factory(req))


@router.post("", status_code=201)
async def create_run(req: RunRequest) -> dict[str, str]:
    run_id = await _runner.start(req)
    return {"run_id": run_id}


@router.get("/{run_id}/stream")
async def stream_run(run_id: str, request: Request) -> EventSourceResponse:
    last_event_id = request.headers.get("last-event-id")
    last_id = int(last_event_id) if last_event_id and last_event_id.isdigit() else None
    try:
        _registry.get(run_id)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail="unknown run") from exc

    async def event_gen():
        async for evt in _registry.subscribe(run_id, last_event_id=last_id):
            yield {
                "id": str(evt.id),
                "event": evt.type.value,
                "data": json.dumps(
                    {
                        "id": evt.id,
                        "type": evt.type.value,
                        "run_id": evt.run_id,
                        "ts": evt.ts.isoformat(),
                        "payload": evt.payload,
                    }
                ),
            }

    return EventSourceResponse(event_gen())


@router.post("/{run_id}/cancel")
def cancel_run(run_id: str) -> dict[str, bool]:
    return {"cancelled": _runner.cancel(run_id)}
```

`webapp/backend/main.py` — append in `create_app` before `return app`:

```python
    from webapp.backend.routes.runs import router as runs_router
    app.include_router(runs_router)
```

- [ ] **Step 4: Run tests**

Run: `pytest webapp/backend/tests/test_runs_route.py -v`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add webapp/backend/routes webapp/backend/main.py webapp/backend/tests/test_runs_route.py
git commit -m "feat(backend): POST /api/runs + SSE stream endpoint"
```

### Task 3.2: Memory log route (history)

**Files:**
- Create: `webapp/backend/routes/memory.py`
- Modify: `webapp/backend/main.py`
- Create: `webapp/backend/tests/test_memory_route.py`

- [ ] **Step 1: Write the failing test**

`webapp/backend/tests/test_memory_route.py`:

```python
import textwrap
from pathlib import Path

import pytest
from httpx import ASGITransport, AsyncClient

from webapp.backend.main import create_app
from webapp.backend.routes import memory as memory_route


@pytest.mark.asyncio
async def test_history_returns_entries(tmp_path: Path, monkeypatch):
    log = tmp_path / "trading_memory.md"
    log.write_text(
        textwrap.dedent(
            """
            [2026-01-15 | AAPL | BUY | +2.3% | +1.5% | 5d]

            DECISION:
            BUY AAPL at open.

            REFLECTION:
            Earnings beat carried it.

            <!-- ENTRY_END -->
            """
        ).strip()
    )
    monkeypatch.setattr(memory_route, "_log_path", lambda: log)

    app = create_app()
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        resp = await client.get("/api/runs?source=memory")
        assert resp.status_code == 200
        entries = resp.json()["entries"]
        assert len(entries) == 1
        assert entries[0]["ticker"] == "AAPL"
        assert entries[0]["rating"] == "BUY"
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pytest webapp/backend/tests/test_memory_route.py -v`
Expected: ImportError.

- [ ] **Step 3: Implement memory route**

`webapp/backend/routes/memory.py`:

```python
from __future__ import annotations

import os
import re
from pathlib import Path

from fastapi import APIRouter, Query

router = APIRouter(prefix="/api/runs", tags=["history"])

ENTRY_RE = re.compile(
    r"\[(?P<date>\d{4}-\d{2}-\d{2})\s*\|\s*(?P<ticker>[^|]+)\s*\|\s*(?P<rating>[^|]+)(?:\s*\|\s*(?P<raw>[^|]+))?(?:\s*\|\s*(?P<alpha>[^|]+))?(?:\s*\|\s*(?P<hold>[^\]]+))?\]"
)


def _log_path() -> Path:
    override = os.environ.get("TRADINGAGENTS_MEMORY_LOG_PATH")
    if override:
        return Path(override).expanduser()
    return Path.home() / ".tradingagents" / "memory" / "trading_memory.md"


def _parse_pct(s: str | None) -> float | None:
    if not s:
        return None
    s = s.strip().rstrip("%").replace("+", "")
    try:
        return float(s)
    except ValueError:
        return None


def _parse_entries(text: str) -> list[dict]:
    chunks = [c.strip() for c in text.split("<!-- ENTRY_END -->") if c.strip()]
    out: list[dict] = []
    for chunk in chunks:
        m = ENTRY_RE.search(chunk)
        if not m:
            continue
        decision = ""
        reflection = ""
        if "DECISION:" in chunk:
            decision = chunk.split("DECISION:", 1)[1]
            if "REFLECTION:" in decision:
                decision, reflection = decision.split("REFLECTION:", 1)
            decision = decision.strip()
            reflection = reflection.strip()
        out.append(
            {
                "date": m.group("date"),
                "ticker": m.group("ticker").strip(),
                "rating": m.group("rating").strip(),
                "raw_return": _parse_pct(m.group("raw")),
                "alpha": _parse_pct(m.group("alpha")),
                "holding": (m.group("hold") or "").strip() or None,
                "decision": decision,
                "reflection": reflection,
                "pending": "REFLECTION:" not in chunk,
            }
        )
    return out


@router.get("")
def history(
    source: str = Query(default="memory"),
    ticker: str | None = None,
    pending_only: bool = False,
) -> dict:
    if source != "memory":
        return {"entries": []}
    path = _log_path()
    if not path.exists():
        return {"entries": []}
    entries = _parse_entries(path.read_text())
    if ticker:
        entries = [e for e in entries if e["ticker"].upper() == ticker.upper()]
    if pending_only:
        entries = [e for e in entries if e["pending"]]
    entries.sort(key=lambda e: e["date"], reverse=True)
    return {"entries": entries}
```

Modify `webapp/backend/main.py` `create_app` to also include memory router:

```python
    from webapp.backend.routes.memory import router as memory_router
    app.include_router(memory_router)
```

Note: both routers share `/api/runs` prefix but distinct paths (`""` here vs `""`, `"{id}/stream"`, `"{id}/cancel"`). FastAPI dispatches by method+path so they coexist — confirm with the test.

- [ ] **Step 4: Run tests**

Run: `pytest webapp/backend/tests/test_memory_route.py -v`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add webapp/backend/routes/memory.py webapp/backend/main.py webapp/backend/tests/test_memory_route.py
git commit -m "feat(backend): GET /api/runs?source=memory reads decision log"
```

### Task 3.3: Config route

**Files:**
- Create: `webapp/backend/routes/config.py`
- Modify: `webapp/backend/main.py`
- Create: `webapp/backend/tests/test_config_route.py`

- [ ] **Step 1: Write the failing test**

`webapp/backend/tests/test_config_route.py`:

```python
import pytest
from httpx import ASGITransport, AsyncClient

from webapp.backend.main import create_app


@pytest.mark.asyncio
async def test_get_config_returns_defaults():
    app = create_app()
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        resp = await client.get("/api/config")
        assert resp.status_code == 200
        body = resp.json()
        assert "llm_provider" in body
        assert "max_debate_rounds" in body
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pytest webapp/backend/tests/test_config_route.py -v`
Expected: 404.

- [ ] **Step 3: Implement config route**

`webapp/backend/routes/config.py`:

```python
from __future__ import annotations

from typing import Any

from fastapi import APIRouter

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


def _safe_config() -> dict[str, Any]:
    from tradingagents.default_config import DEFAULT_CONFIG

    return {k: v for k, v in DEFAULT_CONFIG.items() if k in _SAFE_KEYS}


@router.get("")
def get_config() -> dict[str, Any]:
    return _safe_config()
```

Wire in `main.py`:

```python
    from webapp.backend.routes.config import router as config_router
    app.include_router(config_router)
```

- [ ] **Step 4: Run tests**

Run: `pytest webapp/backend/tests/test_config_route.py -v`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add webapp/backend/routes/config.py webapp/backend/main.py webapp/backend/tests/test_config_route.py
git commit -m "feat(backend): GET /api/config exposes whitelisted DEFAULT_CONFIG keys"
```

### Task 3.4: Providers health route

**Files:**
- Create: `webapp/backend/routes/providers.py`
- Modify: `webapp/backend/main.py`
- Create: `webapp/backend/tests/test_providers_route.py`

- [ ] **Step 1: Write the failing test**

`webapp/backend/tests/test_providers_route.py`:

```python
import pytest
from httpx import ASGITransport, AsyncClient

from webapp.backend.main import create_app


@pytest.mark.asyncio
async def test_provider_health_reports_each_provider(monkeypatch):
    monkeypatch.delenv("OPENAI_API_KEY", raising=False)
    monkeypatch.setenv("ANTHROPIC_API_KEY", "x")

    app = create_app()
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        resp = await client.get("/api/providers/health")
        assert resp.status_code == 200
        body = resp.json()
        providers = {p["id"]: p for p in body["providers"]}
        assert providers["openai"]["configured"] is False
        assert providers["anthropic"]["configured"] is True
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pytest webapp/backend/tests/test_providers_route.py -v`
Expected: 404.

- [ ] **Step 3: Implement providers route**

`webapp/backend/routes/providers.py`:

```python
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
```

Wire in `main.py`:

```python
    from webapp.backend.routes.providers import router as providers_router
    app.include_router(providers_router)
```

- [ ] **Step 4: Run tests**

Run: `pytest webapp/backend/tests/test_providers_route.py -v`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add webapp/backend/routes/providers.py webapp/backend/main.py webapp/backend/tests/test_providers_route.py
git commit -m "feat(backend): GET /api/providers/health surfaces API key status"
```

### Task 3.5: Markets route (OHLC + indicators)

**Files:**
- Create: `webapp/backend/routes/markets.py`
- Modify: `webapp/backend/main.py`
- Create: `webapp/backend/tests/test_markets_route.py`

- [ ] **Step 1: Write the failing test**

`webapp/backend/tests/test_markets_route.py`:

```python
from datetime import datetime, timedelta

import pandas as pd
import pytest
from httpx import ASGITransport, AsyncClient

from webapp.backend.main import create_app
from webapp.backend.routes import markets as markets_route


@pytest.mark.asyncio
async def test_markets_returns_bars(monkeypatch):
    dates = pd.date_range(end=datetime.today(), periods=5)
    df = pd.DataFrame(
        {
            "Open": [1, 2, 3, 4, 5],
            "High": [2, 3, 4, 5, 6],
            "Low": [0.5, 1.5, 2.5, 3.5, 4.5],
            "Close": [1.5, 2.5, 3.5, 4.5, 5.5],
            "Volume": [100, 100, 100, 100, 100],
        },
        index=dates,
    )

    monkeypatch.setattr(markets_route, "_fetch_ohlc", lambda ticker, period: df)

    app = create_app()
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        resp = await client.get("/api/markets/AAPL?range=5d")
        assert resp.status_code == 200
        body = resp.json()
        assert body["ticker"] == "AAPL"
        assert len(body["bars"]) == 5
        assert {"t", "o", "h", "l", "c", "v"} <= set(body["bars"][0].keys())
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pytest webapp/backend/tests/test_markets_route.py -v`
Expected: 404.

- [ ] **Step 3: Implement markets route**

`webapp/backend/routes/markets.py`:

```python
from __future__ import annotations

from typing import Any

import pandas as pd
from fastapi import APIRouter, HTTPException, Query

router = APIRouter(prefix="/api/markets", tags=["markets"])


def _fetch_ohlc(ticker: str, period: str) -> pd.DataFrame:
    import yfinance as yf

    df = yf.Ticker(ticker).history(period=period, auto_adjust=False)
    return df


@router.get("/{ticker}")
def market(ticker: str, range_: str = Query(default="6mo", alias="range")) -> dict[str, Any]:
    ticker = ticker.strip().upper()
    if not ticker:
        raise HTTPException(status_code=400, detail="empty ticker")

    df = _fetch_ohlc(ticker, range_)
    if df.empty:
        return {"ticker": ticker, "bars": []}

    bars = [
        {
            "t": idx.strftime("%Y-%m-%d"),
            "o": float(row["Open"]),
            "h": float(row["High"]),
            "l": float(row["Low"]),
            "c": float(row["Close"]),
            "v": float(row["Volume"]),
        }
        for idx, row in df.iterrows()
    ]
    return {"ticker": ticker, "bars": bars}
```

Wire in `main.py`:

```python
    from webapp.backend.routes.markets import router as markets_router
    app.include_router(markets_router)
```

- [ ] **Step 4: Run tests**

Run: `pytest webapp/backend/tests/test_markets_route.py -v`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add webapp/backend/routes/markets.py webapp/backend/main.py webapp/backend/tests/test_markets_route.py
git commit -m "feat(backend): GET /api/markets/{ticker} returns OHLC bars"
```

---

## Phase 4 — Frontend Scaffolding

### Task 4.1: Bootstrap Next.js app

**Files:**
- Create: `webapp/frontend/package.json`
- Create: `webapp/frontend/tsconfig.json`
- Create: `webapp/frontend/next.config.mjs`
- Create: `webapp/frontend/postcss.config.js`
- Create: `webapp/frontend/tailwind.config.ts`
- Create: `webapp/frontend/app/globals.css`
- Create: `webapp/frontend/app/layout.tsx`
- Create: `webapp/frontend/app/page.tsx`

- [ ] **Step 1: Write package.json**

```json
{
  "name": "tradingagents-frontend",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint",
    "test": "vitest run",
    "test:watch": "vitest",
    "e2e": "playwright test"
  },
  "dependencies": {
    "next": "15.0.3",
    "react": "19.0.0",
    "react-dom": "19.0.0",
    "@tanstack/react-query": "^5.59.0",
    "zustand": "^5.0.1",
    "tailwindcss": "^4.0.0",
    "@microsoft/fetch-event-source": "^2.0.1",
    "lightweight-charts": "^4.2.0",
    "recharts": "^2.13.0",
    "framer-motion": "^11.11.0",
    "react-markdown": "^9.0.1",
    "remark-gfm": "^4.0.0",
    "lucide-react": "^0.460.0",
    "class-variance-authority": "^0.7.0",
    "clsx": "^2.1.1",
    "tailwind-merge": "^2.5.0"
  },
  "devDependencies": {
    "@playwright/test": "^1.48.0",
    "@testing-library/jest-dom": "^6.6.0",
    "@testing-library/react": "^16.0.0",
    "@testing-library/user-event": "^14.5.2",
    "@types/node": "^22.0.0",
    "@types/react": "19.0.0",
    "@types/react-dom": "19.0.0",
    "@vitejs/plugin-react": "^4.3.3",
    "autoprefixer": "^10.4.20",
    "eslint": "^9.13.0",
    "eslint-config-next": "15.0.3",
    "jsdom": "^25.0.1",
    "postcss": "^8.4.47",
    "typescript": "^5.6.3",
    "vitest": "^2.1.4"
  }
}
```

- [ ] **Step 2: Write tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["dom", "dom.iterable", "ES2022"],
    "allowJs": false,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": { "@/*": ["./*"] }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx"],
  "exclude": ["node_modules"]
}
```

- [ ] **Step 3: Write next.config.mjs**

```js
/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    return [{ source: "/api/:path*", destination: "http://localhost:8000/api/:path*" }];
  },
  reactStrictMode: true,
};
export default nextConfig;
```

- [ ] **Step 4: Tailwind + PostCSS**

`webapp/frontend/postcss.config.js`:

```js
module.exports = { plugins: { "@tailwindcss/postcss": {} } };
```

`webapp/frontend/tailwind.config.ts`:

```ts
import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bull: "#16a34a",
        bear: "#dc2626",
        hold: "#ca8a04",
      },
    },
  },
  plugins: [],
};
export default config;
```

`webapp/frontend/app/globals.css`:

```css
@import "tailwindcss";

:root {
  color-scheme: light dark;
}
body {
  font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
}
```

- [ ] **Step 5: Root layout + landing page**

`webapp/frontend/app/layout.tsx`:

```tsx
import "./globals.css";

import type { ReactNode } from "react";

export const metadata = { title: "TradingAgents Workbench" };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-zinc-50 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
        {children}
      </body>
    </html>
  );
}
```

`webapp/frontend/app/page.tsx`:

```tsx
export default function Home() {
  return (
    <main className="mx-auto max-w-6xl p-10">
      <h1 className="text-3xl font-semibold">TradingAgents Workbench</h1>
      <p className="mt-2 text-zinc-500">Multi-agent trading analysis, with replay.</p>
    </main>
  );
}
```

- [ ] **Step 6: Install + dev build sanity check**

Run from `webapp/frontend`:

```bash
npm install
npm run build
```

Expected: build succeeds.

- [ ] **Step 7: Commit**

```bash
git add webapp/frontend/{package.json,tsconfig.json,next.config.mjs,postcss.config.js,tailwind.config.ts,app}
git commit -m "feat(frontend): scaffold Next.js 15 + Tailwind v4 app"
```

### Task 4.2: Shared types and API client

**Files:**
- Create: `webapp/frontend/lib/types.ts`
- Create: `webapp/frontend/lib/api.ts`
- Create: `webapp/frontend/lib/format.ts`
- Create: `webapp/frontend/tests/api.test.ts`
- Create: `webapp/frontend/vitest.config.ts`

- [ ] **Step 1: Vitest config**

`webapp/frontend/vitest.config.ts`:

```ts
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: [],
  },
});
```

- [ ] **Step 2: Write types**

`webapp/frontend/lib/types.ts`:

```ts
export type AgentName =
  | "market_analyst" | "social_analyst" | "news_analyst" | "fundamentals_analyst"
  | "bull_researcher" | "bear_researcher" | "research_manager" | "trader"
  | "aggressive_analyst" | "conservative_analyst" | "neutral_analyst" | "portfolio_manager";

export type AgentStatus = "pending" | "running" | "done" | "error";

export type EventType =
  | "run.started" | "agent.state" | "agent.report"
  | "tool.call" | "debate.message" | "metrics.tick"
  | "run.done" | "run.error";

export interface EventEnvelope<P = Record<string, unknown>> {
  id: number;
  type: EventType;
  run_id: string;
  ts: string;
  payload: P;
}

export interface RunRequest {
  ticker: string;
  trade_date: string;
  analysts?: ("market" | "social" | "news" | "fundamentals")[];
  llm_provider?: string;
  deep_think_llm?: string;
  quick_think_llm?: string;
  max_debate_rounds?: number;
  max_risk_discuss_rounds?: number;
  temperature?: number;
  checkpoint_enabled?: boolean;
  output_language?: string;
}

export interface MemoryEntry {
  date: string;
  ticker: string;
  rating: string;
  raw_return: number | null;
  alpha: number | null;
  holding: string | null;
  decision: string;
  reflection: string;
  pending: boolean;
}

export interface MarketBar {
  t: string;
  o: number;
  h: number;
  l: number;
  c: number;
  v: number;
}

export interface ProviderHealth {
  id: string;
  label: string;
  env_key: string;
  configured: boolean;
}
```

- [ ] **Step 3: Write API client**

`webapp/frontend/lib/api.ts`:

```ts
import type { MarketBar, MemoryEntry, ProviderHealth, RunRequest } from "./types";

const base = "";

async function json<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(base + path, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  if (!res.ok) {
    throw new Error(`${res.status} ${res.statusText} on ${path}`);
  }
  return res.json() as Promise<T>;
}

export const api = {
  createRun: (req: RunRequest) => json<{ run_id: string }>("/api/runs", { method: "POST", body: JSON.stringify(req) }),
  cancelRun: (id: string) => json<{ cancelled: boolean }>(`/api/runs/${id}/cancel`, { method: "POST" }),
  history: (params: { ticker?: string; pending_only?: boolean } = {}) => {
    const qs = new URLSearchParams({ source: "memory" });
    if (params.ticker) qs.set("ticker", params.ticker);
    if (params.pending_only) qs.set("pending_only", "true");
    return json<{ entries: MemoryEntry[] }>(`/api/runs?${qs.toString()}`);
  },
  config: () => json<Record<string, unknown>>("/api/config"),
  providers: () => json<{ providers: ProviderHealth[] }>("/api/providers/health"),
  market: (ticker: string, range = "6mo") =>
    json<{ ticker: string; bars: MarketBar[] }>(`/api/markets/${encodeURIComponent(ticker)}?range=${range}`),
};
```

- [ ] **Step 4: Write format helpers**

`webapp/frontend/lib/format.ts`:

```ts
export function ratingColor(rating: string | null | undefined): string {
  if (!rating) return "text-zinc-500";
  const r = rating.toUpperCase();
  if (r.includes("BUY")) return "text-bull";
  if (r.includes("SELL")) return "text-bear";
  return "text-hold";
}

export function pct(n: number | null | undefined, digits = 2): string {
  if (n == null || Number.isNaN(n)) return "—";
  return `${n >= 0 ? "+" : ""}${n.toFixed(digits)}%`;
}

export function elapsed(ms: number): string {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  return m ? `${m}m ${s % 60}s` : `${s}s`;
}
```

- [ ] **Step 5: Write the failing test**

`webapp/frontend/tests/api.test.ts`:

```ts
import { describe, expect, it, vi } from "vitest";

import { api } from "../lib/api";

describe("api client", () => {
  it("posts a run request and returns the run id", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ run_id: "abc" }), { status: 201 }),
    );
    const result = await api.createRun({ ticker: "AAPL", trade_date: "2026-01-15" });
    expect(result.run_id).toBe("abc");
    expect(fetchMock).toHaveBeenCalledWith("/api/runs", expect.objectContaining({ method: "POST" }));
  });

  it("throws on non-2xx", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("nope", { status: 500 }));
    await expect(api.config()).rejects.toThrow(/500/);
  });
});
```

- [ ] **Step 6: Run tests**

Run from `webapp/frontend`: `npm test`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add webapp/frontend/{lib,tests,vitest.config.ts}
git commit -m "feat(frontend): typed API client and shared DTOs"
```

### Task 4.3: SSE hook

**Files:**
- Create: `webapp/frontend/lib/sse.ts`
- Create: `webapp/frontend/tests/sse.test.ts`

- [ ] **Step 1: Write the failing test**

`webapp/frontend/tests/sse.test.ts`:

```ts
import { renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { useEventStream } from "../lib/sse";

class FakeES {
  static instances: FakeES[] = [];
  listeners = new Map<string, ((ev: MessageEvent) => void)[]>();
  url: string;
  closed = false;
  constructor(url: string) {
    this.url = url;
    FakeES.instances.push(this);
  }
  addEventListener(type: string, cb: (ev: MessageEvent) => void) {
    const list = this.listeners.get(type) ?? [];
    list.push(cb);
    this.listeners.set(type, list);
  }
  removeEventListener() {}
  close() {
    this.closed = true;
  }
  emit(type: string, data: unknown, id?: string) {
    const ev = new MessageEvent(type, { data: JSON.stringify(data), lastEventId: id ?? "" });
    (this.listeners.get(type) ?? []).forEach((cb) => cb(ev));
    (this.listeners.get("message") ?? []).forEach((cb) => cb(ev));
  }
}

describe("useEventStream", () => {
  it("collects events and exposes the latest event id", async () => {
    vi.stubGlobal("EventSource", FakeES as unknown as typeof EventSource);
    const { result } = renderHook(() => useEventStream("/api/runs/r1/stream"));

    const es = FakeES.instances.at(-1)!;
    es.emit("run.started", { id: 1, type: "run.started", run_id: "r1", payload: {} }, "1");
    es.emit("agent.state", { id: 2, type: "agent.state", run_id: "r1", payload: { agent: "market_analyst", status: "running" } }, "2");

    await waitFor(() => expect(result.current.events.length).toBe(2));
    expect(result.current.lastEventId).toBe(2);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`
Expected: cannot resolve `../lib/sse`.

- [ ] **Step 3: Implement hook**

`webapp/frontend/lib/sse.ts`:

```ts
"use client";

import { useEffect, useRef, useState } from "react";

import type { EventEnvelope, EventType } from "./types";

const EVENT_TYPES: EventType[] = [
  "run.started",
  "agent.state",
  "agent.report",
  "tool.call",
  "debate.message",
  "metrics.tick",
  "run.done",
  "run.error",
];

export function useEventStream(url: string | null) {
  const [events, setEvents] = useState<EventEnvelope[]>([]);
  const [lastEventId, setLastEventId] = useState<number | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const ref = useRef<EventSource | null>(null);

  useEffect(() => {
    if (!url) return;
    const es = new EventSource(url);
    ref.current = es;

    const handler = (ev: MessageEvent) => {
      try {
        const data = JSON.parse(ev.data) as EventEnvelope;
        setEvents((prev) => [...prev, data]);
        setLastEventId(data.id);
      } catch (e) {
        setError(e as Error);
      }
    };

    EVENT_TYPES.forEach((t) => es.addEventListener(t, handler as EventListener));
    es.onerror = () => setError(new Error("SSE connection error"));

    return () => {
      EVENT_TYPES.forEach((t) => es.removeEventListener(t, handler as EventListener));
      es.close();
    };
  }, [url]);

  return { events, lastEventId, error, close: () => ref.current?.close() };
}
```

- [ ] **Step 4: Run tests**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add webapp/frontend/lib/sse.ts webapp/frontend/tests/sse.test.ts
git commit -m "feat(frontend): useEventStream hook for SSE consumption"
```

### Task 4.4: Run store (Zustand)

**Files:**
- Create: `webapp/frontend/stores/run-store.ts`
- Create: `webapp/frontend/tests/run-store.test.ts`

- [ ] **Step 1: Write the failing test**

`webapp/frontend/tests/run-store.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { applyEvent, initialRunState } from "../stores/run-store";

describe("run store reducer", () => {
  it("marks an agent as running and then done when reports arrive", () => {
    let s = initialRunState();
    s = applyEvent(s, { id: 1, type: "run.started", run_id: "r1", ts: "", payload: { ticker: "AAPL", trade_date: "2026-01-15" } });
    s = applyEvent(s, { id: 2, type: "agent.state", run_id: "r1", ts: "", payload: { agent: "market_analyst", status: "running" } });
    s = applyEvent(s, { id: 3, type: "agent.report", run_id: "r1", ts: "", payload: { field: "market_report", markdown: "# x" } });
    s = applyEvent(s, { id: 4, type: "agent.state", run_id: "r1", ts: "", payload: { agent: "market_analyst", status: "done" } });

    expect(s.ticker).toBe("AAPL");
    expect(s.agents.market_analyst.status).toBe("done");
    expect(s.reports.market_report).toBe("# x");
  });

  it("accumulates debate messages by side", () => {
    let s = initialRunState();
    s = applyEvent(s, { id: 1, type: "debate.message", run_id: "r1", ts: "", payload: { side: "bull", round: 1, text: "buy" } });
    s = applyEvent(s, { id: 2, type: "debate.message", run_id: "r1", ts: "", payload: { side: "bear", round: 1, text: "sell" } });
    expect(s.debates.investment.bull).toHaveLength(1);
    expect(s.debates.investment.bear[0].text).toBe("sell");
  });

  it("captures final decision on run.done", () => {
    let s = initialRunState();
    s = applyEvent(s, { id: 1, type: "run.done", run_id: "r1", ts: "", payload: { decision: "BUY", duration_ms: 12345 } });
    expect(s.decision).toBe("BUY");
    expect(s.durationMs).toBe(12345);
    expect(s.status).toBe("done");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`
Expected: cannot resolve `../stores/run-store`.

- [ ] **Step 3: Implement the store**

`webapp/frontend/stores/run-store.ts`:

```ts
"use client";

import { create } from "zustand";

import type { AgentName, AgentStatus, EventEnvelope } from "@/lib/types";

export interface DebateMsg { side: string; round: number; text: string }

export interface RunState {
  status: "idle" | "running" | "done" | "error";
  ticker: string;
  tradeDate: string;
  agents: Record<AgentName, { status: AgentStatus }>;
  reports: Record<string, string>;
  toolCalls: { agent: AgentName; tool: string; preview?: string | null }[];
  metrics: { llmCalls: number; tools: number; tokensIn: number; tokensOut: number; elapsedMs: number };
  debates: {
    investment: { bull: DebateMsg[]; bear: DebateMsg[] };
    risk: { aggressive: DebateMsg[]; conservative: DebateMsg[]; neutral: DebateMsg[] };
  };
  decision: string;
  durationMs: number;
  errorMessage?: string;
}

const ALL_AGENTS: AgentName[] = [
  "market_analyst", "social_analyst", "news_analyst", "fundamentals_analyst",
  "bull_researcher", "bear_researcher", "research_manager", "trader",
  "aggressive_analyst", "conservative_analyst", "neutral_analyst", "portfolio_manager",
];

export function initialRunState(): RunState {
  const agents = {} as RunState["agents"];
  ALL_AGENTS.forEach((a) => (agents[a] = { status: "pending" }));
  return {
    status: "idle",
    ticker: "",
    tradeDate: "",
    agents,
    reports: {},
    toolCalls: [],
    metrics: { llmCalls: 0, tools: 0, tokensIn: 0, tokensOut: 0, elapsedMs: 0 },
    debates: { investment: { bull: [], bear: [] }, risk: { aggressive: [], conservative: [], neutral: [] } },
    decision: "",
    durationMs: 0,
  };
}

export function applyEvent(state: RunState, evt: EventEnvelope): RunState {
  switch (evt.type) {
    case "run.started": {
      const p = evt.payload as { ticker?: string; trade_date?: string };
      return { ...state, status: "running", ticker: p.ticker ?? "", tradeDate: p.trade_date ?? "" };
    }
    case "agent.state": {
      const p = evt.payload as { agent: AgentName; status: AgentStatus };
      return { ...state, agents: { ...state.agents, [p.agent]: { status: p.status } } };
    }
    case "agent.report": {
      const p = evt.payload as { field: string; markdown: string };
      return { ...state, reports: { ...state.reports, [p.field]: p.markdown } };
    }
    case "tool.call": {
      const p = evt.payload as { agent: AgentName; tool: string; result_preview?: string | null };
      return {
        ...state,
        toolCalls: [...state.toolCalls, { agent: p.agent, tool: p.tool, preview: p.result_preview }],
        metrics: { ...state.metrics, tools: state.metrics.tools + 1 },
      };
    }
    case "debate.message": {
      const p = evt.payload as DebateMsg & { side: string };
      const inv = state.debates.investment;
      const risk = state.debates.risk;
      if (p.side === "bull" || p.side === "bear") {
        return {
          ...state,
          debates: { investment: { ...inv, [p.side]: [...inv[p.side], p] }, risk },
        };
      }
      if (p.side === "aggressive" || p.side === "conservative" || p.side === "neutral") {
        return {
          ...state,
          debates: { investment: inv, risk: { ...risk, [p.side]: [...risk[p.side], p] } },
        };
      }
      return state;
    }
    case "metrics.tick": {
      const p = evt.payload as Partial<RunState["metrics"]> & { llm_calls?: number; tokens_in?: number; tokens_out?: number; elapsed_ms?: number };
      return {
        ...state,
        metrics: {
          llmCalls: p.llm_calls ?? state.metrics.llmCalls,
          tools: state.metrics.tools,
          tokensIn: p.tokens_in ?? state.metrics.tokensIn,
          tokensOut: p.tokens_out ?? state.metrics.tokensOut,
          elapsedMs: p.elapsed_ms ?? state.metrics.elapsedMs,
        },
      };
    }
    case "run.done": {
      const p = evt.payload as { decision: string; duration_ms: number };
      return { ...state, status: "done", decision: p.decision, durationMs: p.duration_ms };
    }
    case "run.error": {
      const p = evt.payload as { message: string };
      return { ...state, status: "error", errorMessage: p.message };
    }
  }
}

export const useRunStore = create<{
  byId: Record<string, RunState>;
  ingest: (runId: string, evt: EventEnvelope) => void;
  reset: (runId: string) => void;
}>((set) => ({
  byId: {},
  ingest: (runId, evt) =>
    set((s) => {
      const current = s.byId[runId] ?? initialRunState();
      return { byId: { ...s.byId, [runId]: applyEvent(current, evt) } };
    }),
  reset: (runId) =>
    set((s) => ({ byId: { ...s.byId, [runId]: initialRunState() } })),
}));
```

- [ ] **Step 4: Run tests**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add webapp/frontend/{stores,tests/run-store.test.ts}
git commit -m "feat(frontend): zustand run store with pure event reducer"
```

---

## Phase 5 — Feature Components

### Task 5.1: Pipeline stepper component

**Files:**
- Create: `webapp/frontend/components/features/pipeline-stepper.tsx`
- Create: `webapp/frontend/tests/pipeline-stepper.test.tsx`

- [ ] **Step 1: Write the failing test**

`webapp/frontend/tests/pipeline-stepper.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { PipelineStepper } from "../components/features/pipeline-stepper";

describe("PipelineStepper", () => {
  it("renders every agent with its status", () => {
    render(
      <PipelineStepper
        agents={{
          market_analyst: { status: "done" },
          social_analyst: { status: "running" },
          news_analyst: { status: "pending" },
          fundamentals_analyst: { status: "pending" },
          bull_researcher: { status: "pending" },
          bear_researcher: { status: "pending" },
          research_manager: { status: "pending" },
          trader: { status: "pending" },
          aggressive_analyst: { status: "pending" },
          conservative_analyst: { status: "pending" },
          neutral_analyst: { status: "pending" },
          portfolio_manager: { status: "pending" },
        }}
        selected="market_analyst"
        onSelect={() => {}}
      />,
    );
    expect(screen.getByText(/Market Analyst/i)).toBeInTheDocument();
    expect(screen.getByText(/Portfolio Manager/i)).toBeInTheDocument();
  });

  it("invokes onSelect when an agent row is clicked", async () => {
    const onSelect = vi.fn();
    render(
      <PipelineStepper
        agents={{
          market_analyst: { status: "done" },
          social_analyst: { status: "pending" },
          news_analyst: { status: "pending" },
          fundamentals_analyst: { status: "pending" },
          bull_researcher: { status: "pending" },
          bear_researcher: { status: "pending" },
          research_manager: { status: "pending" },
          trader: { status: "pending" },
          aggressive_analyst: { status: "pending" },
          conservative_analyst: { status: "pending" },
          neutral_analyst: { status: "pending" },
          portfolio_manager: { status: "pending" },
        }}
        selected={null}
        onSelect={onSelect}
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: /Market Analyst/i }));
    expect(onSelect).toHaveBeenCalledWith("market_analyst");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`
Expected: cannot resolve component.

- [ ] **Step 3: Implement the component**

`webapp/frontend/components/features/pipeline-stepper.tsx`:

```tsx
"use client";

import { CheckCircle2, Circle, Loader2, XCircle } from "lucide-react";
import { clsx } from "clsx";

import type { AgentName, AgentStatus } from "@/lib/types";

const AGENT_ORDER: { id: AgentName; label: string; group: string }[] = [
  { id: "market_analyst", label: "Market Analyst", group: "Analysts" },
  { id: "social_analyst", label: "Sentiment Analyst", group: "Analysts" },
  { id: "news_analyst", label: "News Analyst", group: "Analysts" },
  { id: "fundamentals_analyst", label: "Fundamentals Analyst", group: "Analysts" },
  { id: "bull_researcher", label: "Bull Researcher", group: "Research" },
  { id: "bear_researcher", label: "Bear Researcher", group: "Research" },
  { id: "research_manager", label: "Research Manager", group: "Research" },
  { id: "trader", label: "Trader", group: "Trade" },
  { id: "aggressive_analyst", label: "Aggressive Risk", group: "Risk" },
  { id: "conservative_analyst", label: "Conservative Risk", group: "Risk" },
  { id: "neutral_analyst", label: "Neutral Risk", group: "Risk" },
  { id: "portfolio_manager", label: "Portfolio Manager", group: "Decision" },
];

interface Props {
  agents: Record<AgentName, { status: AgentStatus }>;
  selected: AgentName | null;
  onSelect: (agent: AgentName) => void;
}

function StatusIcon({ status }: { status: AgentStatus }) {
  if (status === "done") return <CheckCircle2 className="h-4 w-4 text-emerald-500" />;
  if (status === "running") return <Loader2 className="h-4 w-4 animate-spin text-sky-500" />;
  if (status === "error") return <XCircle className="h-4 w-4 text-red-500" />;
  return <Circle className="h-4 w-4 text-zinc-400" />;
}

export function PipelineStepper({ agents, selected, onSelect }: Props) {
  let currentGroup = "";
  return (
    <ol className="space-y-1">
      {AGENT_ORDER.map((a) => {
        const showGroup = a.group !== currentGroup;
        currentGroup = a.group;
        return (
          <li key={a.id}>
            {showGroup && (
              <div className="mt-3 text-xs uppercase tracking-wide text-zinc-500">{a.group}</div>
            )}
            <button
              type="button"
              onClick={() => onSelect(a.id)}
              className={clsx(
                "flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm transition",
                selected === a.id ? "bg-zinc-200 dark:bg-zinc-800" : "hover:bg-zinc-100 dark:hover:bg-zinc-900",
              )}
            >
              <StatusIcon status={agents[a.id].status} />
              <span>{a.label}</span>
            </button>
          </li>
        );
      })}
    </ol>
  );
}
```

- [ ] **Step 4: Run tests**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add webapp/frontend/components/features/pipeline-stepper.tsx webapp/frontend/tests/pipeline-stepper.test.tsx
git commit -m "feat(frontend): PipelineStepper agent navigation component"
```

### Task 5.2: Debate bubbles component

**Files:**
- Create: `webapp/frontend/components/features/debate-bubbles.tsx`
- Create: `webapp/frontend/tests/debate-bubbles.test.tsx`

- [ ] **Step 1: Write the failing test**

`webapp/frontend/tests/debate-bubbles.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { DebateBubbles } from "../components/features/debate-bubbles";

describe("DebateBubbles", () => {
  it("renders bull and bear messages in two columns", () => {
    render(
      <DebateBubbles
        sides={[
          { side: "bull", label: "Bull", messages: [{ side: "bull", round: 1, text: "Strong earnings" }] },
          { side: "bear", label: "Bear", messages: [{ side: "bear", round: 1, text: "Overvalued" }] },
        ]}
      />,
    );
    expect(screen.getByText("Strong earnings")).toBeInTheDocument();
    expect(screen.getByText("Overvalued")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`
Expected: cannot resolve.

- [ ] **Step 3: Implement**

`webapp/frontend/components/features/debate-bubbles.tsx`:

```tsx
"use client";

import { clsx } from "clsx";

import type { DebateMsg } from "@/stores/run-store";

interface Props {
  sides: { side: string; label: string; messages: DebateMsg[]; tone?: "bull" | "bear" | "neutral" }[];
}

const TONE_BG: Record<string, string> = {
  bull: "bg-emerald-50 dark:bg-emerald-900/30",
  bear: "bg-red-50 dark:bg-red-900/30",
  neutral: "bg-zinc-100 dark:bg-zinc-800",
};

export function DebateBubbles({ sides }: Props) {
  const columns = `grid-cols-${sides.length}`;
  return (
    <div className={clsx("grid gap-4", columns)} style={{ gridTemplateColumns: `repeat(${sides.length}, minmax(0,1fr))` }}>
      {sides.map((s) => (
        <div key={s.side} className="space-y-2">
          <h4 className="font-medium">{s.label}</h4>
          {s.messages.map((m, i) => (
            <div
              key={`${s.side}-${i}`}
              className={clsx("rounded-md p-3 text-sm shadow-sm", TONE_BG[s.tone ?? s.side] ?? TONE_BG.neutral)}
            >
              <div className="mb-1 text-xs text-zinc-500">Round {m.round}</div>
              {m.text}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 4: Run tests**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add webapp/frontend/components/features/debate-bubbles.tsx webapp/frontend/tests/debate-bubbles.test.tsx
git commit -m "feat(frontend): DebateBubbles two/three-column debate view"
```

### Task 5.3: Decision card, metrics panel, tool log

**Files:**
- Create: `webapp/frontend/components/features/decision-card.tsx`
- Create: `webapp/frontend/components/features/metrics-panel.tsx`
- Create: `webapp/frontend/components/features/tool-log.tsx`

These are presentation-only. Since they are small, group them in a single commit with snapshot-style tests omitted; rely on E2E coverage.

- [ ] **Step 1: Implement decision card**

`webapp/frontend/components/features/decision-card.tsx`:

```tsx
"use client";

import { ratingColor } from "@/lib/format";

interface Props {
  decision: string;
  rating?: string | null;
  durationMs: number;
}

export function DecisionCard({ decision, rating, durationMs }: Props) {
  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <div className="text-xs uppercase tracking-wider text-zinc-500">Final Decision</div>
      <div className={`mt-1 text-3xl font-semibold ${ratingColor(rating)}`}>{rating ?? "—"}</div>
      <pre className="mt-4 whitespace-pre-wrap text-sm text-zinc-700 dark:text-zinc-300">{decision}</pre>
      <div className="mt-4 text-xs text-zinc-500">Run took {(durationMs / 1000).toFixed(1)}s</div>
    </div>
  );
}
```

- [ ] **Step 2: Implement metrics panel**

`webapp/frontend/components/features/metrics-panel.tsx`:

```tsx
"use client";

import { elapsed } from "@/lib/format";

interface Props {
  llmCalls: number;
  tools: number;
  tokensIn: number;
  tokensOut: number;
  elapsedMs: number;
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-md bg-zinc-100 p-3 dark:bg-zinc-900">
      <div className="text-xs text-zinc-500">{label}</div>
      <div className="text-lg font-semibold">{value}</div>
    </div>
  );
}

export function MetricsPanel(p: Props) {
  return (
    <div className="grid grid-cols-2 gap-2">
      <Metric label="LLM calls" value={p.llmCalls} />
      <Metric label="Tool calls" value={p.tools} />
      <Metric label="Tokens ↑" value={p.tokensIn.toLocaleString()} />
      <Metric label="Tokens ↓" value={p.tokensOut.toLocaleString()} />
      <Metric label="Elapsed" value={elapsed(p.elapsedMs)} />
    </div>
  );
}
```

- [ ] **Step 3: Implement tool log**

`webapp/frontend/components/features/tool-log.tsx`:

```tsx
"use client";

import type { AgentName } from "@/lib/types";

interface Item { agent: AgentName; tool: string; preview?: string | null }

export function ToolLog({ items }: { items: Item[] }) {
  if (items.length === 0) return <div className="text-sm text-zinc-500">No tool calls yet</div>;
  return (
    <ul className="space-y-1 text-sm">
      {items.slice(-30).map((it, i) => (
        <li key={i} className="rounded border border-zinc-200 bg-white px-2 py-1 dark:border-zinc-800 dark:bg-zinc-900">
          <span className="font-mono text-xs text-zinc-500">{it.agent}</span>{" "}
          <span className="font-mono text-xs">{it.tool}</span>
          {it.preview && <div className="truncate text-xs text-zinc-500">{it.preview}</div>}
        </li>
      ))}
    </ul>
  );
}
```

- [ ] **Step 4: Quick check (lint + build)**

Run: `npm run build`
Expected: build succeeds with no TS errors.

- [ ] **Step 5: Commit**

```bash
git add webapp/frontend/components/features/{decision-card,metrics-panel,tool-log}.tsx
git commit -m "feat(frontend): DecisionCard, MetricsPanel, ToolLog presentation components"
```

### Task 5.4: Markdown renderer wrapper

**Files:**
- Create: `webapp/frontend/components/features/markdown.tsx`

- [ ] **Step 1: Implement**

`webapp/frontend/components/features/markdown.tsx`:

```tsx
"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export function Markdown({ children }: { children: string }) {
  return (
    <div className="prose prose-zinc max-w-none dark:prose-invert">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{children}</ReactMarkdown>
    </div>
  );
}
```

- [ ] **Step 2: Verify build**

Run: `npm run build`
Expected: success.

- [ ] **Step 3: Commit**

```bash
git add webapp/frontend/components/features/markdown.tsx
git commit -m "feat(frontend): Markdown wrapper with GFM"
```

### Task 5.5: Price chart component

**Files:**
- Create: `webapp/frontend/components/features/price-chart.tsx`

- [ ] **Step 1: Implement**

`webapp/frontend/components/features/price-chart.tsx`:

```tsx
"use client";

import { createChart, type IChartApi } from "lightweight-charts";
import { useEffect, useRef } from "react";

import type { MarketBar } from "@/lib/types";

export function PriceChart({ bars }: { bars: MarketBar[] }) {
  const ref = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<IChartApi | null>(null);

  useEffect(() => {
    if (!ref.current) return;
    const chart = createChart(ref.current, {
      height: 360,
      layout: { background: { color: "transparent" }, textColor: "#71717a" },
      grid: { vertLines: { visible: false }, horzLines: { color: "#27272a22" } },
      timeScale: { borderVisible: false },
      rightPriceScale: { borderVisible: false },
    });
    chartRef.current = chart;
    const series = chart.addCandlestickSeries({
      upColor: "#16a34a",
      downColor: "#dc2626",
      borderVisible: false,
      wickUpColor: "#16a34a",
      wickDownColor: "#dc2626",
    });
    series.setData(bars.map((b) => ({ time: b.t, open: b.o, high: b.h, low: b.l, close: b.c })));
    chart.timeScale().fitContent();
    return () => {
      chart.remove();
      chartRef.current = null;
    };
  }, [bars]);

  return <div ref={ref} className="w-full" />;
}
```

- [ ] **Step 2: Verify build**

Run: `npm run build`
Expected: success.

- [ ] **Step 3: Commit**

```bash
git add webapp/frontend/components/features/price-chart.tsx
git commit -m "feat(frontend): PriceChart lightweight-charts wrapper"
```

---

## Phase 6 — Pages

### Task 6.1: Dashboard page (`/`)

**Files:**
- Modify: `webapp/frontend/app/page.tsx`
- Create: `webapp/frontend/components/features/run-card.tsx`

- [ ] **Step 1: RunCard component**

`webapp/frontend/components/features/run-card.tsx`:

```tsx
"use client";

import Link from "next/link";

import { pct, ratingColor } from "@/lib/format";
import type { MemoryEntry } from "@/lib/types";

export function RunCard({ entry }: { entry: MemoryEntry }) {
  return (
    <Link
      href={`/markets/${entry.ticker}`}
      className="flex items-center justify-between rounded-md border border-zinc-200 bg-white px-4 py-3 text-sm transition hover:border-zinc-300 dark:border-zinc-800 dark:bg-zinc-900"
    >
      <div>
        <div className="font-semibold">{entry.ticker}</div>
        <div className="text-xs text-zinc-500">{entry.date}</div>
      </div>
      <div className={`font-medium ${ratingColor(entry.rating)}`}>{entry.rating}</div>
      <div className="w-20 text-right text-xs text-zinc-500">α {pct(entry.alpha)}</div>
    </Link>
  );
}
```

- [ ] **Step 2: Dashboard page**

`webapp/frontend/app/page.tsx`:

```tsx
import Link from "next/link";

import { RunCard } from "@/components/features/run-card";
import { api } from "@/lib/api";
import { pct } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function Home() {
  const { entries } = await api.history();
  const pending = entries.filter((e) => e.pending).length;
  const alphas = entries.map((e) => e.alpha).filter((x): x is number => x != null);
  const avgAlpha = alphas.length ? alphas.reduce((a, b) => a + b, 0) / alphas.length : null;

  return (
    <main className="mx-auto max-w-6xl space-y-8 p-8">
      <header className="flex items-center justify-between">
        <h1 className="text-3xl font-semibold">Workbench</h1>
        <Link href="/runs/new" className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white dark:bg-zinc-100 dark:text-zinc-900">
          New Analysis
        </Link>
      </header>

      <section className="grid grid-cols-4 gap-3">
        <Stat label="Runs" value={entries.length.toString()} />
        <Stat label="Avg α vs benchmark" value={pct(avgAlpha)} />
        <Stat label="Pending reflections" value={pending.toString()} />
        <Stat label="Last run" value={entries[0]?.date ?? "—"} />
      </section>

      <section>
        <h2 className="mb-3 text-lg font-medium">Recent runs</h2>
        <div className="space-y-2">
          {entries.slice(0, 10).map((e) => (
            <RunCard key={`${e.date}-${e.ticker}`} entry={e} />
          ))}
          {entries.length === 0 && (
            <p className="text-sm text-zinc-500">No runs yet. Hit "New Analysis" to start.</p>
          )}
        </div>
      </section>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="text-xs uppercase tracking-wide text-zinc-500">{label}</div>
      <div className="mt-1 text-xl font-semibold">{value}</div>
    </div>
  );
}
```

- [ ] **Step 3: Verify build**

Run: `npm run build`
Expected: success.

- [ ] **Step 4: Commit**

```bash
git add webapp/frontend/app/page.tsx webapp/frontend/components/features/run-card.tsx
git commit -m "feat(frontend): Dashboard page with stats and recent runs"
```

### Task 6.2: New Analysis wizard (`/runs/new`)

**Files:**
- Create: `webapp/frontend/app/runs/new/page.tsx`

- [ ] **Step 1: Implement wizard page (single file, four steps inline)**

`webapp/frontend/app/runs/new/page.tsx`:

```tsx
"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { api } from "@/lib/api";
import type { RunRequest } from "@/lib/types";

const ANALYSTS = [
  { id: "market", label: "Market" },
  { id: "social", label: "Sentiment" },
  { id: "news", label: "News" },
  { id: "fundamentals", label: "Fundamentals" },
] as const;

export default function NewRun() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [form, setForm] = useState<RunRequest>({
    ticker: "AAPL",
    trade_date: new Date().toISOString().slice(0, 10),
    analysts: ["market", "social", "news", "fundamentals"],
    llm_provider: "openai",
    max_debate_rounds: 1,
    max_risk_discuss_rounds: 1,
    output_language: "English",
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setSubmitting(true);
    setError(null);
    try {
      const { run_id } = await api.createRun(form);
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
            className={`h-1 flex-1 rounded ${n <= step ? "bg-zinc-900 dark:bg-zinc-100" : "bg-zinc-200 dark:bg-zinc-800"}`}
          />
        ))}
      </div>

      {step === 1 && (
        <div className="space-y-4">
          <Field label="Ticker">
            <input
              value={form.ticker}
              onChange={(e) => setForm({ ...form, ticker: e.target.value })}
              className="w-full rounded border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-950"
            />
          </Field>
          <Field label="Trade date">
            <input
              type="date"
              value={form.trade_date}
              onChange={(e) => setForm({ ...form, trade_date: e.target.value })}
              className="w-full rounded border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-950"
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
                    analysts: on ? form.analysts!.filter((x) => x !== a.id) : [...form.analysts!, a.id],
                  })
                }
                className={`rounded-md border p-4 text-left ${on ? "border-zinc-900 bg-zinc-100 dark:border-zinc-100 dark:bg-zinc-900" : "border-zinc-200 dark:border-zinc-800"}`}
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
              className="w-full rounded border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-950"
            >
              {["openai", "anthropic", "google", "xai", "deepseek", "qwen", "qwen-cn", "glm", "glm-cn", "minimax", "minimax-cn", "openrouter", "ollama"].map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Deep think model (optional)">
              <input
                value={form.deep_think_llm ?? ""}
                onChange={(e) => setForm({ ...form, deep_think_llm: e.target.value || undefined })}
                className="w-full rounded border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-950"
              />
            </Field>
            <Field label="Quick think model (optional)">
              <input
                value={form.quick_think_llm ?? ""}
                onChange={(e) => setForm({ ...form, quick_think_llm: e.target.value || undefined })}
                className="w-full rounded border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-950"
              />
            </Field>
          </div>
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
              onChange={(e) => setForm({ ...form, max_debate_rounds: Number(e.target.value) })}
              className="w-full"
            />
          </Field>
          <Field label={`Risk debate rounds: ${form.max_risk_discuss_rounds}`}>
            <input
              type="range"
              min={1}
              max={5}
              value={form.max_risk_discuss_rounds}
              onChange={(e) => setForm({ ...form, max_risk_discuss_rounds: Number(e.target.value) })}
              className="w-full"
            />
          </Field>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.checkpoint_enabled}
              onChange={(e) => setForm({ ...form, checkpoint_enabled: e.target.checked })}
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
          className="rounded border border-zinc-300 px-4 py-2 text-sm disabled:opacity-50 dark:border-zinc-700"
        >
          Back
        </button>
        {step < 4 ? (
          <button
            type="button"
            onClick={() => setStep((s) => s + 1)}
            className="rounded bg-zinc-900 px-4 py-2 text-sm font-medium text-white dark:bg-zinc-100 dark:text-zinc-900"
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
      {error && <div className="mt-4 text-sm text-red-600">{error}</div>}
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

- [ ] **Step 2: Verify build**

Run: `npm run build`
Expected: success.

- [ ] **Step 3: Commit**

```bash
git add webapp/frontend/app/runs/new/page.tsx
git commit -m "feat(frontend): /runs/new wizard with 4 steps"
```

### Task 6.3: Run Detail page (`/runs/[runId]`)

**Files:**
- Create: `webapp/frontend/app/runs/[runId]/page.tsx`

- [ ] **Step 1: Implement page**

`webapp/frontend/app/runs/[runId]/page.tsx`:

```tsx
"use client";

import { use, useEffect, useMemo, useState } from "react";

import { DebateBubbles } from "@/components/features/debate-bubbles";
import { DecisionCard } from "@/components/features/decision-card";
import { Markdown } from "@/components/features/markdown";
import { MetricsPanel } from "@/components/features/metrics-panel";
import { PipelineStepper } from "@/components/features/pipeline-stepper";
import { ToolLog } from "@/components/features/tool-log";
import { useEventStream } from "@/lib/sse";
import type { AgentName } from "@/lib/types";
import { applyEvent, initialRunState, type RunState } from "@/stores/run-store";

const REPORT_FIELD: Partial<Record<AgentName, string>> = {
  market_analyst: "market_report",
  social_analyst: "sentiment_report",
  news_analyst: "news_report",
  fundamentals_analyst: "fundamentals_report",
  research_manager: "investment_plan",
  trader: "trader_investment_plan",
  portfolio_manager: "final_trade_decision",
};

export default function RunDetail({ params }: { params: Promise<{ runId: string }> }) {
  const { runId } = use(params);
  const { events } = useEventStream(`/api/runs/${runId}/stream`);
  const [state, setState] = useState<RunState>(initialRunState());
  const [selected, setSelected] = useState<AgentName | null>("market_analyst");
  const [cursor, setCursor] = useState(0);

  useEffect(() => {
    if (events.length <= cursor) return;
    let next = state;
    for (let i = cursor; i < events.length; i++) next = applyEvent(next, events[i]);
    setState(next);
    setCursor(events.length);
  }, [events, cursor, state]);

  const centerView = useMemo(() => {
    if (!selected) return null;
    if (selected === "bull_researcher" || selected === "bear_researcher" || selected === "research_manager") {
      return (
        <DebateBubbles
          sides={[
            { side: "bull", label: "Bull", messages: state.debates.investment.bull, tone: "bull" },
            { side: "bear", label: "Bear", messages: state.debates.investment.bear, tone: "bear" },
          ]}
        />
      );
    }
    if (selected === "aggressive_analyst" || selected === "conservative_analyst" || selected === "neutral_analyst") {
      return (
        <DebateBubbles
          sides={[
            { side: "aggressive", label: "Aggressive", messages: state.debates.risk.aggressive, tone: "bull" },
            { side: "conservative", label: "Conservative", messages: state.debates.risk.conservative, tone: "bear" },
            { side: "neutral", label: "Neutral", messages: state.debates.risk.neutral, tone: "neutral" },
          ]}
        />
      );
    }
    if (selected === "portfolio_manager") {
      return (
        <DecisionCard
          decision={state.decision || state.reports.final_trade_decision || "—"}
          rating={state.decision?.match(/BUY|SELL|HOLD/)?.[0] ?? null}
          durationMs={state.durationMs}
        />
      );
    }
    const field = REPORT_FIELD[selected];
    const md = field ? state.reports[field] : undefined;
    return md ? <Markdown>{md}</Markdown> : <p className="text-sm text-zinc-500">Waiting for output…</p>;
  }, [selected, state]);

  return (
    <main className="grid h-screen grid-cols-[260px_1fr_320px] gap-4 p-4">
      <aside className="overflow-y-auto rounded-lg border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900">
        <div className="mb-3">
          <div className="text-xs uppercase text-zinc-500">{state.ticker || "—"} · {state.tradeDate || "—"}</div>
          <div className="text-sm font-medium">Status: {state.status}</div>
        </div>
        <PipelineStepper agents={state.agents} selected={selected} onSelect={setSelected} />
      </aside>

      <section className="overflow-y-auto rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
        {centerView}
      </section>

      <aside className="space-y-4 overflow-y-auto">
        <MetricsPanel
          llmCalls={state.metrics.llmCalls}
          tools={state.metrics.tools}
          tokensIn={state.metrics.tokensIn}
          tokensOut={state.metrics.tokensOut}
          elapsedMs={state.metrics.elapsedMs}
        />
        <div>
          <h3 className="mb-2 text-xs uppercase text-zinc-500">Tool calls</h3>
          <ToolLog items={state.toolCalls} />
        </div>
        {state.status === "error" && (
          <div className="rounded border border-red-300 bg-red-50 p-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/30 dark:text-red-200">
            {state.errorMessage ?? "Unknown error"}
          </div>
        )}
      </aside>
    </main>
  );
}
```

- [ ] **Step 2: Verify build**

Run: `npm run build`
Expected: success.

- [ ] **Step 3: Commit**

```bash
git add webapp/frontend/app/runs/[runId]/page.tsx
git commit -m "feat(frontend): /runs/[runId] live-streaming three-column detail view"
```

### Task 6.4: History, Markets, Compare, Settings pages

**Files:**
- Create: `webapp/frontend/app/runs/page.tsx`
- Create: `webapp/frontend/app/markets/[ticker]/page.tsx`
- Create: `webapp/frontend/app/compare/page.tsx`
- Create: `webapp/frontend/app/settings/page.tsx`

- [ ] **Step 1: History list**

`webapp/frontend/app/runs/page.tsx`:

```tsx
import { api } from "@/lib/api";
import { pct, ratingColor } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function RunsPage() {
  const { entries } = await api.history();
  return (
    <main className="mx-auto max-w-6xl p-8">
      <h1 className="mb-6 text-2xl font-semibold">All runs</h1>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-zinc-200 text-left text-xs uppercase text-zinc-500 dark:border-zinc-800">
            <th className="py-2">Date</th>
            <th>Ticker</th>
            <th>Rating</th>
            <th>Raw</th>
            <th>α</th>
            <th>Reflection</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((e) => (
            <tr key={`${e.date}-${e.ticker}`} className="border-b border-zinc-100 dark:border-zinc-900">
              <td className="py-2">{e.date}</td>
              <td className="font-medium">{e.ticker}</td>
              <td className={ratingColor(e.rating)}>{e.rating}</td>
              <td>{pct(e.raw_return)}</td>
              <td>{pct(e.alpha)}</td>
              <td className="truncate text-zinc-500">{e.reflection?.slice(0, 120) || (e.pending ? "pending" : "—")}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}
```

- [ ] **Step 2: Ticker view**

`webapp/frontend/app/markets/[ticker]/page.tsx`:

```tsx
import { PriceChart } from "@/components/features/price-chart";
import { api } from "@/lib/api";
import { pct, ratingColor } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function MarketPage({ params }: { params: Promise<{ ticker: string }> }) {
  const { ticker } = await params;
  const [{ bars }, { entries }] = await Promise.all([
    api.market(ticker, "6mo"),
    api.history({ ticker }),
  ]);

  return (
    <main className="mx-auto max-w-6xl space-y-6 p-8">
      <h1 className="text-2xl font-semibold">{ticker}</h1>
      <PriceChart bars={bars} />
      <section>
        <h2 className="mb-3 text-lg font-medium">Decision history</h2>
        <ul className="space-y-2">
          {entries.map((e) => (
            <li key={e.date} className="rounded-md border border-zinc-200 bg-white p-3 text-sm dark:border-zinc-800 dark:bg-zinc-900">
              <div className="flex items-center justify-between">
                <div>{e.date}</div>
                <div className={ratingColor(e.rating)}>{e.rating}</div>
                <div className="text-xs text-zinc-500">α {pct(e.alpha)}</div>
              </div>
              <p className="mt-2 text-zinc-600 dark:text-zinc-400">{e.reflection || "Pending reflection"}</p>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
```

- [ ] **Step 3: Compare page**

`webapp/frontend/app/compare/page.tsx`:

```tsx
export const dynamic = "force-dynamic";

export default function ComparePage() {
  return (
    <main className="mx-auto max-w-6xl p-8">
      <h1 className="mb-4 text-2xl font-semibold">Compare runs</h1>
      <p className="text-sm text-zinc-500">
        Select up to 4 runs from the history table; pass their ids as <code>?ids=a,b,c</code> to compare. (Selection UI lands in a follow-up.)
      </p>
    </main>
  );
}
```

- [ ] **Step 4: Settings page**

`webapp/frontend/app/settings/page.tsx`:

```tsx
import { api } from "@/lib/api";

export const dynamic = "force-dynamic";

export default async function Settings() {
  const [{ providers }, cfg] = await Promise.all([api.providers(), api.config()]);
  return (
    <main className="mx-auto max-w-3xl space-y-8 p-8">
      <h1 className="text-2xl font-semibold">Settings</h1>

      <section>
        <h2 className="mb-3 text-lg font-medium">Providers</h2>
        <ul className="space-y-1 text-sm">
          {providers.map((p) => (
            <li key={p.id} className="flex items-center justify-between rounded border border-zinc-200 px-3 py-2 dark:border-zinc-800">
              <span>{p.label}</span>
              <span className={p.configured ? "text-emerald-600" : "text-zinc-500"}>
                {p.configured ? "Configured" : "Missing key"}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-medium">Defaults</h2>
        <pre className="overflow-auto rounded bg-zinc-100 p-4 text-xs dark:bg-zinc-900">
{JSON.stringify(cfg, null, 2)}
        </pre>
      </section>
    </main>
  );
}
```

- [ ] **Step 5: Verify build**

Run: `npm run build`
Expected: success.

- [ ] **Step 6: Commit**

```bash
git add webapp/frontend/app/runs/page.tsx webapp/frontend/app/markets/[ticker]/page.tsx webapp/frontend/app/compare/page.tsx webapp/frontend/app/settings/page.tsx
git commit -m "feat(frontend): history, ticker view, compare placeholder, settings pages"
```

### Task 6.5: Navigation bar

**Files:**
- Modify: `webapp/frontend/app/layout.tsx`
- Create: `webapp/frontend/components/features/nav.tsx`

- [ ] **Step 1: Nav component**

`webapp/frontend/components/features/nav.tsx`:

```tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { clsx } from "clsx";

const LINKS = [
  { href: "/", label: "Dashboard" },
  { href: "/runs", label: "Runs" },
  { href: "/runs/new", label: "New" },
  { href: "/compare", label: "Compare" },
  { href: "/settings", label: "Settings" },
];

export function Nav() {
  const path = usePathname();
  return (
    <nav className="border-b border-zinc-200 bg-white px-6 py-3 dark:border-zinc-800 dark:bg-zinc-900">
      <ul className="flex items-center gap-4 text-sm">
        <li className="font-semibold">TradingAgents</li>
        {LINKS.map((l) => (
          <li key={l.href}>
            <Link
              href={l.href}
              className={clsx("text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100", path === l.href && "text-zinc-900 dark:text-zinc-100")}
            >
              {l.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
```

- [ ] **Step 2: Wire into layout**

Replace `webapp/frontend/app/layout.tsx`:

```tsx
import "./globals.css";

import type { ReactNode } from "react";

import { Nav } from "@/components/features/nav";

export const metadata = { title: "TradingAgents Workbench" };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-zinc-50 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
        <Nav />
        {children}
      </body>
    </html>
  );
}
```

- [ ] **Step 3: Verify build**

Run: `npm run build`
Expected: success.

- [ ] **Step 4: Commit**

```bash
git add webapp/frontend/app/layout.tsx webapp/frontend/components/features/nav.tsx
git commit -m "feat(frontend): top navigation bar"
```

---

## Phase 7 — Dev Launcher and Smoke Test

### Task 7.1: One-shot launch script

**Files:**
- Create: `scripts/web.sh`

- [ ] **Step 1: Write the script**

`scripts/web.sh`:

```bash
#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

uvicorn webapp.backend.main:app --reload --port 8000 &
BACKEND_PID=$!
trap 'kill "$BACKEND_PID" 2>/dev/null || true' EXIT

(cd webapp/frontend && npm run dev)
```

- [ ] **Step 2: chmod +x**

Run: `chmod +x scripts/web.sh`

- [ ] **Step 3: Commit**

```bash
git add scripts/web.sh
git commit -m "chore: add scripts/web.sh launcher for backend + frontend"
```

### Task 7.2: Smoke test against running stack

**Files:**
- Create: `webapp/backend/tests/test_smoke.py`

- [ ] **Step 1: Write the test**

`webapp/backend/tests/test_smoke.py`:

```python
import pytest
from httpx import ASGITransport, AsyncClient

from webapp.backend.main import create_app


@pytest.mark.asyncio
async def test_routes_register():
    app = create_app()
    paths = {route.path for route in app.routes}
    assert "/api/health" in paths
    assert "/api/runs" in paths
    assert "/api/runs/{run_id}/stream" in paths
    assert "/api/config" in paths
    assert "/api/providers/health" in paths
    assert "/api/markets/{ticker}" in paths


@pytest.mark.asyncio
async def test_health_live():
    async with AsyncClient(transport=ASGITransport(app=create_app()), base_url="http://test") as c:
        r = await c.get("/api/health")
        assert r.status_code == 200
```

- [ ] **Step 2: Run all backend tests**

Run: `pytest webapp/backend -q`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add webapp/backend/tests/test_smoke.py
git commit -m "test(backend): smoke test asserts all routes registered"
```

---

## Phase 8 — Verification

### Task 8.1: Full stack run-through

- [ ] **Step 1: Start backend**

Run in a separate terminal: `uvicorn webapp.backend.main:app --port 8000`
Expected: Uvicorn boots and binds to 8000.

- [ ] **Step 2: Start frontend**

Run in another terminal: `cd webapp/frontend && npm run dev`
Expected: Next.js dev server boots on 3000.

- [ ] **Step 3: Manual smoke**

Open `http://localhost:3000/`. Confirm:
- Dashboard renders with header and (possibly empty) recent runs list.
- Navigation bar links work.
- `/settings` shows the providers list with green/red dots based on local env.
- `/runs/new` wizard walks step 1 → 4.
- Submitting the wizard with a real provider key streams events to `/runs/[runId]`.

- [ ] **Step 4: Run all tests**

Run from repo root:

```bash
pytest -q
(cd webapp/frontend && npm test && npm run build)
```

Expected: all pass.

- [ ] **Step 5: Final commit (if anything fixed during verification)**

```bash
git status
# only commit if there are changes
```

---

## Self-Review Notes

- **Spec coverage**: every section of the spec maps to a task. Dashboard → 6.1. Wizard → 6.2. Run Detail → 6.3 + 5.x components. History/Markets/Compare/Settings → 6.4. SSE protocol → 2.x. Memory log → 3.2. Config → 3.3. Providers → 3.4. Markets → 3.5.
- **Out of scope honored**: no auth, no mobile-first, no broker — none of these appear in tasks.
- **Two follow-ups intentionally not bottomed out** (acknowledged in plan, not blocking v1):
  - Compare page selection UI is left as a follow-up; the spec listed it but its UX is small and can land later.
  - JSONL on-disk replay (`~/.tradingagents/cache/runs/<id>.jsonl`) is left as a follow-up; live + ring buffer is sufficient for v1 viewing. Add when needed.
- **Type consistency**: `AgentName` enum values, `EventType` strings, and SSE payload field names match between backend (`schemas.py`) and frontend (`lib/types.ts`). Memory log fields (`raw_return`, `alpha`, `holding`, `pending`, …) match between `routes/memory.py` and `MemoryEntry`.
- **No placeholders**: every code step includes the actual code; every test step includes the actual test; every command is concrete.
