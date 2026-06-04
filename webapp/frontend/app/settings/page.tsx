"use client";

import { useEffect, useState } from "react";

import { api } from "@/lib/api";
import type { ProviderHealth } from "@/lib/types";

const SAFE_KEYS = [
  "llm_provider",
  "deep_think_llm",
  "quick_think_llm",
  "backend_url",
  "temperature",
  "output_language",
] as const;

type SafeKey = (typeof SAFE_KEYS)[number];

export default function Settings() {
  const [providers, setProviders] = useState<ProviderHealth[]>([]);
  const [form, setForm] = useState<Record<SafeKey, string>>({
    llm_provider: "openai",
    deep_think_llm: "",
    quick_think_llm: "",
    backend_url: "",
    temperature: "",
    output_language: "English",
  });
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      const [{ providers }, cfg] = await Promise.all([api.providers(), api.config()]);
      if (!alive) return;
      setProviders(providers);
      setForm({
        llm_provider: (cfg.llm_provider as string) ?? "openai",
        deep_think_llm: (cfg.deep_think_llm as string) ?? "",
        quick_think_llm: (cfg.quick_think_llm as string) ?? "",
        backend_url: (cfg.backend_url as string) ?? "",
        temperature: cfg.temperature == null ? "" : String(cfg.temperature),
        output_language: (cfg.output_language as string) ?? "English",
      });
    })();
    return () => {
      alive = false;
    };
  }, []);

  async function save() {
    setStatus("saving");
    setErr(null);
    const updates: Record<string, unknown> = {
      llm_provider: form.llm_provider,
      deep_think_llm: form.deep_think_llm || null,
      quick_think_llm: form.quick_think_llm || null,
      backend_url: form.backend_url ? form.backend_url.replace(/\/+$/, "") : null,
      temperature: form.temperature === "" ? null : Number(form.temperature),
      output_language: form.output_language,
    };
    try {
      await api.putConfig(updates);
      setStatus("saved");
      setTimeout(() => setStatus("idle"), 1500);
    } catch (e) {
      setStatus("error");
      setErr((e as Error).message);
    }
  }

  return (
    <main className="mx-auto max-w-3xl space-y-8 p-8">
      <h1 className="text-2xl font-semibold">Settings</h1>

      <section>
        <h2 className="mb-3 text-lg font-medium">Providers</h2>
        <ul className="space-y-1 text-sm">
          {providers.map((p) => (
            <li
              key={p.id}
              className="flex items-center justify-between rounded border border-zinc-800 px-3 py-2"
            >
              <span>{p.label}</span>
              <span className={p.configured ? "text-emerald-500" : "text-zinc-500"}>
                {p.configured ? "Configured" : "Missing key"}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-medium">Workbench defaults</h2>
        <p className="text-xs text-zinc-500">
          These prefill the New Analysis wizard. The wizard can still override them per run.
        </p>
        <FormRow label="LLM provider">
          <select
            value={form.llm_provider}
            onChange={(e) => setForm({ ...form, llm_provider: e.target.value })}
            className="w-full rounded border border-zinc-700 bg-zinc-950 px-3 py-2"
          >
            {providers.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>
        </FormRow>
        <div className="grid grid-cols-2 gap-3">
          <FormRow label="Deep think model">
            <input
              value={form.deep_think_llm}
              onChange={(e) => setForm({ ...form, deep_think_llm: e.target.value })}
              className="w-full rounded border border-zinc-700 bg-zinc-950 px-3 py-2"
            />
          </FormRow>
          <FormRow label="Quick think model">
            <input
              value={form.quick_think_llm}
              onChange={(e) => setForm({ ...form, quick_think_llm: e.target.value })}
              className="w-full rounded border border-zinc-700 bg-zinc-950 px-3 py-2"
            />
          </FormRow>
        </div>
        <FormRow label="API base URL">
          <input
            type="url"
            value={form.backend_url}
            placeholder="https://…"
            onChange={(e) => setForm({ ...form, backend_url: e.target.value })}
            className="w-full rounded border border-zinc-700 bg-zinc-950 px-3 py-2"
          />
        </FormRow>
        <FormRow label="Temperature">
          <input
            type="number"
            step={0.05}
            min={0}
            max={2}
            value={form.temperature}
            onChange={(e) => setForm({ ...form, temperature: e.target.value })}
            className="w-full rounded border border-zinc-700 bg-zinc-950 px-3 py-2"
          />
        </FormRow>
        <FormRow label="Output language (agent reports)">
          <input
            value={form.output_language}
            onChange={(e) => setForm({ ...form, output_language: e.target.value })}
            className="w-full rounded border border-zinc-700 bg-zinc-950 px-3 py-2"
          />
        </FormRow>
        <div className="flex items-center gap-3 pt-2">
          <button
            type="button"
            onClick={save}
            disabled={status === "saving"}
            className="rounded bg-emerald-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {status === "saving" ? "Saving…" : "Save defaults"}
          </button>
          {status === "saved" && <span className="text-sm text-emerald-500">Saved ✓</span>}
          {status === "error" && <span className="text-sm text-red-500">Error: {err}</span>}
        </div>
      </section>
    </main>
  );
}

function FormRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium">{label}</span>
      {children}
    </label>
  );
}
