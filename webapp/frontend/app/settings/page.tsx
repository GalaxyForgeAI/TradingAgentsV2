import { api } from "@/lib/api";

export const dynamic = "force-dynamic";

export default async function Settings() {
  const [{ providers }, cfg] = await Promise.all([api.providers(), api.config()]);
  return (
    <main className="mx-auto max-w-3xl space-y-8 p-8">
      <h1 className="text-2xl font-semibold">Settings</h1>

      <section>
        <h2 className="mb-3 text-lg font-medium">Providers</h2>
        <ul className="space-y-1 text-sm">
          {providers.map((p) => (
            <li key={p.id} className="flex items-center justify-between rounded border border-zinc-200 px-3 py-2 dark:border-zinc-800">
              <span>{p.label}</span>
              <span className={p.configured ? "text-emerald-600" : "text-zinc-500"}>
                {p.configured ? "Configured" : "Missing key"}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-medium">Defaults</h2>
        <pre className="overflow-auto rounded bg-zinc-100 p-4 text-xs dark:bg-zinc-900">
{JSON.stringify(cfg, null, 2)}
        </pre>
      </section>
    </main>
  );
}
