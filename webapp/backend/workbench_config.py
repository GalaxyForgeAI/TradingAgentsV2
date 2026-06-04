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
