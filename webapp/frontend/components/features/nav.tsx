"use client";

import { clsx } from "clsx";
import { Activity } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/", label: "Home" },
  { href: "/dashboard", label: "Dashboard" },
  { href: "/runs", label: "Runs" },
  { href: "/runs/new", label: "New" },
  { href: "/compare", label: "Compare" },
  { href: "/settings", label: "Settings" },
];

function isActive(path: string, href: string): boolean {
  if (href === "/") return path === "/";
  return path === href || path.startsWith(`${href}/`);
}

export function Nav() {
  const path = usePathname();
  return (
    <nav className="sticky top-0 z-40 border-b border-zinc-800/80 bg-zinc-950/80 backdrop-blur supports-[backdrop-filter]:bg-zinc-950/60">
      <div className="mx-auto flex max-w-7xl items-center gap-1 px-4 py-3 sm:px-6">
        <Link href="/" className="mr-3 flex items-center gap-2 font-semibold tracking-tight">
          <span className="flex h-7 w-7 items-center justify-center rounded-md bg-blue-600/15 text-blue-400 ring-1 ring-blue-500/30">
            <Activity className="h-4 w-4" />
          </span>
          <span>
            Trading<span className="text-blue-400">Agents</span>
          </span>
        </Link>
        <ul className="flex items-center gap-0.5 overflow-x-auto text-sm">
          {LINKS.slice(1).map((l) => {
            const active = isActive(path, l.href);
            return (
              <li key={l.href}>
                <Link
                  href={l.href}
                  aria-current={active ? "page" : undefined}
                  className={clsx(
                    "relative rounded-md px-3 py-1.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400",
                    active ? "text-zinc-50" : "text-zinc-400 hover:text-zinc-100",
                  )}
                >
                  {l.label}
                  {active && (
                    <span className="absolute inset-x-2 -bottom-px h-px bg-gradient-to-r from-transparent via-blue-400 to-transparent" />
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </nav>
  );
}
