import { renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { useEventStream } from "../lib/sse";

class FakeES {
  static instances: FakeES[] = [];
  listeners = new Map<string, ((ev: MessageEvent) => void)[]>();
  url: string;
  closed = false;
  constructor(url: string) {
    this.url = url;
    FakeES.instances.push(this);
  }
  addEventListener(type: string, cb: (ev: MessageEvent) => void) {
    const list = this.listeners.get(type) ?? [];
    list.push(cb);
    this.listeners.set(type, list);
  }
  removeEventListener() {}
  close() {
    this.closed = true;
  }
  emit(type: string, data: unknown, id?: string) {
    const ev = new MessageEvent(type, { data: JSON.stringify(data), lastEventId: id ?? "" });
    (this.listeners.get(type) ?? []).forEach((cb) => cb(ev));
    (this.listeners.get("message") ?? []).forEach((cb) => cb(ev));
  }
}

describe("useEventStream", () => {
  it("collects events and exposes the latest event id", async () => {
    vi.stubGlobal("EventSource", FakeES as unknown as typeof EventSource);
    const { result } = renderHook(() => useEventStream("/api/runs/r1/stream"));

    const es = FakeES.instances.at(-1)!;
    es.emit("run.started", { id: 1, type: "run.started", run_id: "r1", payload: {} }, "1");
    es.emit("agent.state", { id: 2, type: "agent.state", run_id: "r1", payload: { agent: "market_analyst", status: "running" } }, "2");

    await waitFor(() => expect(result.current.events.length).toBe(2));
    expect(result.current.lastEventId).toBe(2);
  });
});
