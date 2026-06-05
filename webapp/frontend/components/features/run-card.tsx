"use client";

import Link from "next/link";
import { useLocale } from "next-intl";

import { fmtDate, pct, ratingColor } from "@/lib/format";
import type { MemoryEntry } from "@/lib/types";

export function RunCard({ entry }: { entry: MemoryEntry }) {
  const locale = useLocale();
  return (
    <Link
      href={`/markets/${entry.ticker}`}
      className="group flex items-center justify-between rounded-lg border border-zinc-800 bg-zinc-900/60 px-4 py-3 text-sm transition hover:border-blue-500/40 hover:bg-zinc-900 hover:shadow-lg hover:shadow-blue-950/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
    >
      <div>
        <div className="font-semibold tracking-tight transition group-hover:text-blue-300">{entry.ticker}</div>
        <div className="text-xs text-zinc-500">{fmtDate(entry.date, locale)}</div>
      </div>
      <div className={`font-medium ${ratingColor(entry.rating)}`}>{entry.rating}</div>
      <div className="w-20 text-right text-xs tabular-nums text-zinc-400">α {pct(entry.alpha, locale)}</div>
    </Link>
  );
}
