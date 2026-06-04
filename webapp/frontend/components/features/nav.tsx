"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { clsx } from "clsx";

const LINKS = [
  { href: "/", label: "Dashboard" },
  { href: "/runs", label: "Runs" },
  { href: "/runs/new", label: "New" },
  { href: "/compare", label: "Compare" },
  { href: "/settings", label: "Settings" },
];

export function Nav() {
  const path = usePathname();
  return (
    <nav className="border-b border-zinc-200 bg-white px-6 py-3 dark:border-zinc-800 dark:bg-zinc-900">
      <ul className="flex items-center gap-4 text-sm">
        <li className="font-semibold">TradingAgents</li>
        {LINKS.map((l) => (
          <li key={l.href}>
            <Link
              href={l.href}
              className={clsx("text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100", path === l.href && "text-zinc-900 dark:text-zinc-100")}
            >
              {l.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
