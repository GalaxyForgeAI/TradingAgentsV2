import type { MarketBar, MemoryEntry, ProviderHealth, RunRequest } from "./types";

// On the browser, use relative paths so Next.js rewrites proxy /api/* to the
// backend. On the server (RSC/SSR) there is no origin to resolve a relative
// URL against, so hit the backend directly via an absolute base URL.
function apiBase(): string {
  if (typeof window !== "undefined") return "";
  return process.env.BACKEND_INTERNAL_URL ?? "http://localhost:8000";
}

async function json<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(apiBase() + path, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  if (!res.ok) {
    throw new Error(`${res.status} ${res.statusText} on ${path}`);
  }
  return res.json() as Promise<T>;
}

export const api = {
  createRun: (req: RunRequest) => json<{ run_id: string }>("/api/runs", { method: "POST", body: JSON.stringify(req) }),
  cancelRun: (id: string) => json<{ cancelled: boolean }>(`/api/runs/${id}/cancel`, { method: "POST" }),
  history: (params: { ticker?: string; pending_only?: boolean } = {}) => {
    const qs = new URLSearchParams({ source: "memory" });
    if (params.ticker) qs.set("ticker", params.ticker);
    if (params.pending_only) qs.set("pending_only", "true");
    return json<{ entries: MemoryEntry[] }>(`/api/runs?${qs.toString()}`);
  },
  config: () => json<Record<string, unknown>>("/api/config"),
  putConfig: (updates: Record<string, unknown>) =>
    json<Record<string, unknown>>("/api/config", { method: "PUT", body: JSON.stringify(updates) }),
  providers: () => json<{ providers: ProviderHealth[] }>("/api/providers/health"),
  testProvider: (body: { provider: string; model?: string; backend_url?: string }) =>
    json<{ ok: boolean; message: string; latency_ms: number }>("/api/providers/test", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  market: (ticker: string, range = "6mo") =>
    json<{ ticker: string; bars: MarketBar[] }>(`/api/markets/${encodeURIComponent(ticker)}?range=${range}`),
};
