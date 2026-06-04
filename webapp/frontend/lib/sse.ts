"use client";

import { useEffect, useRef, useState } from "react";

import type { EventEnvelope, EventType } from "./types";

const EVENT_TYPES: EventType[] = [
  "run.started",
  "agent.state",
  "agent.report",
  "tool.call",
  "debate.message",
  "metrics.tick",
  "run.done",
  "run.error",
];

export function useEventStream(url: string | null) {
  const [events, setEvents] = useState<EventEnvelope[]>([]);
  const [lastEventId, setLastEventId] = useState<number | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const ref = useRef<EventSource | null>(null);

  useEffect(() => {
    if (!url) return;
    const es = new EventSource(url);
    ref.current = es;

    const handler = (ev: MessageEvent) => {
      try {
        const data = JSON.parse(ev.data) as EventEnvelope;
        setEvents((prev) => [...prev, data]);
        setLastEventId(data.id);
      } catch (e) {
        setError(e as Error);
      }
    };

    EVENT_TYPES.forEach((t) => es.addEventListener(t, handler as EventListener));
    es.onerror = () => setError(new Error("SSE connection error"));

    return () => {
      EVENT_TYPES.forEach((t) => es.removeEventListener(t, handler as EventListener));
      es.close();
    };
  }, [url]);

  return { events, lastEventId, error, close: () => ref.current?.close() };
}
