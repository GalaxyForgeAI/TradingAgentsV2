"use client";

import { useTranslations } from "next-intl";

export default function ComparePage() {
  const t = useTranslations("compare");
  return (
    <main className="mx-auto max-w-6xl p-8">
      <h1 className="mb-4 text-2xl font-semibold">{t("title")}</h1>
      <p className="text-sm text-zinc-500">
        {t("instructionsPart1")}
        <code>{t("instructionsCode")}</code>
        {t("instructionsPart2")}
      </p>
    </main>
  );
}
