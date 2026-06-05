"use client";

import { CheckCircle2, Circle, Loader2, XCircle } from "lucide-react";
import { clsx } from "clsx";
import { useTranslations } from "next-intl";

import type { AgentName, AgentStatus } from "@/lib/types";

const AGENT_ORDER: { id: AgentName; group: string }[] = [
  { id: "market_analyst", group: "Analysts" },
  { id: "social_analyst", group: "Analysts" },
  { id: "news_analyst", group: "Analysts" },
  { id: "fundamentals_analyst", group: "Analysts" },
  { id: "bull_researcher", group: "Research" },
  { id: "bear_researcher", group: "Research" },
  { id: "research_manager", group: "Research" },
  { id: "trader", group: "Trade" },
  { id: "aggressive_analyst", group: "Risk" },
  { id: "conservative_analyst", group: "Risk" },
  { id: "neutral_analyst", group: "Risk" },
  { id: "portfolio_manager", group: "Decision" },
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
  const t = useTranslations("runDetail");
  let currentGroup = "";
  return (
    <ol className="space-y-1">
      {AGENT_ORDER.map((a) => {
        const showGroup = a.group !== currentGroup;
        currentGroup = a.group;
        return (
          <li key={a.id}>
            {showGroup && (
              <div className="mt-3 text-xs uppercase tracking-wide text-zinc-500">{t(`group.${a.group}`)}</div>
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
              <span>{t(`agent.${a.id}`)}</span>
            </button>
          </li>
        );
      })}
    </ol>
  );
}
