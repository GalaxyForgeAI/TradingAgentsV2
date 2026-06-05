# TradingAgents Web Workbench

> **English** | [中文](./README.zh-CN.md)

A browser-based workbench for the TradingAgents multi-agent trading framework. It
wraps the existing `TradingAgentsGraph` engine with a live-streaming UI: launch an
analysis, watch every agent (analysts → researchers → trader → risk → portfolio
manager) work in real time, browse past decisions, and view per-ticker charts.

The CLI (`tradingagents` / `python -m cli.main`) is unchanged and still available.
The workbench is an additional front end on top of the same engine.

```
┌─ Next.js 15 frontend (port 3000) ─┐   REST + SSE   ┌─ FastAPI backend (port 8000) ─┐
│ Dashboard / Run wizard / Run view │ ─────────────► │ wraps TradingAgentsGraph.stream │
│ History / Markets / Settings      │ ◄───────────── │ reads the decision log + yfinance│
└───────────────────────────────────┘                └──────────────────────────────────┘
```

## Prerequisites

- Python 3.10+ with the project installed: `pip install -e .` (from the repo root).
  This pulls in `fastapi`, `uvicorn`, `sse-starlette`, and `httpx`.
- Node.js 18.18+ (or 20+) and npm, for the frontend.
- At least one LLM provider API key exported in your environment (see the main
  [README](../README.md#required-apis)), e.g. `export OPENAI_API_KEY=...`. Without a
  key the UI still renders, but starting an analysis will fail.

## Quick start

From the repo root:

```bash
# 1. Install the frontend (first time only)
cd webapp/frontend
npm install --legacy-peer-deps   # Next 15.0.3 declares an older React peer range
cd ../..

# 2. Launch both servers
./scripts/web.sh
```

`scripts/web.sh` starts the FastAPI backend on **:8000** and the Next.js dev server
on **:3000**, and shuts the backend down when you stop the frontend (Ctrl-C).

Then open **http://localhost:3000**.

### Running the two servers manually

```bash
# Terminal 1 — backend
uvicorn webapp.backend.main:app --reload --port 8000

# Terminal 2 — frontend
cd webapp/frontend && npm run dev
```

The frontend proxies `/api/*` to the backend via a rewrite in `next.config.mjs`, so
browser requests need no extra config.

## Pages

| Route | What it does |
|-------|--------------|
| `/` | Dashboard: run count, average alpha vs benchmark, pending reflections, and the 10 most recent runs. |
| `/runs/new` | 4-step wizard: ticker & date → analyst selection → LLM provider & models → debate rounds / temperature / checkpoint. Submitting starts a run and redirects to its live view. |
| `/runs/[runId]` | Live run view. Left: agent pipeline (click any node to inspect it). Center: the selected agent's report markdown, debate bubbles (bull/bear, risk trio), or the final BUY/SELL/HOLD decision card. Right: live metrics and the tool-call log. Streams over SSE; after completion the same page replays the captured events. |
| `/runs` | History table of all past runs read from the decision log (date, ticker, rating, raw return, alpha, reflection excerpt). |
| `/markets/[ticker]` | Candlestick chart (6-month OHLC from Yahoo Finance) plus this ticker's decision/reflection history. |
| `/compare` | Placeholder for multi-run comparison (see Known limitations). |
| `/settings` | Provider health (which API keys are configured) and the effective default config. |

The workbench ships in English and Simplified Chinese. The nav has an `EN / 中` switcher; selection persists in a cookie. The agent **output** language (what the analysts write in) is independent of the UI language and is set per run in the wizard's Step 4.

## HTTP API

The backend is a small FastAPI app (`webapp/backend/main.py`). All endpoints are
under `/api`.

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/api/health` | Liveness check → `{"status":"ok"}`. |
| `POST` | `/api/runs` | Start an analysis. Body is a `RunRequest` (ticker, trade_date, analysts, llm_provider, models, debate rounds, temperature, checkpoint_enabled, output_language). Returns `{"run_id": "..."}`. |
| `GET` | `/api/runs/{run_id}/stream` | Server-Sent Events stream of the run. Event types: `run.started`, `agent.state`, `agent.report`, `tool.call`, `debate.message`, `metrics.tick`, `run.done`, `run.error`. |
| `POST` | `/api/runs/{run_id}/cancel` | Cancel an in-flight run. |
| `GET` | `/api/runs?source=memory` | Read the decision log. Optional `ticker` and `pending_only` filters. |
| `GET` | `/api/config` | Whitelisted keys from `DEFAULT_CONFIG`. |
| `PUT` | `/api/config` | Persist workbench user defaults (whitelisted keys only). Unknown keys return 422. |
| `GET` | `/api/providers/health` | Per-provider API-key configuration status. |
| `GET` | `/api/markets/{ticker}?range=6mo` | OHLC bars from Yahoo Finance. |

### SSE event envelope

Every event is `{ id, type, run_id, ts, payload }`. `id` is monotonic per run; the
backend keeps a 200-event ring buffer for replay. The set of `type` values is listed
above; see `webapp/backend/schemas.py` for payload shapes.

## Configuration / environment variables

| Variable | Used by | Default | Purpose |
|----------|---------|---------|---------|
| `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, … | engine | — | LLM provider keys (see main README). Surfaced on `/settings`. |
| `WORKBENCH_CORS_ORIGINS` | backend | `http://localhost:3000` | Comma-separated allowed origins for CORS. |
| `BACKEND_INTERNAL_URL` | frontend (server) | `http://localhost:8000` | Absolute backend URL used by server components during SSR. Set this if the backend is not on localhost:8000. |
| `TRADINGAGENTS_MEMORY_LOG_PATH` | engine + history route | `~/.tradingagents/memory/trading_memory.md` | Location of the decision log the History/Markets pages read. |
| `TRADINGAGENTS_CACHE_DIR` | engine + workbench | `~/.tradingagents` | Base path; the workbench writes user defaults under `webapp/config.json` here. |

All other engine knobs (`TRADINGAGENTS_*`, model selection, debate rounds, data
vendors, etc.) are documented in the main [README](../README.md) and
`tradingagents/default_config.py`.

## Adding a new LLM provider

The provider list (used by both the engine and the web backend) is a single
YAML file: `tradingagents/llm_clients/providers.yaml`. Adding an
OpenAI-compatible provider is six lines of YAML and zero code change:

```yaml
- id: my-provider
  label: My Provider
  env_key: MY_PROVIDER_API_KEY
  openai_compatible: true
  default_base_url: https://api.my-provider.com/v1
```

Restart the backend (and the frontend dev server if it's running) and the new
provider appears in `/settings` and in the New Analysis wizard. Heterogeneous
clients (Anthropic / Google / Azure) require `openai_compatible: false` and
a `client:` field; see existing entries.

## Concurrency & runs

The backend caps simultaneous analyses with a semaphore (default 2). Each run gets a
UUID and an in-memory event queue; multiple browser tabs can subscribe to the same
run's SSE stream concurrently (fan-out).

## Testing

```bash
# Backend (from repo root)
python -m pytest webapp/backend -q

# Frontend (from webapp/frontend)
npm test          # vitest unit tests
npm run build     # production build / type check
```

## Layout

```
webapp/
├── backend/                FastAPI service
│   ├── main.py             app factory + router registration + CORS
│   ├── schemas.py          pydantic DTOs (RunRequest, EventEnvelope, …)
│   ├── run_registry.py     in-memory pub/sub with ring buffer + fan-out
│   ├── streaming.py        AgentState chunk → SSE event translation
│   ├── graph_runner.py     async wrapper around TradingAgentsGraph.stream
│   ├── routes/             runs (+SSE) / memory / config / providers / markets
│   └── tests/              pytest suite
└── frontend/               Next.js 15 (App Router)
    ├── app/                routes (see Pages table)
    ├── components/features/ PipelineStepper, DebateBubbles, DecisionCard, …
    ├── lib/                api client, SSE hook, shared types, formatters
    ├── stores/             Zustand run store (pure event reducer)
    └── tests/              vitest tests
```

## Known limitations

- **Reconnect replay**: the live stream works, but resuming a stream after a dropped
  connection does not yet replay missed events (the browser's native `EventSource`
  does not send `Last-Event-Id` for named events). Tracked as a follow-up.
- **Compare page**: multi-run comparison UI is a placeholder.
- **Scope**: local single-user tool. No authentication, desktop-first layout.

## Disclaimer

TradingAgents is a research framework. It is **not** financial, investment, or
trading advice. See <https://tauric.ai/disclaimer/>.
