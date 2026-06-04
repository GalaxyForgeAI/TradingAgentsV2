"use client";

import { clsx } from "clsx";
import { useRouter } from "next/navigation";
import { useLocale } from "next-intl";

import { LOCALES, type Locale } from "@/i18n/locales";

const LABEL: Record<Locale, string> = { en: "EN", zh: "中" };

export function LanguageSwitcher() {
  const current = useLocale() as Locale;
  const router = useRouter();

  function set(next: Locale) {
    if (next === current) return;
    document.cookie = `NEXT_LOCALE=${next}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;
    router.refresh();
  }

  return (
    <div
      role="group"
      aria-label="Language"
      className="ml-auto flex items-center rounded-md border border-zinc-800 text-xs"
    >
      {LOCALES.map((l) => (
        <button
          key={l}
          type="button"
          onClick={() => set(l)}
          aria-pressed={l === current}
          className={clsx(
            "px-2 py-1 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400",
            l === current
              ? "bg-zinc-100 text-zinc-900"
              : "text-zinc-400 hover:text-zinc-100",
          )}
        >
          {LABEL[l]}
        </button>
      ))}
    </div>
  );
}
