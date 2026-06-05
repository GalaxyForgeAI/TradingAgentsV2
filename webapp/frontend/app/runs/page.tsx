import { getTranslations } from "next-intl/server";

import { api } from "@/lib/api";
import { pct, ratingColor } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function RunsPage() {
  const t = await getTranslations("history");
  const { entries } = await api.history();
  return (
    <main className="mx-auto max-w-6xl p-8">
      <h1 className="mb-6 text-2xl font-semibold">{t("title")}</h1>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-zinc-200 text-left text-xs uppercase text-zinc-500 dark:border-zinc-800">
            <th className="py-2">{t("col.date")}</th>
            <th>{t("col.ticker")}</th>
            <th>{t("col.rating")}</th>
            <th>{t("col.raw")}</th>
            <th>{t("col.alpha")}</th>
            <th>{t("col.reflection")}</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((e) => (
            <tr key={`${e.date}-${e.ticker}`} className="border-b border-zinc-100 dark:border-zinc-900">
              <td className="py-2">{e.date}</td>
              <td className="font-medium">{e.ticker}</td>
              <td className={ratingColor(e.rating)}>{e.rating}</td>
              <td>{pct(e.raw_return)}</td>
              <td>{pct(e.alpha)}</td>
              <td className="truncate text-zinc-500">{e.reflection?.slice(0, 120) || (e.pending ? t("pending") : "—")}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}
