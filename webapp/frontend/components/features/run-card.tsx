"use client";

import Link from "next/link";

import { pct, ratingColor } from "@/lib/format";
import type { MemoryEntry } from "@/lib/types";

export function RunCard({ entry }: { entry: MemoryEntry }) {
  return (
    <Link
      href={`/markets/${entry.ticker}`}
      className="flex items-center justify-between rounded-md border border-zinc-200 bg-white px-4 py-3 text-sm transition hover:border-zinc-300 dark:border-zinc-800 dark:bg-zinc-900"
    >
      <div>
        <div className="font-semibold">{entry.ticker}</div>
        <div className="text-xs text-zinc-500">{entry.date}</div>
      </div>
      <div className={`font-medium ${ratingColor(entry.rating)}`}>{entry.rating}</div>
      <div className="w-20 text-right text-xs text-zinc-500">α {pct(entry.alpha)}</div>
    </Link>
  );
}
