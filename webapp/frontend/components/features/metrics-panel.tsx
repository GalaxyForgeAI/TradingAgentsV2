"use client";

import { useTranslations } from "next-intl";

import { elapsed } from "@/lib/format";

interface Props {
  llmCalls: number;
  tools: number;
  tokensIn: number;
  tokensOut: number;
  elapsedMs: number;
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-md bg-zinc-100 p-3 dark:bg-zinc-900">
      <div className="text-xs text-zinc-500">{label}</div>
      <div className="text-lg font-semibold">{value}</div>
    </div>
  );
}

export function MetricsPanel(p: Props) {
  const t = useTranslations("runDetail.metrics");
  return (
    <div className="grid grid-cols-2 gap-2">
      <Metric label={t("llm")} value={p.llmCalls} />
      <Metric label={t("tools")} value={p.tools} />
      <Metric label={t("tokensIn")} value={p.tokensIn.toLocaleString()} />
      <Metric label={t("tokensOut")} value={p.tokensOut.toLocaleString()} />
      <Metric label={t("elapsed")} value={elapsed(p.elapsedMs)} />
    </div>
  );
}
