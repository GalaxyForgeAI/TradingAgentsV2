export function ratingColor(rating: string | null | undefined): string {
  if (!rating) return "text-zinc-500";
  const r = rating.toUpperCase();
  if (r.includes("BUY")) return "text-bull";
  if (r.includes("SELL")) return "text-bear";
  return "text-hold";
}

export function pct(n: number | null | undefined, digits = 2): string {
  if (n == null || Number.isNaN(n)) return "—";
  return `${n >= 0 ? "+" : ""}${n.toFixed(digits)}%`;
}

export function elapsed(ms: number): string {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  return m ? `${m}m ${s % 60}s` : `${s}s`;
}
