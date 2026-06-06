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

/** Resolve an EventSource URL, bypassing the Next.js dev rewrite proxy.
 *
 * Next.js dev `rewrites()` gzip-encode the proxied SSE response and buffer
 * chunks at gzip-frame boundaries, so `EventSource` (which always sends
 * `Accept-Encoding: gzip`) opens the connection but never receives a single
 * event — the run detail page would stay stuck on "waiting…" forever. Talk
 * to the backend directly instead. Backend CORS already whitelists
 * http://localhost:3000 (webapp/backend/main.py).
 *
 * Production deployments behind a real reverse proxy (nginx, traefik, etc.)
 * should set NEXT_PUBLIC_BACKEND_URL="" to fall back to same-origin paths;
 * those proxies stream SSE correctly.
 */
function sseUrl(path: string): string {
  if (typeof window === "undefined") return path; // SSR never opens EventSource
  const base = process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:8000";
  return base ? `${base}${path}` : path;
}

export function useEventStream(url: string | null) {
  const [events, setEvents] = useState<EventEnvelope[]>([]);
  const [lastEventId, setLastEventId] = useState<number | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const ref = useRef<EventSource | null>(null);

  useEffect(() => {
    if (!url) return;
    const es = new EventSource(sseUrl(url));
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
