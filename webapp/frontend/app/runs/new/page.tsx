"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { api } from "@/lib/api";
import type { RunRequest } from "@/lib/types";

const ANALYSTS = [
  { id: "market", label: "Market" },
  { id: "social", label: "Sentiment" },
  { id: "news", label: "News" },
  { id: "fundamentals", label: "Fundamentals" },
] as const;

export default function NewRun() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [form, setForm] = useState<RunRequest>({
    ticker: "AAPL",
    trade_date: new Date().toISOString().slice(0, 10),
    analysts: ["market", "social", "news", "fundamentals"],
    llm_provider: "openai",
    max_debate_rounds: 1,
    max_risk_discuss_rounds: 1,
    output_language: "English",
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setSubmitting(true);
    setError(null);
    try {
      const { run_id } = await api.createRun(form);
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
            className={`h-1 flex-1 rounded ${n <= step ? "bg-zinc-900 dark:bg-zinc-100" : "bg-zinc-200 dark:bg-zinc-800"}`}
          />
        ))}
      </div>

      {step === 1 && (
        <div className="space-y-4">
          <Field label="Ticker">
            <input
              value={form.ticker}
              onChange={(e) => setForm({ ...form, ticker: e.target.value })}
              className="w-full rounded border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-950"
            />
          </Field>
          <Field label="Trade date">
            <input
              type="date"
              value={form.trade_date}
              onChange={(e) => setForm({ ...form, trade_date: e.target.value })}
              className="w-full rounded border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-950"
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
                    analysts: on ? form.analysts!.filter((x) => x !== a.id) : [...form.analysts!, a.id],
                  })
                }
                className={`rounded-md border p-4 text-left ${on ? "border-zinc-900 bg-zinc-100 dark:border-zinc-100 dark:bg-zinc-900" : "border-zinc-200 dark:border-zinc-800"}`}
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
              className="w-full rounded border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-950"
            >
              {["openai", "anthropic", "google", "xai", "deepseek", "qwen", "qwen-cn", "glm", "glm-cn", "minimax", "minimax-cn", "openrouter", "ollama"].map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Deep think model (optional)">
              <input
                value={form.deep_think_llm ?? ""}
                onChange={(e) => setForm({ ...form, deep_think_llm: e.target.value || undefined })}
                className="w-full rounded border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-950"
              />
            </Field>
            <Field label="Quick think model (optional)">
              <input
                value={form.quick_think_llm ?? ""}
                onChange={(e) => setForm({ ...form, quick_think_llm: e.target.value || undefined })}
                className="w-full rounded border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-950"
              />
            </Field>
          </div>
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
              onChange={(e) => setForm({ ...form, max_debate_rounds: Number(e.target.value) })}
              className="w-full"
            />
          </Field>
          <Field label={`Risk debate rounds: ${form.max_risk_discuss_rounds}`}>
            <input
              type="range"
              min={1}
              max={5}
              value={form.max_risk_discuss_rounds}
              onChange={(e) => setForm({ ...form, max_risk_discuss_rounds: Number(e.target.value) })}
              className="w-full"
            />
          </Field>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.checkpoint_enabled}
              onChange={(e) => setForm({ ...form, checkpoint_enabled: e.target.checked })}
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
          className="rounded border border-zinc-300 px-4 py-2 text-sm disabled:opacity-50 dark:border-zinc-700"
        >
          Back
        </button>
        {step < 4 ? (
          <button
            type="button"
            onClick={() => setStep((s) => s + 1)}
            className="rounded bg-zinc-900 px-4 py-2 text-sm font-medium text-white dark:bg-zinc-100 dark:text-zinc-900"
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
      {error && <div className="mt-4 text-sm text-red-600">{error}</div>}
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
