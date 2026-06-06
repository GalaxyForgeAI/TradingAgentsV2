"use client";

import { use, useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";

import { DebateBubbles } from "@/components/features/debate-bubbles";
import { DecisionCard } from "@/components/features/decision-card";
import { Markdown } from "@/components/features/markdown";
import { MetricsPanel } from "@/components/features/metrics-panel";
import { PipelineStepper } from "@/components/features/pipeline-stepper";
import { ToolLog } from "@/components/features/tool-log";
import { useEventStream } from "@/lib/sse";
import type { AgentName } from "@/lib/types";
import { applyEvent, initialRunState, type RunState } from "@/stores/run-store";

const REPORT_FIELD: Partial<Record<AgentName, string>> = {
  market_analyst: "market_report",
  social_analyst: "sentiment_report",
  news_analyst: "news_report",
  fundamentals_analyst: "fundamentals_report",
  research_manager: "investment_plan",
  trader: "trader_investment_plan",
  portfolio_manager: "final_trade_decision",
};

export default function RunDetail({ params }: { params: Promise<{ runId: string }> }) {
  const t = useTranslations("runDetail");
  const { runId } = use(params);
  const { events, error: streamError } = useEventStream(`/api/runs/${runId}/stream`);
  const [state, setState] = useState<RunState>(initialRunState());
  const [selected, setSelected] = useState<AgentName | null>("market_analyst");
  const [cursor, setCursor] = useState(0);

  // Distinguish three pre-event states so the page never silently looks
  // "idle" while it's actually broken or warming up:
  //   1. streamError + no events  → connection refused / 404 / CORS
  //   2. no streamError + no events → still connecting / waiting on backend
  //   3. events flowing → real status from applyEvent takes over
  const connectionState: "connecting" | "broken" | "live" =
    events.length > 0 ? "live" : streamError ? "broken" : "connecting";

  useEffect(() => {
    if (events.length <= cursor) return;
    let next = state;
    for (let i = cursor; i < events.length; i++) next = applyEvent(next, events[i]);
    setState(next);
    setCursor(events.length);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [events, cursor]);

  const centerView = useMemo(() => {
    if (!selected) return null;
    if (selected === "bull_researcher" || selected === "bear_researcher" || selected === "research_manager") {
      return (
        <DebateBubbles
          sides={[
            { side: "bull", messages: state.debates.investment.bull, tone: "bull" },
            { side: "bear", messages: state.debates.investment.bear, tone: "bear" },
          ]}
        />
      );
    }
    if (selected === "aggressive_analyst" || selected === "conservative_analyst" || selected === "neutral_analyst") {
      return (
        <DebateBubbles
          sides={[
            { side: "aggressive", messages: state.debates.risk.aggressive, tone: "bull" },
            { side: "conservative", messages: state.debates.risk.conservative, tone: "bear" },
            { side: "neutral", messages: state.debates.risk.neutral, tone: "neutral" },
          ]}
        />
      );
    }
    if (selected === "portfolio_manager") {
      const decision = state.decision || state.reports.final_trade_decision;
      // Without a real decision, an empty DecisionCard reads as "completed
      // with no result" (renders "—" + "Run took 0.0s"). Show the same
      // waiting placeholder the analyst panes use until the decision lands.
      if (!decision) return <p className="text-sm text-zinc-500">{t("waiting")}</p>;
      return (
        <DecisionCard
          decision={decision}
          rating={state.decision?.match(/BUY|SELL|HOLD/)?.[0] ?? null}
          durationMs={state.durationMs}
        />
      );
    }
    const field = REPORT_FIELD[selected];
    const md = field ? state.reports[field] : undefined;
    return md ? <Markdown>{md}</Markdown> : <p className="text-sm text-zinc-500">{t("waiting")}</p>;
  }, [selected, state, t]);

  return (
    <main className="grid h-screen grid-cols-[260px_1fr_320px] gap-4 p-4">
      <aside className="overflow-y-auto rounded-lg border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900">
        <div className="mb-3 pt-1">
          <div className="text-xs uppercase leading-5 text-zinc-500">
            {state.ticker || "—"} · {state.tradeDate || "—"}
          </div>
          <div className="text-sm font-medium">
            {connectionState === "broken"
              ? t("connectionBroken")
              : connectionState === "connecting"
                ? t("connecting")
                : t("status", { state: state.status })}
          </div>
        </div>
        <PipelineStepper agents={state.agents} selected={selected} onSelect={setSelected} />
      </aside>

      <section className="overflow-y-auto rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
        {connectionState === "broken" && (
          <div
            role="alert"
            className="mb-4 rounded border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-300"
          >
            {t("streamError", { runId })}
          </div>
        )}
        {centerView}
      </section>

      <aside className="space-y-4 overflow-y-auto">
        <MetricsPanel
          llmCalls={state.metrics.llmCalls}
          tools={state.metrics.tools}
          tokensIn={state.metrics.tokensIn}
          tokensOut={state.metrics.tokensOut}
          elapsedMs={state.metrics.elapsedMs}
        />
        <div>
          <h3 className="mb-2 text-xs uppercase text-zinc-500">{t("toolLog.heading")}</h3>
          <ToolLog items={state.toolCalls} />
        </div>
        {state.status === "error" && (
          <div className="rounded border border-red-300 bg-red-50 p-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/30 dark:text-red-200">
            {state.errorMessage ?? t("errorTitleFallback")}
          </div>
        )}
      </aside>
    </main>
  );
}
