const DAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

/** Day-of-week number (0=Sun..6=Sat) → "Sun" / "Mon" / etc. Returns the number as a string if out of range. */
export function dayShort(day: number): string {
  return DAY_SHORT[day] ?? String(day);
}

/** "20:00:00" → "20:00". Leaves non-matching strings untouched. */
export function formatTime24(t: string): string {
  const x = t.trim();
  if (/^\d{2}:\d{2}/.test(x)) return x.slice(0, 5);
  return x;
}

/** "20:00" or "20:00:00" → "8:00 PM". Used on public-facing pages. */
export function formatTime12(s: string): string {
  const parts = String(s).trim().split(/[:.]/);
  const h = parseInt(parts[0], 10) || 0;
  const m = parseInt(parts[1], 10) || 0;
  const hour = h % 12 || 12;
  const ampm = h < 12 ? "AM" : "PM";
  return `${hour}:${m.toString().padStart(2, "0")} ${ampm}`;
}

/** HTML <input type="time"> value. Same shape as formatTime24 today — kept as an alias for intent. */
export function toTimeInputValue(t: string): string {
  return formatTime24(t);
}

/** "20:00" → "20:00:00" for DB insert. Passes through anything already with seconds. */
export function normalizeStartTimeForDb(value: string): string {
  const v = value.trim();
  if (/^\d{2}:\d{2}$/.test(v)) return `${v}:00`;
  return v;
}

/** Admin/portal: null or NaN → "—", else "£1.50". */
export function formatFeePenceOrDash(p: number | null | undefined): string {
  if (p == null || Number.isNaN(Number(p))) return "—";
  return `£${(Number(p) / 100).toFixed(2)}`;
}

/** Public pages: 0 / null → "Free", else "£1.50". */
export function formatFeePenceOrFree(p: number | null | undefined): string {
  const n = Number(p);
  if (!Number.isFinite(n) || n === 0) return "Free";
  return `£${(n / 100).toFixed(2)}`;
}

/** Admin: null → "—", else replaces underscores with spaces ("bar_tab" → "bar tab"). */
export function formatPrizeDisplay(p: string | null | undefined): string {
  if (!p) return "—";
  return p.replace(/_/g, " ");
}
