import "./globals.css";

import type { Metadata } from "next";
import type { ReactNode } from "react";

import { Nav } from "@/components/features/nav";

export const metadata: Metadata = {
  title: "TradingAgents Workbench",
  description:
    "A trading firm of LLM agents — analysts, researchers, trader, and risk team that debate every trade, live in your browser.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-zinc-950 text-zinc-100 antialiased">
        <Nav />
        {children}
      </body>
    </html>
  );
}
