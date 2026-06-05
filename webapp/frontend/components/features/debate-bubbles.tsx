"use client";

import { clsx } from "clsx";
import { useTranslations } from "next-intl";

import type { DebateMsg } from "@/stores/run-store";

interface Props {
  sides: { side: string; messages: DebateMsg[]; tone?: "bull" | "bear" | "neutral" }[];
}

const TONE_BG: Record<string, string> = {
  bull: "bg-emerald-50 dark:bg-emerald-900/30",
  bear: "bg-red-50 dark:bg-red-900/30",
  neutral: "bg-zinc-100 dark:bg-zinc-800",
};

export function DebateBubbles({ sides }: Props) {
  const t = useTranslations("runDetail");
  return (
    <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${sides.length}, minmax(0,1fr))` }}>
      {sides.map((s) => (
        <div key={s.side} className="space-y-2">
          <h4 className="font-medium">{t(`debate.side.${s.side}`)}</h4>
          {s.messages.map((m, i) => (
            <div
              key={`${s.side}-${i}`}
              className={clsx("rounded-md p-3 text-sm shadow-sm", TONE_BG[s.tone ?? s.side] ?? TONE_BG.neutral)}
            >
              <div className="mb-1 text-xs text-zinc-500">{t("debate.round", { n: m.round })}</div>
              {m.text}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
