import { api } from "@/lib/api";
import { pct, ratingColor } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function RunsPage() {
  const { entries } = await api.history();
  return (
    <main className="mx-auto max-w-6xl p-8">
      <h1 className="mb-6 text-2xl font-semibold">All runs</h1>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-zinc-200 text-left text-xs uppercase text-zinc-500 dark:border-zinc-800">
            <th className="py-2">Date</th>
            <th>Ticker</th>
            <th>Rating</th>
            <th>Raw</th>
            <th>α</th>
            <th>Reflection</th>
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
              <td className="truncate text-zinc-500">{e.reflection?.slice(0, 120) || (e.pending ? "pending" : "—")}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}
