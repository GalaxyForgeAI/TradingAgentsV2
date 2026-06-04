# TradingAgents Web Workbench — Design

> **English** | [中文](./2026-06-04-frontend-workbench-design.zh-CN.md)

- **Status**: Draft
- **Date**: 2026-06-04
- **Owner**: Frontend Workbench
- **Related**: `tradingagents/graph/trading_graph.py`, `cli/main.py`

## 1. Problem & Goals

TradingAgents today is a CLI-only multi-agent trading analysis framework. The CLI already streams rich progress (agent statuses, tool calls, token counts, report markdown) via a `Rich.Live` dashboard, but every run is ephemeral, single-session, and not comparable across runs. There is no way to:

- See multiple historical runs side by side
- Replay a completed run
- Inspect the bull/bear and risk debates visually
- Overlay decisions on a price chart
- Manage provider/model/data-source config without editing env vars
- Trigger reflection backfill from the UI

**Goal**: ship a browser-based workbench that supersedes the CLI experience while reusing the existing `TradingAgentsGraph` engine unchanged. The workbench must support live streaming, replay, history, comparison, per-ticker chart overlays, and a guided "new run" wizard.

**Non-goals**: replacing the CLI (keep both), implementing a real broker connection, user accounts / multi-tenancy, mobile-first design.

## 2. Users & Top Tasks

Single-user local research tool. Top tasks:

1. Kick off a new analysis with a few clicks and watch agents work in real time.
2. Browse past runs, filter by ticker/date/rating, open one to inspect.
3. Compare 2–4 runs (e.g., different models for the same ticker).
4. See where past decisions landed on a price chart for a given ticker.
5. Manage API keys, default model, debate rounds, data-source vendor per category.

## 3. Information Architecture

```
/                     Dashboard overview
/runs/new             New analysis wizard
/runs/[runId]         Run detail (Live or replay)
/runs                 All historical runs (decision log)
/markets/[ticker]     Single-ticker view (chart + history + reflections)
/compare              Multi-run comparison (≤4)
/settings             API keys / models / agent behavior / data sources
```

## 4. UX Module Specs

### 4.1 Dashboard (`/`)

- Header row: 4 metric cards — runs this month, avg alpha vs benchmark, pending reflections, token spend.
- Middle: condensed timeline of the latest 10 runs as horizontal bars colored by 5-tier rating.
- Footer: Pending Reflections list (clicking triggers outcome backfill) + Quick Run cards (1-click rerun of yesterday's tickers).

### 4.2 New Analysis Wizard (`/runs/new`)

Four steps in a stepper:

1. Ticker & date (auto-detect market from suffix `.HK`, `.T`, `.SS`, etc.)
2. Analyst picks (1–4 of market / sentiment / news / fundamentals as visual cards)
3. LLM provider + deep/quick models + reasoning effort slider
4. Advanced (debate rounds, temperature, checkpoint, language)

Right-rail "cost estimate" updates live based on token × provider × debate rounds.

Submit → POST `/api/runs` → navigate to `/runs/[runId]`.

### 4.3 Run Detail (`/runs/[runId]`) — primary surface

Three-column layout:

| Column     | Width | Content                                                                                  |
|------------|-------|------------------------------------------------------------------------------------------|
| Left       | 20%   | Pipeline stepper: vertical list of every agent node with 4 states (pending/running/done/error) and a spinner |
| Center     | 55%   | Output of currently-selected agent — markdown with code highlighting, collapsible tables |
| Right      | 25%   | Live metrics: LLM calls, tool calls, tokens in/out, elapsed; rolling tool-call log       |

Pipeline stepper doubles as navigation:

- Clicking an Analyst → center renders the corresponding `*_report` markdown.
- Clicking the Research debate node → center switches to a **debate-bubble** view: two-column chat bubbles (bull left, bear right) stacked by round, with the Research Manager verdict at the bottom.
- Clicking the Risk debate node → three-column bubbles (aggressive / conservative / neutral) + Portfolio Manager verdict.
- Clicking Portfolio Manager → final decision card: BUY / SELL / HOLD, 5-tier rating, confidence bar, and the rationale.

Inline price callouts: in the Market Analyst markdown, prices/indicator values mentioned by the agent are highlighted; hover pops a mini K-line drawn with `lightweight-charts`.

Streaming: SSE chunks patch the corresponding agent's slice. Buttons: pause, resume, cancel.

After run completes: replay mode. A scrubber at the bottom replays the event stream chronologically so the user can watch agents appear in the same order they did live.

### 4.4 History (`/runs`)

Table with columns: `date | ticker | provider/model | rating | raw return | alpha | reflection excerpt | elapsed | tokens`. Top filters: tickers, date range, rating, provider, pending-only. Selecting ≤4 rows enables a "Compare" action.

### 4.5 Compare (`/compare`)

Up to 4 runs side by side, each column identically structured (decision, each analyst summary, debates summary). Differences across columns are highlighted with paragraph-level diffing. A single chart at the top compares each run's realized alpha against the regional benchmark.

### 4.6 Ticker View (`/markets/[ticker]`)

- Top: candlestick chart with markers overlaying every historical decision the system made on this ticker (color by BUY/SELL/HOLD).
- Middle: separate panes for MACD, RSI, Bollinger Bands.
- Bottom: reverse-chronological cards of all reflections for this ticker, tinted by realized alpha sign.

### 4.7 Settings (`/settings`)

- Provider health row: ping each configured provider via `/api/providers/health`, show red/green dot.
- Default provider, deep/quick model dropdowns, thinking-effort selector.
- Per-data-category vendor selector (`data_vendors` from `default_config.py`).
- Global knobs: debate rounds, risk rounds, temperature, checkpoint toggle, memory log path.

## 5. Architecture

### 5.1 Layers

```
┌──────────────────────────────────────────────┐
│  Next.js 15 (App Router) + RSC               │
│  - TypeScript / Tailwind / shadcn/ui         │
│  - TanStack Query (server state)             │
│  - Zustand (per-run UI state)                │
│  - lightweight-charts (K-line) + Recharts    │
│  - Framer Motion (pipeline animations)       │
└────────────┬─────────────────────────────────┘
             │  REST + SSE
┌────────────▼─────────────────────────────────┐
│  FastAPI bridge (Python)                     │
│  - POST  /api/runs                           │
│  - GET   /api/runs/{id}/stream  (SSE)        │
│  - GET   /api/runs                           │
│  - GET   /api/runs/{id}                      │
│  - POST  /api/runs/{id}/cancel               │
│  - GET   /api/config  / PUT /api/config      │
│  - GET   /api/markets/{ticker}               │
│  - GET   /api/providers/health               │
│  - POST  /api/runs/{id}/reflect              │
└────────────┬─────────────────────────────────┘
             │  in-process import
┌────────────▼─────────────────────────────────┐
│  TradingAgentsGraph.stream(...)              │
│  TradingMemoryLog.load_entries()             │
│  dataflows.* (yfinance / stockstats / …)     │
└──────────────────────────────────────────────┘
```

### 5.2 Repo Layout (additions)

```
TradingAgents/
├── tradingagents/        (unchanged)
├── cli/                  (unchanged)
├── webapp/               ← new
│   ├── backend/
│   │   ├── main.py            FastAPI app factory
│   │   ├── routes/            runs / config / markets / memory / providers
│   │   ├── streaming.py       SSE adapter around graph.stream
│   │   ├── run_registry.py    in-memory + on-disk run state
│   │   ├── schemas.py         Pydantic DTOs
│   │   └── tests/
│   └── frontend/
│       ├── app/               App Router routes
│       ├── components/        ui (shadcn) + features (PipelineStepper, DebateBubbles, RunCard, …)
│       ├── lib/               api client, sse hook, formatters
│       ├── stores/            Zustand slices (run, metrics, debates)
│       └── tests/
└── scripts/
    └── web.sh                 one-shot launcher (uvicorn + next dev)
```

### 5.3 SSE Event Envelope

```ts
type Event = {
  id: number;            // monotonic, for Last-Event-ID resume
  type: EventType;
  runId: string;
  ts: string;            // ISO
  payload: unknown;
};

type EventType =
  | "run.started"
  | "agent.state"       // {agent, status}
  | "agent.token"       // {agent, delta}
  | "agent.report"      // {field, markdown}
  | "tool.call"         // {agent, tool, args, resultPreview}
  | "debate.message"    // {side, round, text}
  | "metrics.tick"      // {llmCalls, tools, tokensIn, tokensOut, elapsed}
  | "run.done"          // {finalState, decision, durationMs}
  | "run.error";        // {message, stack}
```

The frontend dispatches by `type` into the corresponding Zustand slice. The backend translates `graph.stream(stream_mode="values")` chunks into these events by diffing successive `AgentState` snapshots.

## 6. Data Flow

- **Start**: POST `/api/runs` → backend allocates `runId` (uuid), launches `graph.stream(...)` in a background task, exposes the event queue under `runId`, returns immediately.
- **Subscribe**: GET `/api/runs/{runId}/stream` (SSE) consumes the queue. Multiple browser tabs can fan-out on the same run.
- **Resume**: every event has `id`; client sends `Last-Event-ID` on reconnect; backend keeps a ring buffer of the most recent 200 events.
- **Replay**: after a run completes, the full event sequence is appended to `~/.tradingagents/cache/runs/{runId}.jsonl`. GET `/api/runs/{runId}` replays the file with `replay: true` markers.
- **History**: GET `/api/runs` calls `TradingMemoryLog.load_entries()`; server-side filters by ticker / date / rating / pending.
- **Markets**: GET `/api/markets/{ticker}?range=6mo` invokes `yfinance` + `stockstats_utils` and caches in process for 5 minutes.
- **Reflection backfill**: POST `/api/runs/{id}/reflect` triggers `_resolve_pending_entries` for one entry on demand.

## 7. Error Handling & Edge Cases

- **Missing API key**: `/api/providers/health` probes on startup; Settings shows red/green; the wizard disables submission when the chosen provider is red.
- **Mid-run crash**: emit `run.error`, free the registry slot. Frontend shows an error card and, if `checkpoint_enabled`, offers a "Resume from last checkpoint" button.
- **Concurrency**: a process-wide semaphore caps simultaneous runs at 2 (tunable). New runs queue with `"Queued (#N)"` status.
- **Data-source rate limits**: Reddit / Alpha Vantage failures degrade to an inline notice ("sentiment data unavailable for this window") instead of failing the run.
- **Large streaming markdown**: throttle `setState` to once per 50 ms; render with `react-markdown` + memoization; virtualize the longest reports.

## 8. Testing Strategy

| Layer              | Tooling                    | Focus                                                                                       |
|--------------------|----------------------------|---------------------------------------------------------------------------------------------|
| Backend unit       | pytest                     | SSE adapter event translation; memory log parser                                            |
| Backend integration| pytest + httpx + AsyncClient | End-to-end with a stubbed graph: assert event sequence and final state                    |
| Frontend unit      | Vitest + Testing Library    | Zustand reducers; PipelineStepper state machine; SSE hook reconnect path                   |
| Frontend E2E       | Playwright                  | Wizard flow → live run via mock SSE → all panels render; reconnection; replay scrubber     |
| Visual regression  | Playwright screenshot       | Dashboard, RunDetail, Compare pages                                                         |

A fixture jsonl recorded from one real run feeds the mock SSE server so E2E does not burn tokens.

## 9. Open Questions

None at design time; flagged here in case they surface during planning:

- Whether `Run Detail` should additionally expose a raw "events" tab (developer mode). Initial answer: no, keep noise out; add later if requested.
- Auth: out of scope for v1 (local-only).

## 10. Out of Scope (v1)

- Auth / multi-user.
- Mobile layout (responsive but desktop-first).
- Real broker integrations.
- Real-time intraday updates after a run starts (we lock the analysis date at submit time).
