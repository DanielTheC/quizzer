/** yyyy-mm-dd in Europe/London. Matches Supabase occurrence RPC defaults. */
export function todayUkISO(): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/London",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const y = parts.find((p) => p.type === "year")?.value ?? "1970";
  const m = parts.find((p) => p.type === "month")?.value ?? "01";
  const d = parts.find((p) => p.type === "day")?.value ?? "01";
  return `${y}-${m}-${d}`;
}

/** yyyy-mm-dd in Europe/London, `days` ahead of `todayUkISO()`. */
export function todayUkPlusDaysISO(days: number): string {
  const base = todayUkISO();
  const [y, m, d] = base.split("-").map((s) => parseInt(s, 10));
  const safeY = Number.isFinite(y) ? y : 1970;
  const safeM = Number.isFinite(m) ? (m as number) : 1;
  const safeD = Number.isFinite(d) ? (d as number) : 1;
  const dt = new Date(Date.UTC(safeY, safeM - 1, safeD));
  dt.setUTCDate(dt.getUTCDate() + days);
  const yy = dt.getUTCFullYear().toString().padStart(4, "0");
  const mm = (dt.getUTCMonth() + 1).toString().padStart(2, "0");
  const dd = dt.getUTCDate().toString().padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}
