"use client";

import { CheckCircle2, Circle, Loader2, XCircle } from "lucide-react";
import { clsx } from "clsx";

import type { AgentName, AgentStatus } from "@/lib/types";

const AGENT_ORDER: { id: AgentName; label: string; group: string }[] = [
  { id: "market_analyst", label: "Market Analyst", group: "Analysts" },
  { id: "social_analyst", label: "Sentiment Analyst", group: "Analysts" },
  { id: "news_analyst", label: "News Analyst", group: "Analysts" },
  { id: "fundamentals_analyst", label: "Fundamentals Analyst", group: "Analysts" },
  { id: "bull_researcher", label: "Bull Researcher", group: "Research" },
  { id: "bear_researcher", label: "Bear Researcher", group: "Research" },
  { id: "research_manager", label: "Research Manager", group: "Research" },
  { id: "trader", label: "Trader", group: "Trade" },
  { id: "aggressive_analyst", label: "Aggressive Risk", group: "Risk" },
  { id: "conservative_analyst", label: "Conservative Risk", group: "Risk" },
  { id: "neutral_analyst", label: "Neutral Risk", group: "Risk" },
  { id: "portfolio_manager", label: "Portfolio Manager", group: "Decision" },
];

interface Props {
  agents: Record<AgentName, { status: AgentStatus }>;
  selected: AgentName | null;
  onSelect: (agent: AgentName) => void;
}

function StatusIcon({ status }: { status: AgentStatus }) {
  if (status === "done") return <CheckCircle2 className="h-4 w-4 text-emerald-500" />;
  if (status === "running") return <Loader2 className="h-4 w-4 animate-spin text-sky-500" />;
  if (status === "error") return <XCircle className="h-4 w-4 text-red-500" />;
  return <Circle className="h-4 w-4 text-zinc-400" />;
}

export function PipelineStepper({ agents, selected, onSelect }: Props) {
  let currentGroup = "";
  return (
    <ol className="space-y-1">
      {AGENT_ORDER.map((a) => {
        const showGroup = a.group !== currentGroup;
        currentGroup = a.group;
        return (
          <li key={a.id}>
            {showGroup && (
              <div className="mt-3 text-xs uppercase tracking-wide text-zinc-500">{a.group}</div>
            )}
            <button
              type="button"
              onClick={() => onSelect(a.id)}
              className={clsx(
                "flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm transition",
                selected === a.id ? "bg-zinc-200 dark:bg-zinc-800" : "hover:bg-zinc-100 dark:hover:bg-zinc-900",
              )}
            >
              <StatusIcon status={agents[a.id].status} />
              <span>{a.label}</span>
            </button>
          </li>
        );
      })}
    </ol>
  );
}
