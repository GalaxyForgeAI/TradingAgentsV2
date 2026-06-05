"use client";

import { motion, useReducedMotion, type Variants } from "framer-motion";
import {
  ArrowRight,
  BarChart3,
  Brain,
  GitBranch,
  History,
  LineChart,
  Radio,
  Scale,
  Sparkles,
  Users,
} from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";

export default function Landing() {
  const reduce = useReducedMotion();
  const t = useTranslations("landing");

  const fadeUp: Variants = {
    hidden: { opacity: 0, y: reduce ? 0 : 18 },
    show: (i: number = 0) => ({
      opacity: 1,
      y: 0,
      transition: { duration: 0.5, delay: reduce ? 0 : i * 0.08, ease: [0.22, 1, 0.36, 1] },
    }),
  };

  const STATS = [
    { value: "12", labelKey: "agents" as const },
    { value: "4",  labelKey: "analystLenses" as const },
    { value: "13", labelKey: "providers" as const },
    { value: "∞", labelKey: "markets" as const },
  ];

  const STAGES = [
    { titleKey: "analystsTitle", bodyKey: "analystsBody", icon: <LineChart className="h-5 w-5" /> },
    { titleKey: "researchTitle", bodyKey: "researchBody", icon: <Users className="h-5 w-5" /> },
    { titleKey: "traderTitle",   bodyKey: "traderBody",   icon: <GitBranch className="h-5 w-5" /> },
    { titleKey: "riskTitle",     bodyKey: "riskBody",     icon: <Scale className="h-5 w-5" /> },
    { titleKey: "pmTitle",       bodyKey: "pmBody",       icon: <Brain className="h-5 w-5" /> },
  ];

  const FEATURES = [
    { titleKey: "streamingTitle", bodyKey: "streamingBody", icon: <Radio className="h-5 w-5" /> },
    { titleKey: "debateTitle",    bodyKey: "debateBody",    icon: <Users className="h-5 w-5" /> },
    { titleKey: "logTitle",       bodyKey: "logBody",       icon: <History className="h-5 w-5" /> },
    { titleKey: "chartsTitle",    bodyKey: "chartsBody",    icon: <BarChart3 className="h-5 w-5" /> },
    { titleKey: "modelsTitle",    bodyKey: "modelsBody",    icon: <Brain className="h-5 w-5" /> },
    { titleKey: "compareTitle",   bodyKey: "compareBody",   icon: <GitBranch className="h-5 w-5" /> },
  ];

  return (
    <div className="relative overflow-hidden">
      {/* ---------------------------------------------------------------- Hero */}
      <section className="relative">
        <div className="pointer-events-none absolute inset-0 bg-spotlight" aria-hidden />
        <div className="pointer-events-none absolute inset-0 bg-grid [mask-image:radial-gradient(70%_60%_at_50%_0%,black,transparent)]" aria-hidden />

        <div className="relative mx-auto max-w-5xl px-6 pb-20 pt-24 text-center sm:pt-32">
          <motion.div initial="hidden" animate="show" custom={0} variants={fadeUp}>
            <span className="inline-flex items-center gap-2 rounded-full border border-blue-500/30 bg-blue-500/10 px-3 py-1 text-xs font-medium text-blue-300">
              <Sparkles className="h-3.5 w-3.5" />
              {t("badge")}
            </span>
          </motion.div>

          <motion.h1
            initial="hidden"
            animate="show"
            custom={1}
            variants={fadeUp}
            className="mx-auto mt-6 max-w-3xl text-4xl font-semibold tracking-tight sm:text-6xl"
          >
            {t("headlinePart1")}
            <br className="hidden sm:block" />
            {t.rich("headlinePart2", {
              accent: (chunks) => <span className="text-blue-400 text-glow">{chunks}</span>,
            })}
          </motion.h1>

          <motion.p
            initial="hidden"
            animate="show"
            custom={2}
            variants={fadeUp}
            className="mx-auto mt-6 max-w-2xl text-balance text-lg leading-relaxed text-zinc-400"
          >
            {t("subhead")}
          </motion.p>

          <motion.div
            initial="hidden"
            animate="show"
            custom={3}
            variants={fadeUp}
            className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row"
          >
            <Link
              href="/runs/new"
              className="group inline-flex items-center gap-2 rounded-lg bg-blue-600 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-600/25 transition hover:bg-blue-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
            >
              {t("ctaStart")}
              <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />
            </Link>
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-2 rounded-lg border border-zinc-700 bg-zinc-900/60 px-6 py-3 text-sm font-semibold text-zinc-200 transition hover:border-zinc-600 hover:bg-zinc-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
            >
              {t("ctaOpenDashboard")}
            </Link>
          </motion.div>

          {/* Pipeline visualization */}
          <motion.div
            initial="hidden"
            animate="show"
            custom={4}
            variants={fadeUp}
            className="mt-16"
          >
            <Pipeline />
          </motion.div>
        </div>
      </section>

      {/* -------------------------------------------------------------- Stats */}
      <Section>
        <div className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-800 sm:grid-cols-4">
          {STATS.map((s) => (
            <div key={s.labelKey} className="bg-zinc-950 p-6 text-center">
              <div className="text-3xl font-semibold tabular-nums text-zinc-50">{s.value}</div>
              <div className="mt-1 text-xs uppercase tracking-wide text-zinc-500">{t(`stats.${s.labelKey}`)}</div>
            </div>
          ))}
        </div>
      </Section>

      {/* ----------------------------------------------------------- How it works */}
      <Section>
        <SectionHeading
          eyebrow={t("stagesEyebrow")}
          title={t("stagesTitle")}
          sub={t("stagesSub")}
        />
        <ol className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {STAGES.map((stage, i) => (
            <motion.li
              key={stage.titleKey}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.45, delay: i * 0.07 }}
              className="relative rounded-xl border border-zinc-800 bg-zinc-900/50 p-5"
            >
              <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-lg bg-blue-600/15 text-blue-400 ring-1 ring-blue-500/30">
                {stage.icon}
              </div>
              <div className="text-xs font-medium text-zinc-500">{t("stageLabel", { n: i + 1 })}</div>
              <div className="mt-0.5 font-semibold">{t(`stage.${stage.titleKey}`)}</div>
              <p className="mt-1.5 text-sm leading-relaxed text-zinc-400">{t(`stage.${stage.bodyKey}`)}</p>
            </motion.li>
          ))}
        </ol>
      </Section>

      {/* -------------------------------------------------------------- Features */}
      <Section>
        <SectionHeading
          eyebrow={t("featuresEyebrow")}
          title={t("featuresTitle")}
          sub={t("featuresSub")}
        />
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f, i) => (
            <motion.div
              key={f.titleKey}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.45, delay: i * 0.06 }}
              className="group rounded-xl border border-zinc-800 bg-zinc-900/50 p-6 transition hover:border-blue-500/40 hover:bg-zinc-900"
            >
              <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-zinc-800 text-blue-400 transition group-hover:bg-blue-600/15 group-hover:ring-1 group-hover:ring-blue-500/30">
                {f.icon}
              </div>
              <h3 className="font-semibold">{t(`feature.${f.titleKey}`)}</h3>
              <p className="mt-2 text-sm leading-relaxed text-zinc-400">{t(`feature.${f.bodyKey}`)}</p>
            </motion.div>
          ))}
        </div>
      </Section>

      {/* -------------------------------------------------------------- CTA */}
      <Section className="pb-28">
        <div className="relative overflow-hidden rounded-2xl border border-blue-500/20 bg-gradient-to-b from-blue-950/40 to-zinc-900/40 px-8 py-14 text-center ring-glow">
          <div className="pointer-events-none absolute inset-0 bg-grid opacity-40 [mask-image:radial-gradient(60%_60%_at_50%_50%,black,transparent)]" aria-hidden />
          <h2 className="relative text-2xl font-semibold tracking-tight sm:text-3xl">{t("ctaTitle")}</h2>
          <p className="relative mx-auto mt-3 max-w-xl text-zinc-400">
            {t("ctaBody")}
          </p>
          <Link
            href="/runs/new"
            className="group relative mt-8 inline-flex items-center gap-2 rounded-lg bg-blue-600 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-600/25 transition hover:bg-blue-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
          >
            {t("ctaStart")}
            <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />
          </Link>
          <p className="relative mt-4 text-xs text-zinc-500">
            {t("ctaDisclaimer")}
          </p>
        </div>
      </Section>
    </div>
  );
}

/* -------------------------------------------------------------------------- */

function Section({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <section className={`mx-auto max-w-6xl px-6 py-14 ${className}`}>{children}</section>;
}

function SectionHeading({ eyebrow, title, sub }: { eyebrow: string; title: string; sub: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.5 }}
      className="mx-auto max-w-2xl text-center"
    >
      <div className="text-xs font-semibold uppercase tracking-widest text-blue-400">{eyebrow}</div>
      <h2 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">{title}</h2>
      <p className="mt-3 text-zinc-400">{sub}</p>
    </motion.div>
  );
}

/** Horizontal agent pipeline with animated flow connectors. */
function Pipeline() {
  const t = useTranslations("landing.pipeline");
  const nodes = [
    { key: "analysts" as const, subKey: "analystsSub" as const, tone: "blue" },
    { key: "bullBear" as const, subKey: "bullBearSub" as const, tone: "amber" },
    { key: "trader" as const, subKey: "traderSub" as const, tone: "blue" },
    { key: "riskTeam" as const, subKey: "riskTeamSub" as const, tone: "amber" },
    { key: "portfolioMgr" as const, subKey: "portfolioMgrSub" as const, tone: "emerald" },
  ];
  const tone: Record<string, string> = {
    blue: "border-blue-500/30 bg-blue-500/10 text-blue-300",
    amber: "border-amber-500/30 bg-amber-500/10 text-amber-300",
    emerald: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
  };
  return (
    <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-center gap-2 rounded-2xl border border-zinc-800 bg-zinc-900/40 p-4 sm:flex-nowrap">
      {nodes.map((n, i) => (
        <div key={n.key} className="flex items-center gap-2">
          <div className={`whitespace-nowrap rounded-lg border px-3 py-2 text-center ${tone[n.tone]}`}>
            <div className="text-sm font-semibold">{t(n.key)}</div>
            <div className="text-[10px] uppercase tracking-wide opacity-70">{t(n.subKey)}</div>
          </div>
          {i < nodes.length - 1 && (
            <svg width="28" height="12" viewBox="0 0 28 12" className="hidden shrink-0 text-zinc-600 sm:block" aria-hidden>
              <line x1="0" y1="6" x2="22" y2="6" stroke="currentColor" strokeWidth="2" className="animate-flow" />
              <path d="M20 2 L26 6 L20 10" fill="none" stroke="currentColor" strokeWidth="2" />
            </svg>
          )}
        </div>
      ))}
    </div>
  );
}
