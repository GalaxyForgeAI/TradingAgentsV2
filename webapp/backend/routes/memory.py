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
