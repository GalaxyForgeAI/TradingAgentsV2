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
