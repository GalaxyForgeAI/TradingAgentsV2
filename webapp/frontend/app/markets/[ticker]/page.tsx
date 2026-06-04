import { PriceChart } from "@/components/features/price-chart";
import { api } from "@/lib/api";
import { pct, ratingColor } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function MarketPage({ params }: { params: Promise<{ ticker: string }> }) {
  const { ticker } = await params;
  const [{ bars }, { entries }] = await Promise.all([
    api.market(ticker, "6mo"),
    api.history({ ticker }),
  ]);

  return (
    <main className="mx-auto max-w-6xl space-y-6 p-8">
      <h1 className="text-2xl font-semibold">{ticker}</h1>
      <PriceChart bars={bars} />
      <section>
        <h2 className="mb-3 text-lg font-medium">Decision history</h2>
        <ul className="space-y-2">
          {entries.map((e) => (
            <li key={e.date} className="rounded-md border border-zinc-200 bg-white p-3 text-sm dark:border-zinc-800 dark:bg-zinc-900">
              <div className="flex items-center justify-between">
                <div>{e.date}</div>
                <div className={ratingColor(e.rating)}>{e.rating}</div>
                <div className="text-xs text-zinc-500">α {pct(e.alpha)}</div>
              </div>
              <p className="mt-2 text-zinc-600 dark:text-zinc-400">{e.reflection || "Pending reflection"}</p>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
