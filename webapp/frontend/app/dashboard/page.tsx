import { ArrowUpRight, Clock3, ListChecks, TrendingUp } from "lucide-react";
import { getTranslations } from "next-intl/server";
import Link from "next/link";
import type { ReactNode } from "react";

import { RunCard } from "@/components/features/run-card";
import { api } from "@/lib/api";
import { pct } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function Dashboard() {
  const t = await getTranslations("dashboard");
  const { entries } = await api.history();
  const pending = entries.filter((e) => e.pending).length;
  const alphas = entries.map((e) => e.alpha).filter((x): x is number => x != null);
  const avgAlpha = alphas.length ? alphas.reduce((a, b) => a + b, 0) / alphas.length : null;

  return (
    <main className="mx-auto max-w-6xl space-y-10 p-8">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">{t("title")}</h1>
          <p className="mt-1 text-sm text-zinc-400">{t("subtitle")}</p>
        </div>
        <Link
          href="/runs/new"
          className="group inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white shadow-lg shadow-blue-600/20 transition hover:bg-blue-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
        >
          {t("newAnalysis")}
          <ArrowUpRight className="h-4 w-4 transition group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
        </Link>
      </header>

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label={t("stat.runs")} value={entries.length.toString()} icon={<ListChecks className="h-4 w-4" />} />
        <Stat label={t("stat.alpha")} value={pct(avgAlpha)} icon={<TrendingUp className="h-4 w-4" />} accent={avgAlpha != null && avgAlpha < 0 ? "down" : "up"} />
        <Stat label={t("stat.pending")} value={pending.toString()} icon={<Clock3 className="h-4 w-4" />} />
        <Stat label={t("stat.lastRun")} value={entries[0]?.date ?? "—"} icon={<Clock3 className="h-4 w-4" />} />
      </section>

      <section>
        <h2 className="mb-4 text-lg font-medium">{t("recentRuns")}</h2>
        <div className="space-y-2">
          {entries.slice(0, 10).map((e) => (
            <RunCard key={`${e.date}-${e.ticker}`} entry={e} />
          ))}
          {entries.length === 0 && (
            <div className="rounded-xl border border-dashed border-zinc-800 bg-zinc-900/40 p-10 text-center">
              <p className="text-sm text-zinc-400">{t("emptyTitle")}</p>
              <Link href="/runs/new" className="mt-3 inline-block text-sm font-medium text-blue-400 hover:text-blue-300">
                {t("emptyLink")}
              </Link>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}

function Stat({
  label,
  value,
  icon,
  accent,
}: {
  label: string;
  value: string;
  icon: ReactNode;
  accent?: "up" | "down";
}) {
  const accentColor = accent === "down" ? "text-red-400" : accent === "up" ? "text-emerald-400" : "text-zinc-100";
  return (
    <div className="group rounded-xl border border-zinc-800 bg-zinc-900/60 p-4 transition hover:border-zinc-700 hover:bg-zinc-900">
      <div className="flex items-center justify-between text-zinc-500">
        <span className="text-xs uppercase tracking-wide">{label}</span>
        <span className="text-zinc-600 transition group-hover:text-blue-400">{icon}</span>
      </div>
      <div className={`mt-2 text-2xl font-semibold tabular-nums ${accentColor}`}>{value}</div>
    </div>
  );
}
