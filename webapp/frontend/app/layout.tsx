import "./globals.css";

import type { Metadata } from "next";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages } from "next-intl/server";
import type { ReactNode } from "react";

import { Nav } from "@/components/features/nav";

export const metadata: Metadata = {
  title: "TradingAgents Workbench",
  description:
    "A trading firm of LLM agents — analysts, researchers, trader, and risk team that debate every trade, live in your browser.",
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  const locale = await getLocale();
  const messages = await getMessages();
  return (
    <html lang={locale} className="dark" suppressHydrationWarning>
      <body className="min-h-screen bg-zinc-950 text-zinc-100 antialiased" suppressHydrationWarning>
        <NextIntlClientProvider locale={locale} messages={messages}>
          <Nav />
          {children}
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
