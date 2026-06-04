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
import type { ReactNode } from "react";

export default function Landing() {
  const reduce = useReducedMotion();

  const fadeUp: Variants = {
    hidden: { opacity: 0, y: reduce ? 0 : 18 },
    show: (i: number = 0) => ({
      opacity: 1,
      y: 0,
      transition: { duration: 0.5, delay: reduce ? 0 : i * 0.08, ease: [0.22, 1, 0.36, 1] },
    }),
  };

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
              v0.2.5 · Multi-Agent LLM Trading Framework
            </span>
          </motion.div>

          <motion.h1
            initial="hidden"
            animate="show"
            custom={1}
            variants={fadeUp}
            className="mx-auto mt-6 max-w-3xl text-4xl font-semibold tracking-tight sm:text-6xl"
          >
            A trading firm,
            <br className="hidden sm:block" /> staffed by <span className="text-blue-400 text-glow">LLM agents</span>.
          </motion.h1>

          <motion.p
            initial="hidden"
            animate="show"
            custom={2}
            variants={fadeUp}
            className="mx-auto mt-6 max-w-2xl text-balance text-lg leading-relaxed text-zinc-400"
          >
            TradingAgents runs a full desk over any ticker — specialist analysts, a bull-vs-bear
            research debate, a trader, and a risk committee — then streams every step of their
            reasoning to your browser in real time.
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
              Start an analysis
              <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />
            </Link>
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-2 rounded-lg border border-zinc-700 bg-zinc-900/60 px-6 py-3 text-sm font-semibold text-zinc-200 transition hover:border-zinc-600 hover:bg-zinc-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
            >
              Open dashboard
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
            <div key={s.label} className="bg-zinc-950 p-6 text-center">
              <div className="text-3xl font-semibold tabular-nums text-zinc-50">{s.value}</div>
              <div className="mt-1 text-xs uppercase tracking-wide text-zinc-500">{s.label}</div>
            </div>
          ))}
        </div>
      </Section>

      {/* ----------------------------------------------------------- How it works */}
      <Section>
        <SectionHeading
          eyebrow="How it works"
          title="Five stages, one decision"
          sub="Each ticker flows through specialized roles. The handoffs are exactly what you watch stream live on the run page."
        />
        <ol className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {STAGES.map((stage, i) => (
            <motion.li
              key={stage.title}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.45, delay: i * 0.07 }}
              className="relative rounded-xl border border-zinc-800 bg-zinc-900/50 p-5"
            >
              <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-lg bg-blue-600/15 text-blue-400 ring-1 ring-blue-500/30">
                {stage.icon}
              </div>
              <div className="text-xs font-medium text-zinc-500">Stage {i + 1}</div>
              <div className="mt-0.5 font-semibold">{stage.title}</div>
              <p className="mt-1.5 text-sm leading-relaxed text-zinc-400">{stage.body}</p>
            </motion.li>
          ))}
        </ol>
      </Section>

      {/* -------------------------------------------------------------- Features */}
      <Section>
        <SectionHeading
          eyebrow="In the workbench"
          title="Built for watching the work, not just the verdict"
          sub="The CLI gave you a final call. The workbench gives you the whole desk — live, replayable, and comparable."
        />
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f, i) => (
            <motion.div
              key={f.title}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.45, delay: i * 0.06 }}
              className="group rounded-xl border border-zinc-800 bg-zinc-900/50 p-6 transition hover:border-blue-500/40 hover:bg-zinc-900"
            >
              <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-zinc-800 text-blue-400 transition group-hover:bg-blue-600/15 group-hover:ring-1 group-hover:ring-blue-500/30">
                {f.icon}
              </div>
              <h3 className="font-semibold">{f.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-zinc-400">{f.body}</p>
            </motion.div>
          ))}
        </div>
      </Section>

      {/* -------------------------------------------------------------- CTA */}
      <Section className="pb-28">
        <div className="relative overflow-hidden rounded-2xl border border-blue-500/20 bg-gradient-to-b from-blue-950/40 to-zinc-900/40 px-8 py-14 text-center ring-glow">
          <div className="pointer-events-none absolute inset-0 bg-grid opacity-40 [mask-image:radial-gradient(60%_60%_at_50%_50%,black,transparent)]" aria-hidden />
          <h2 className="relative text-2xl font-semibold tracking-tight sm:text-3xl">Put the desk to work</h2>
          <p className="relative mx-auto mt-3 max-w-xl text-zinc-400">
            Pick a ticker and a date, choose your models, and watch the agents debate it out — from the
            first analyst report to the portfolio manager&apos;s final call.
          </p>
          <Link
            href="/runs/new"
            className="group relative mt-8 inline-flex items-center gap-2 rounded-lg bg-blue-600 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-600/25 transition hover:bg-blue-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
          >
            Start an analysis
            <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />
          </Link>
          <p className="relative mt-4 text-xs text-zinc-500">
            Research framework · not financial advice
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
  const nodes = [
    { label: "Analysts", sub: "×4", tone: "blue" },
    { label: "Bull vs Bear", sub: "debate", tone: "amber" },
    { label: "Trader", sub: "plan", tone: "blue" },
    { label: "Risk team", sub: "×3", tone: "amber" },
    { label: "Portfolio Mgr", sub: "decision", tone: "emerald" },
  ];
  const tone: Record<string, string> = {
    blue: "border-blue-500/30 bg-blue-500/10 text-blue-300",
    amber: "border-amber-500/30 bg-amber-500/10 text-amber-300",
    emerald: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
  };
  return (
    <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-center gap-2 rounded-2xl border border-zinc-800 bg-zinc-900/40 p-4 sm:flex-nowrap">
      {nodes.map((n, i) => (
        <div key={n.label} className="flex items-center gap-2">
          <div className={`whitespace-nowrap rounded-lg border px-3 py-2 text-center ${tone[n.tone]}`}>
            <div className="text-sm font-semibold">{n.label}</div>
            <div className="text-[10px] uppercase tracking-wide opacity-70">{n.sub}</div>
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

/* ----------------------------------------------------------------- content */

const STATS = [
  { value: "12", label: "Specialized agents" },
  { value: "4", label: "Analyst lenses" },
  { value: "13", label: "LLM providers" },
  { value: "∞", label: "Yahoo markets" },
];

const STAGES = [
  { title: "Analysts", icon: <LineChart className="h-5 w-5" />, body: "Market, sentiment, news, and fundamentals analysts each file a grounded report." },
  { title: "Research debate", icon: <Users className="h-5 w-5" />, body: "Bull and bear researchers argue it out over multiple rounds; a manager synthesizes." },
  { title: "Trader", icon: <GitBranch className="h-5 w-5" />, body: "The trader turns the research into a concrete investment plan." },
  { title: "Risk committee", icon: <Scale className="h-5 w-5" />, body: "Aggressive, conservative, and neutral analysts stress-test the plan." },
  { title: "Portfolio manager", icon: <Brain className="h-5 w-5" />, body: "The PM issues the final BUY / SELL / HOLD with a rated confidence." },
];

const FEATURES = [
  { title: "Live agent streaming", icon: <Radio className="h-5 w-5" />, body: "Watch every report, tool call, and debate message arrive over SSE — pause, resume, and replay." },
  { title: "Bull vs Bear, visualized", icon: <Users className="h-5 w-5" />, body: "Debates render as side-by-side bubbles by round, so you can read the argument, not just the result." },
  { title: "Decision log & reflections", icon: <History className="h-5 w-5" />, body: "Every run is recorded with its realized return and an after-the-fact reflection on what worked." },
  { title: "Per-ticker charts", icon: <BarChart3 className="h-5 w-5" />, body: "Candlesticks with your historical decisions overlaid, plus the indicators the analysts cite." },
  { title: "Any model, any market", icon: <Brain className="h-5 w-5" />, body: "OpenAI, Anthropic, Google, Qwen, GLM, and more — across every market Yahoo Finance covers." },
  { title: "Compare & replay", icon: <GitBranch className="h-5 w-5" />, body: "Re-run the same ticker on different models and put the decisions side by side." },
];
