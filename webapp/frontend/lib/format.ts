export function ratingColor(rating: string | null | undefined): string {
  if (!rating) return "text-zinc-500";
  const r = rating.toUpperCase();
  if (r.includes("BUY")) return "text-bull";
  if (r.includes("SELL")) return "text-bear";
  return "text-hold";
}

export function pct(n: number | null | undefined, locale = "en", digits = 2): string {
  if (n == null || Number.isNaN(n)) return "—";
  return new Intl.NumberFormat(locale, {
    signDisplay: "exceptZero",
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(n) + "%";
}

export function elapsed(ms: number): string {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  return m ? `${m}m ${s % 60}s` : `${s}s`;
}

/** Format an ISO date (yyyy-mm-dd) in the given locale. */
export function fmtDate(iso: string, locale = "en"): string {
  // Construct as UTC midnight so 2026-01-15 doesn't drift backwards in some zones.
  const d = new Date(`${iso}T00:00:00Z`);
  return new Intl.DateTimeFormat(locale, { year: "numeric", month: "short", day: "numeric" })
    .format(d);
}
