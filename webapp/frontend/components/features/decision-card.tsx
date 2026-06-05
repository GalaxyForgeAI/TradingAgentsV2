"use client";

import { useTranslations } from "next-intl";

import { ratingColor } from "@/lib/format";

interface Props {
  decision: string;
  rating?: string | null;
  durationMs: number;
}

export function DecisionCard({ decision, rating, durationMs }: Props) {
  const t = useTranslations("runDetail.decision");
  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <div className="text-xs uppercase tracking-wider text-zinc-500">{t("finalLabel")}</div>
      <div className={`mt-1 text-3xl font-semibold ${ratingColor(rating)}`}>{rating ?? "—"}</div>
      <pre className="mt-4 whitespace-pre-wrap text-sm text-zinc-700 dark:text-zinc-300">{decision}</pre>
      <div className="mt-4 text-xs text-zinc-500">{t("tookSeconds", { s: (durationMs / 1000).toFixed(1) })}</div>
    </div>
  );
}
