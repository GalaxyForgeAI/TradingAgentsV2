from __future__ import annotations

import asyncio
import queue as _queue_mod
import threading
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
            chunk_q: _queue_mod.Queue = _queue_mod.Queue(maxsize=64)
            _DONE = object()

            def _producer():
                try:
                    graph = self._factory(request)
                    for chunk in graph.stream(request.ticker, request.trade_date):
                        chunk_q.put(chunk)
                except Exception as exc:  # noqa: BLE001
                    chunk_q.put(("__error__", exc, traceback.format_exc()))
                finally:
                    chunk_q.put(_DONE)

            loop = asyncio.get_running_loop()
            thread = threading.Thread(target=_producer, daemon=True)
            thread.start()

            errored = False
            try:
                while True:
                    item = await loop.run_in_executor(None, chunk_q.get)
                    if item is _DONE:
                        break
                    if isinstance(item, tuple) and len(item) == 3 and item[0] == "__error__":
                        errored = True
                        await self._registry.publish(run_id, adapter.error(str(item[1]), item[2]))
                        continue
                    for evt in adapter.translate(item):
                        await self._registry.publish(run_id, evt)

                if not errored:
                    final_decision = ""
                    for e in reversed(self._registry.get(run_id).buffer):
                        if e.payload.get("field") == "final_trade_decision":
                            final_decision = e.payload["markdown"]
                            break
                    await self._registry.publish(run_id, adapter.final(final_decision, None))
            finally:
                await self._registry.complete(run_id)
