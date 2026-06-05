"use client";

import { useTranslations } from "next-intl";
import { useEffect, useMemo, useState } from "react";

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

const LANGUAGES = [
  { value: "English", label: "English" },
  { value: "Chinese", label: "Chinese (中文)" },
  { value: "Japanese", label: "Japanese (日本語)" },
];

const CUSTOM = "__custom__";

export default function Settings() {
  const t = useTranslations("settings");
  const tc = useTranslations("common");
  const [providers, setProviders] = useState<ProviderHealth[]>([]);
  const [apiKeysSet, setApiKeysSet] = useState<string[]>([]);
  const [form, setForm] = useState<Record<SafeKey, string>>({
    llm_provider: "openai",
    deep_think_llm: "",
    quick_think_llm: "",
    backend_url: "",
    temperature: "",
    output_language: "English",
  });
  const [customLang, setCustomLang] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [err, setErr] = useState<string | null>(null);

  async function refresh() {
    const [{ providers }, cfg] = await Promise.all([api.providers(), api.config()]);
    setProviders(providers);
    setApiKeysSet((cfg.api_keys_set as string[]) ?? []);
    const lang = (cfg.output_language as string) ?? "English";
    const known = LANGUAGES.some((l) => l.value === lang);
    setForm({
      llm_provider: (cfg.llm_provider as string) ?? "openai",
      deep_think_llm: (cfg.deep_think_llm as string) ?? "",
      quick_think_llm: (cfg.quick_think_llm as string) ?? "",
      backend_url: (cfg.backend_url as string) ?? "",
      temperature: cfg.temperature == null ? "" : String(cfg.temperature),
      output_language: known ? lang : CUSTOM,
    });
    if (!known) setCustomLang(lang);
  }

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        await refresh();
      } catch {
        /* leave defaults */
      }
      if (!alive) return;
    })();
    return () => {
      alive = false;
    };
  }, []);

  const selectedHasKey = useMemo(() => {
    const p = providers.find((x) => x.id === form.llm_provider);
    return apiKeysSet.includes(form.llm_provider) || Boolean(p?.configured);
  }, [providers, apiKeysSet, form.llm_provider]);

  async function save() {
    setStatus("saving");
    setErr(null);
    const updates: Record<string, unknown> = {
      llm_provider: form.llm_provider,
      deep_think_llm: form.deep_think_llm || null,
      quick_think_llm: form.quick_think_llm || null,
      backend_url: form.backend_url ? form.backend_url.replace(/\/+$/, "") : null,
      temperature: form.temperature === "" ? null : Number(form.temperature),
      output_language:
        form.output_language === CUSTOM ? customLang || "English" : form.output_language,
    };
    // Only send a key when the user typed one; the value never round-trips
    // back from the server, so a blank field means "keep the existing key".
    if (apiKey.trim()) {
      updates.api_keys = { [form.llm_provider]: apiKey.trim() };
    }
    try {
      await api.putConfig(updates);
      setApiKey("");
      await refresh();
      setStatus("saved");
      setTimeout(() => setStatus("idle"), 1500);
    } catch (e) {
      setStatus("error");
      setErr((e as Error).message);
    }
  }

  return (
    <main className="mx-auto max-w-3xl space-y-8 p-8">
      <h1 className="text-2xl font-semibold">{t("title")}</h1>

      <section>
        <h2 className="mb-3 text-lg font-medium">{t("providers")}</h2>
        <ul className="space-y-1 text-sm">
          {providers.map((p) => (
            <li
              key={p.id}
              className="flex items-center justify-between rounded border border-zinc-800 px-3 py-2"
            >
              <span>{p.label}</span>
              <span className={p.configured ? "text-emerald-500" : "text-zinc-500"}>
                {p.configured ? tc("configured") : tc("missingKey")}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-medium">{t("defaults")}</h2>
        <p className="text-xs text-zinc-500">{t("defaultsHelp")}</p>

        <FormRow label={t("field.provider")}>
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

        <FormRow label={t("field.apiKey")}>
          <input
            type="password"
            autoComplete="off"
            value={apiKey}
            placeholder={selectedHasKey ? "•••••••• " + tc("configured") : "sk-…"}
            onChange={(e) => setApiKey(e.target.value)}
            className="w-full rounded border border-zinc-700 bg-zinc-950 px-3 py-2"
          />
          {selectedHasKey && (
            <span className="mt-1 block text-xs text-zinc-500">{t("apiKeyStoredHint")}</span>
          )}
        </FormRow>

        <div className="grid grid-cols-2 gap-3">
          <FormRow label={t("field.deepModel")}>
            <input
              value={form.deep_think_llm}
              onChange={(e) => setForm({ ...form, deep_think_llm: e.target.value })}
              className="w-full rounded border border-zinc-700 bg-zinc-950 px-3 py-2"
            />
          </FormRow>
          <FormRow label={t("field.quickModel")}>
            <input
              value={form.quick_think_llm}
              onChange={(e) => setForm({ ...form, quick_think_llm: e.target.value })}
              className="w-full rounded border border-zinc-700 bg-zinc-950 px-3 py-2"
            />
          </FormRow>
        </div>

        <FormRow label={t("field.baseUrl")}>
          <input
            type="url"
            value={form.backend_url}
            placeholder="https://…"
            onChange={(e) => setForm({ ...form, backend_url: e.target.value })}
            className="w-full rounded border border-zinc-700 bg-zinc-950 px-3 py-2"
          />
        </FormRow>

        <FormRow label={t("field.temperature")}>
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

        <FormRow label={t("field.outputLanguage")}>
          <select
            value={form.output_language}
            onChange={(e) => setForm({ ...form, output_language: e.target.value })}
            className="w-full rounded border border-zinc-700 bg-zinc-950 px-3 py-2"
          >
            {LANGUAGES.map((l) => (
              <option key={l.value} value={l.value}>
                {l.label}
              </option>
            ))}
            <option value={CUSTOM}>{t("languageCustom")}</option>
          </select>
        </FormRow>
        {form.output_language === CUSTOM && (
          <FormRow label={t("field.customLanguage")}>
            <input
              value={customLang}
              onChange={(e) => setCustomLang(e.target.value)}
              placeholder="e.g. Korean"
              className="w-full rounded border border-zinc-700 bg-zinc-950 px-3 py-2"
            />
          </FormRow>
        )}

        <div className="flex items-center gap-3 pt-2">
          <button
            type="button"
            onClick={save}
            disabled={status === "saving"}
            className="rounded bg-emerald-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {status === "saving" ? tc("saving") : t("saveDefaults")}
          </button>
          {status === "saved" && <span className="text-sm text-emerald-500">{`${tc("saved")} ✓`}</span>}
          {status === "error" && <span className="text-sm text-red-500">{`${t("errorPrefix")}${err}`}</span>}
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
