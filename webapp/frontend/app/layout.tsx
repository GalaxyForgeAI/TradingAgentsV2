import "./globals.css";

import type { ReactNode } from "react";

import { Nav } from "@/components/features/nav";

export const metadata = { title: "TradingAgents Workbench" };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-zinc-50 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
        <Nav />
        {children}
      </body>
    </html>
  );
}
