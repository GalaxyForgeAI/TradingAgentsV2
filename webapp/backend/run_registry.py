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
            if state.completed:
                return
            state.completed = True
            for q in state.subscribers:
                await q.put(None)  # type: ignore[arg-type]

    async def subscribe(
        self, run_id: str, last_event_id: int | None
    ) -> AsyncIterator[EventEnvelope]:
        state = self.get(run_id)
        queue: asyncio.Queue[EventEnvelope] = asyncio.Queue()

        async with self._lock:
            backlog = [e for e in state.buffer if last_event_id is None or e.id > last_event_id]
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
