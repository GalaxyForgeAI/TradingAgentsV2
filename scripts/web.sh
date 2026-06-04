#!/usr/bin/env bash
#
# Launch the TradingAgents Web Workbench: FastAPI backend on :8000 and the
# Next.js dev server on :3000. The backend is stopped automatically when the
# frontend exits (Ctrl-C). First-time setup: `cd webapp/frontend && npm install
# --legacy-peer-deps`. See webapp/README.md for full documentation.
#
set -euo pipefail

cd "$(dirname "$0")/.."

uvicorn webapp.backend.main:app --reload --port 8000 &
BACKEND_PID=$!
trap 'kill "$BACKEND_PID" 2>/dev/null || true' EXIT

(cd webapp/frontend && npm run dev)
