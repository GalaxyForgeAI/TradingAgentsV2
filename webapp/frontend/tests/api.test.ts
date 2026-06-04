import { describe, expect, it, vi } from "vitest";

import { api } from "../lib/api";

describe("api client", () => {
  it("posts a run request and returns the run id", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ run_id: "abc" }), { status: 201 }),
    );
    const result = await api.createRun({ ticker: "AAPL", trade_date: "2026-01-15" });
    expect(result.run_id).toBe("abc");
    expect(fetchMock).toHaveBeenCalledWith("/api/runs", expect.objectContaining({ method: "POST" }));
  });

  it("throws on non-2xx", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("nope", { status: 500 }));
    await expect(api.config()).rejects.toThrow(/500/);
  });
});
