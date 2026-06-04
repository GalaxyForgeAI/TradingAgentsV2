import Link from "next/link";

import { RunCard } from "@/components/features/run-card";
import { api } from "@/lib/api";
import { pct } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function Home() {
  const { entries } = await api.history();
  const pending = entries.filter((e) => e.pending).length;
  const alphas = entries.map((e) => e.alpha).filter((x): x is number => x != null);
  const avgAlpha = alphas.length ? alphas.reduce((a, b) => a + b, 0) / alphas.length : null;

  return (
    <main className="mx-auto max-w-6xl space-y-8 p-8">
      <header className="flex items-center justify-between">
        <h1 className="text-3xl font-semibold">Workbench</h1>
        <Link href="/runs/new" className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white dark:bg-zinc-100 dark:text-zinc-900">
          New Analysis
        </Link>
      </header>

      <section className="grid grid-cols-4 gap-3">
        <Stat label="Runs" value={entries.length.toString()} />
        <Stat label="Avg α vs benchmark" value={pct(avgAlpha)} />
        <Stat label="Pending reflections" value={pending.toString()} />
        <Stat label="Last run" value={entries[0]?.date ?? "—"} />
      </section>

      <section>
        <h2 className="mb-3 text-lg font-medium">Recent runs</h2>
        <div className="space-y-2">
          {entries.slice(0, 10).map((e) => (
            <RunCard key={`${e.date}-${e.ticker}`} entry={e} />
          ))}
          {entries.length === 0 && (
            <p className="text-sm text-zinc-500">No runs yet. Hit &quot;New Analysis&quot; to start.</p>
          )}
        </div>
      </section>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="text-xs uppercase tracking-wide text-zinc-500">{label}</div>
      <div className="mt-1 text-xl font-semibold">{value}</div>
    </div>
  );
}
