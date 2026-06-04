export type AgentName =
  | "market_analyst" | "social_analyst" | "news_analyst" | "fundamentals_analyst"
  | "bull_researcher" | "bear_researcher" | "research_manager" | "trader"
  | "aggressive_analyst" | "conservative_analyst" | "neutral_analyst" | "portfolio_manager";

export type AgentStatus = "pending" | "running" | "done" | "error";

export type EventType =
  | "run.started" | "agent.state" | "agent.report"
  | "tool.call" | "debate.message" | "metrics.tick"
  | "run.done" | "run.error";

export interface EventEnvelope<P = Record<string, unknown>> {
  id: number;
  type: EventType;
  run_id: string;
  ts: string;
  payload: P;
}

export interface RunRequest {
  ticker: string;
  trade_date: string;
  analysts?: ("market" | "social" | "news" | "fundamentals")[];
  llm_provider?: string;
  deep_think_llm?: string;
  quick_think_llm?: string;
  max_debate_rounds?: number;
  max_risk_discuss_rounds?: number;
  temperature?: number;
  checkpoint_enabled?: boolean;
  output_language?: string;
}

export interface MemoryEntry {
  date: string;
  ticker: string;
  rating: string;
  raw_return: number | null;
  alpha: number | null;
  holding: string | null;
  decision: string;
  reflection: string;
  pending: boolean;
}

export interface MarketBar {
  t: string;
  o: number;
  h: number;
  l: number;
  c: number;
  v: number;
}

export interface ProviderHealth {
  id: string;
  label: string;
  env_key: string;
  configured: boolean;
}
