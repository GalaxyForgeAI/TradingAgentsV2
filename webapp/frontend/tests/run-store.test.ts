import { describe, expect, it } from "vitest";

import { applyEvent, initialRunState } from "../stores/run-store";

describe("run store reducer", () => {
  it("marks an agent as running and then done when reports arrive", () => {
    let s = initialRunState();
    s = applyEvent(s, { id: 1, type: "run.started", run_id: "r1", ts: "", payload: { ticker: "AAPL", trade_date: "2026-01-15" } });
    s = applyEvent(s, { id: 2, type: "agent.state", run_id: "r1", ts: "", payload: { agent: "market_analyst", status: "running" } });
    s = applyEvent(s, { id: 3, type: "agent.report", run_id: "r1", ts: "", payload: { field: "market_report", markdown: "# x" } });
    s = applyEvent(s, { id: 4, type: "agent.state", run_id: "r1", ts: "", payload: { agent: "market_analyst", status: "done" } });

    expect(s.ticker).toBe("AAPL");
    expect(s.agents.market_analyst.status).toBe("done");
    expect(s.reports.market_report).toBe("# x");
  });

  it("accumulates debate messages by side", () => {
    let s = initialRunState();
    s = applyEvent(s, { id: 1, type: "debate.message", run_id: "r1", ts: "", payload: { side: "bull", round: 1, text: "buy" } });
    s = applyEvent(s, { id: 2, type: "debate.message", run_id: "r1", ts: "", payload: { side: "bear", round: 1, text: "sell" } });
    expect(s.debates.investment.bull).toHaveLength(1);
    expect(s.debates.investment.bear[0].text).toBe("sell");
  });

  it("captures final decision on run.done", () => {
    let s = initialRunState();
    s = applyEvent(s, { id: 1, type: "run.done", run_id: "r1", ts: "", payload: { decision: "BUY", duration_ms: 12345 } });
    expect(s.decision).toBe("BUY");
    expect(s.durationMs).toBe(12345);
    expect(s.status).toBe("done");
  });
});
