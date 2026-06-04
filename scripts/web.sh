#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

uvicorn webapp.backend.main:app --reload --port 8000 &
BACKEND_PID=$!
trap 'kill "$BACKEND_PID" 2>/dev/null || true' EXIT

(cd webapp/frontend && npm run dev)
