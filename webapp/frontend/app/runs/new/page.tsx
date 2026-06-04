"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { api } from "@/lib/api";
import type { ProviderHealth, RunRequest } from "@/lib/types";

const ANALYSTS = [
  { id: "market", label: "Market" },
  { id: "social", label: "Sentiment" },
  { id: "news", label: "News" },
  { id: "fundamentals", label: "Fundamentals" },
] as const;

const LANGUAGES = [
  { value: "English", label: "English" },
  { value: "Chinese", label: "Chinese (中文)" },
  { value: "Japanese", label: "Japanese (日本語)" },
];

export default function NewRun() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [providers, setProviders] = useState<ProviderHealth[]>([]);
  const [form, setForm] = useState<RunRequest>({
    ticker: "AAPL",
    trade_date: new Date().toISOString().slice(0, 10),
    analysts: ["market", "social", "news", "fundamentals"],
    llm_provider: "openai",
    max_debate_rounds: 1,
    max_risk_discuss_rounds: 1,
    output_language: "English",
  });
  const [customLang, setCustomLang] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [cfg, ph] = await Promise.all([api.config(), api.providers()]);
        if (!alive) return;
        setProviders(ph.providers);
        setForm((f) => ({
          ...f,
          llm_provider: (cfg.llm_provider as string) ?? f.llm_provider,
          deep_think_llm: (cfg.deep_think_llm as string) ?? f.deep_think_llm,
          quick_think_llm: (cfg.quick_think_llm as string) ?? f.quick_think_llm,
          temperature: cfg.temperature as number | undefined,
          backend_url: (cfg.backend_url as string | null) ?? null,
          output_language: (cfg.output_language as string) ?? "English",
        }));
      } catch {
        // fall through to hardcoded defaults
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const selectedProvider = useMemo(
    () => providers.find((p) => p.id === form.llm_provider),
    [providers, form.llm_provider],
  );

  async function submit() {
    setSubmitting(true);
    setError(null);
    try {
      const payload: RunRequest = {
        ...form,
        output_language:
          form.output_language === "__custom__" ? customLang || "English" : form.output_language,
        backend_url: form.backend_url ? form.backend_url.replace(/\/+$/, "") : null,
      };
      const { run_id } = await api.createRun(payload);
      router.push(`/runs/${run_id}`);
    } catch (e) {
      setError((e as Error).message);
      setSubmitting(false);
    }
  }

  return (
    <main className="mx-auto max-w-3xl p-8">
      <h1 className="mb-6 text-2xl font-semibold">New Analysis</h1>
      <div className="mb-6 flex gap-2">
        {[1, 2, 3, 4].map((n) => (
          <div
            key={n}
            className={`h-1 flex-1 rounded ${n <= step ? "bg-zinc-100" : "bg-zinc-800"}`}
          />
        ))}
      </div>

      {step === 1 && (
        <div className="space-y-4">
          <Field label="Ticker">
            <input
              value={form.ticker}
              onChange={(e) => setForm({ ...form, ticker: e.target.value })}
              className="w-full rounded border border-zinc-700 bg-zinc-950 px-3 py-2"
            />
          </Field>
          <Field label="Trade date">
            <input
              type="date"
              value={form.trade_date}
              onChange={(e) => setForm({ ...form, trade_date: e.target.value })}
              className="w-full rounded border border-zinc-700 bg-zinc-950 px-3 py-2"
            />
          </Field>
        </div>
      )}

      {step === 2 && (
        <div className="grid grid-cols-2 gap-3">
          {ANALYSTS.map((a) => {
            const on = form.analysts!.includes(a.id);
            return (
              <button
                key={a.id}
                type="button"
                onClick={() =>
                  setForm({
                    ...form,
                    analysts: on
                      ? form.analysts!.filter((x) => x !== a.id)
                      : [...form.analysts!, a.id],
                  })
                }
                className={`rounded-md border p-4 text-left ${
                  on ? "border-zinc-100 bg-zinc-900" : "border-zinc-800"
                }`}
              >
                <div className="font-medium">{a.label}</div>
              </button>
            );
          })}
        </div>
      )}

      {step === 3 && (
        <div className="space-y-4">
          <Field label="LLM provider">
            <select
              value={form.llm_provider}
              onChange={(e) => setForm({ ...form, llm_provider: e.target.value })}
              className="w-full rounded border border-zinc-700 bg-zinc-950 px-3 py-2"
            >
              {providers.map((p) => (
                <option key={p.id} value={p.id} disabled={!p.configured}>
                  {p.label}
                  {!p.configured ? " (missing key)" : ""}
                </option>
              ))}
            </select>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Deep think model (optional)">
              <input
                value={form.deep_think_llm ?? ""}
                placeholder={selectedProvider?.default_deep_model ?? ""}
                onChange={(e) =>
                  setForm({ ...form, deep_think_llm: e.target.value || undefined })
                }
                className="w-full rounded border border-zinc-700 bg-zinc-950 px-3 py-2"
              />
            </Field>
            <Field label="Quick think model (optional)">
              <input
                value={form.quick_think_llm ?? ""}
                placeholder={selectedProvider?.default_quick_model ?? ""}
                onChange={(e) =>
                  setForm({ ...form, quick_think_llm: e.target.value || undefined })
                }
                className="w-full rounded border border-zinc-700 bg-zinc-950 px-3 py-2"
              />
            </Field>
          </div>
          <Field label="API base URL (optional)">
            <input
              type="url"
              value={form.backend_url ?? ""}
              placeholder={selectedProvider?.default_base_url ?? "https://..."}
              onChange={(e) =>
                setForm({ ...form, backend_url: e.target.value || null })
              }
              className="w-full rounded border border-zinc-700 bg-zinc-950 px-3 py-2"
            />
          </Field>
        </div>
      )}

      {step === 4 && (
        <div className="space-y-4">
          <Field label={`Debate rounds: ${form.max_debate_rounds}`}>
            <input
              type="range"
              min={1}
              max={5}
              value={form.max_debate_rounds}
              onChange={(e) =>
                setForm({ ...form, max_debate_rounds: Number(e.target.value) })
              }
              className="w-full"
            />
          </Field>
          <Field label={`Risk debate rounds: ${form.max_risk_discuss_rounds}`}>
            <input
              type="range"
              min={1}
              max={5}
              value={form.max_risk_discuss_rounds}
              onChange={(e) =>
                setForm({ ...form, max_risk_discuss_rounds: Number(e.target.value) })
              }
              className="w-full"
            />
          </Field>
          <Field label="Output language (what the agents write in)">
            <select
              value={
                LANGUAGES.find((l) => l.value === form.output_language)
                  ? form.output_language
                  : "__custom__"
              }
              onChange={(e) => {
                const v = e.target.value;
                if (v === "__custom__") {
                  setCustomLang(form.output_language ?? "");
                  setForm({ ...form, output_language: "__custom__" });
                } else {
                  setForm({ ...form, output_language: v });
                }
              }}
              className="w-full rounded border border-zinc-700 bg-zinc-950 px-3 py-2"
            >
              {LANGUAGES.map((l) => (
                <option key={l.value} value={l.value}>
                  {l.label}
                </option>
              ))}
              <option value="__custom__">Custom…</option>
            </select>
          </Field>
          {form.output_language === "__custom__" && (
            <Field label="Custom language name">
              <input
                value={customLang}
                onChange={(e) => setCustomLang(e.target.value)}
                placeholder="e.g. Korean"
                className="w-full rounded border border-zinc-700 bg-zinc-950 px-3 py-2"
              />
            </Field>
          )}
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.checkpoint_enabled}
              onChange={(e) =>
                setForm({ ...form, checkpoint_enabled: e.target.checked })
              }
            />
            Enable checkpoint resume
          </label>
        </div>
      )}

      <div className="mt-8 flex items-center justify-between">
        <button
          type="button"
          onClick={() => setStep((s) => Math.max(1, s - 1))}
          disabled={step === 1}
          className="rounded border border-zinc-700 px-4 py-2 text-sm disabled:opacity-50"
        >
          Back
        </button>
        {step < 4 ? (
          <button
            type="button"
            onClick={() => setStep((s) => s + 1)}
            className="rounded bg-zinc-100 px-4 py-2 text-sm font-medium text-zinc-900"
          >
            Next
          </button>
        ) : (
          <button
            type="button"
            onClick={submit}
            disabled={submitting}
            className="rounded bg-emerald-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {submitting ? "Starting…" : "Start analysis"}
          </button>
        )}
      </div>
      {error && <div className="mt-4 text-sm text-red-500">{error}</div>}
    </main>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium">{label}</span>
      {children}
    </label>
  );
}
