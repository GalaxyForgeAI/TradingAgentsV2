import type { MarketBar, MemoryEntry, ProviderHealth, RunRequest } from "./types";

const base = "";

async function json<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(base + path, {
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
  providers: () => json<{ providers: ProviderHealth[] }>("/api/providers/health"),
  market: (ticker: string, range = "6mo") =>
    json<{ ticker: string; bars: MarketBar[] }>(`/api/markets/${encodeURIComponent(ticker)}?range=${range}`),
};
