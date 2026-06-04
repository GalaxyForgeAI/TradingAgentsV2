"use client";

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
  return (
    <div className="grid grid-cols-2 gap-2">
      <Metric label="LLM calls" value={p.llmCalls} />
      <Metric label="Tool calls" value={p.tools} />
      <Metric label="Tokens ↑" value={p.tokensIn.toLocaleString()} />
      <Metric label="Tokens ↓" value={p.tokensOut.toLocaleString()} />
      <Metric label="Elapsed" value={elapsed(p.elapsedMs)} />
    </div>
  );
}
