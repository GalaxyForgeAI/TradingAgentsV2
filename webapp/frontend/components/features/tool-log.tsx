"use client";

import type { AgentName } from "@/lib/types";

interface Item { agent: AgentName; tool: string; preview?: string | null }

export function ToolLog({ items }: { items: Item[] }) {
  if (items.length === 0) return <div className="text-sm text-zinc-500">No tool calls yet</div>;
  return (
    <ul className="space-y-1 text-sm">
      {items.slice(-30).map((it, i) => (
        <li key={i} className="rounded border border-zinc-200 bg-white px-2 py-1 dark:border-zinc-800 dark:bg-zinc-900">
          <span className="font-mono text-xs text-zinc-500">{it.agent}</span>{" "}
          <span className="font-mono text-xs">{it.tool}</span>
          {it.preview && <div className="truncate text-xs text-zinc-500">{it.preview}</div>}
        </li>
      ))}
    </ul>
  );
}
