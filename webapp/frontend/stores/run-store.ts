"use client";

import { create } from "zustand";

import type { AgentName, AgentStatus, EventEnvelope } from "@/lib/types";

export interface DebateMsg { side: string; round: number; text: string }

export interface RunState {
  status: "idle" | "running" | "done" | "error";
  ticker: string;
  tradeDate: string;
  agents: Record<AgentName, { status: AgentStatus }>;
  reports: Record<string, string>;
  toolCalls: { agent: AgentName; tool: string; preview?: string | null }[];
  metrics: { llmCalls: number; tools: number; tokensIn: number; tokensOut: number; elapsedMs: number };
  debates: {
    investment: { bull: DebateMsg[]; bear: DebateMsg[] };
    risk: { aggressive: DebateMsg[]; conservative: DebateMsg[]; neutral: DebateMsg[] };
  };
  decision: string;
  durationMs: number;
  errorMessage?: string;
}

const ALL_AGENTS: AgentName[] = [
  "market_analyst", "social_analyst", "news_analyst", "fundamentals_analyst",
  "bull_researcher", "bear_researcher", "research_manager", "trader",
  "aggressive_analyst", "conservative_analyst", "neutral_analyst", "portfolio_manager",
];

export function initialRunState(): RunState {
  const agents = {} as RunState["agents"];
  ALL_AGENTS.forEach((a) => (agents[a] = { status: "pending" }));
  return {
    status: "idle",
    ticker: "",
    tradeDate: "",
    agents,
    reports: {},
    toolCalls: [],
    metrics: { llmCalls: 0, tools: 0, tokensIn: 0, tokensOut: 0, elapsedMs: 0 },
    debates: { investment: { bull: [], bear: [] }, risk: { aggressive: [], conservative: [], neutral: [] } },
    decision: "",
    durationMs: 0,
  };
}

export function applyEvent(state: RunState, evt: EventEnvelope): RunState {
  switch (evt.type) {
    case "run.started": {
      const p = evt.payload as { ticker?: string; trade_date?: string };
      return { ...state, status: "running", ticker: p.ticker ?? "", tradeDate: p.trade_date ?? "" };
    }
    case "agent.state": {
      const p = evt.payload as { agent: AgentName; status: AgentStatus };
      return { ...state, agents: { ...state.agents, [p.agent]: { status: p.status } } };
    }
    case "agent.report": {
      const p = evt.payload as { field: string; markdown: string };
      return { ...state, reports: { ...state.reports, [p.field]: p.markdown } };
    }
    case "tool.call": {
      const p = evt.payload as { agent: AgentName; tool: string; result_preview?: string | null };
      return {
        ...state,
        toolCalls: [...state.toolCalls, { agent: p.agent, tool: p.tool, preview: p.result_preview }],
        metrics: { ...state.metrics, tools: state.metrics.tools + 1 },
      };
    }
    case "debate.message": {
      const p = evt.payload as unknown as DebateMsg & { side: string };
      const inv = state.debates.investment;
      const risk = state.debates.risk;
      if (p.side === "bull" || p.side === "bear") {
        return {
          ...state,
          debates: { investment: { ...inv, [p.side]: [...inv[p.side], p] }, risk },
        };
      }
      if (p.side === "aggressive" || p.side === "conservative" || p.side === "neutral") {
        return {
          ...state,
          debates: { investment: inv, risk: { ...risk, [p.side]: [...risk[p.side], p] } },
        };
      }
      return state;
    }
    case "metrics.tick": {
      const p = evt.payload as Partial<RunState["metrics"]> & { llm_calls?: number; tokens_in?: number; tokens_out?: number; elapsed_ms?: number };
      return {
        ...state,
        metrics: {
          llmCalls: p.llm_calls ?? state.metrics.llmCalls,
          tools: state.metrics.tools,
          tokensIn: p.tokens_in ?? state.metrics.tokensIn,
          tokensOut: p.tokens_out ?? state.metrics.tokensOut,
          elapsedMs: p.elapsed_ms ?? state.metrics.elapsedMs,
        },
      };
    }
    case "run.done": {
      const p = evt.payload as { decision: string; duration_ms: number };
      return { ...state, status: "done", decision: p.decision, durationMs: p.duration_ms };
    }
    case "run.error": {
      const p = evt.payload as { message: string };
      return { ...state, status: "error", errorMessage: p.message };
    }
    default:
      return state;
  }
}

export const useRunStore = create<{
  byId: Record<string, RunState>;
  ingest: (runId: string, evt: EventEnvelope) => void;
  reset: (runId: string) => void;
}>((set) => ({
  byId: {},
  ingest: (runId, evt) =>
    set((s) => {
      const current = s.byId[runId] ?? initialRunState();
      return { byId: { ...s.byId, [runId]: applyEvent(current, evt) } };
    }),
  reset: (runId) =>
    set((s) => ({ byId: { ...s.byId, [runId]: initialRunState() } })),
}));
