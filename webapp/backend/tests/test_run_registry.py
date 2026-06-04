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


@pytest.mark.asyncio
async def test_complete_is_idempotent():
    reg = RunRegistry(ring_size=10)
    reg.create("r1")
    await reg.complete("r1")
    await reg.complete("r1")  # must not raise / not double-sentinel
    state = reg.get("r1")
    assert state.completed is True
