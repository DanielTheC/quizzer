/** day_of_week: 0 = Sunday … 6 = Saturday (matches JS Date.getDay). */

const DAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function pad2(n: number) {
  return n < 10 ? `0${n}` : String(n);
}

/** Minutes since midnight from start_time (e.g. "19:30", "19:30:00"). */
export function startTimeToMinutes(s: string): number | null {
  const str = String(s).trim();
  const parts = str.split(/[:.]/);
  const hh = parseInt(parts[0], 10);
  const mm = parseInt(parts[1] ?? "0", 10);
  if (!Number.isFinite(hh) || !Number.isFinite(mm)) return null;
  return hh * 60 + mm;
}

export type NextOccurrence = {
  at: Date;
  millisFromNow: number;
};

/** Next calendar occurrence of this weekly quiz at/after `from`. */
export function computeNextOccurrence(dayOfWeek: number, startTime: string, from: Date = new Date()): NextOccurrence | null {
  const mins = startTimeToMinutes(startTime);
  if (mins == null) return null;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  const now = new Date(from);
  const todayDow = now.getDay();
  let daysAhead = (dayOfWeek - todayDow + 7) % 7;
  const candidate = new Date(now);
  candidate.setHours(h, m, 0, 0);
  candidate.setDate(candidate.getDate() + daysAhead);
  if (daysAhead === 0 && candidate.getTime() <= now.getTime()) {
    candidate.setDate(candidate.getDate() + 7);
  }
  return { at: candidate, millisFromNow: candidate.getTime() - now.getTime() };
}

/** e.g. "Next: Today · 18:30", "Next: Tomorrow · 18:30", "Next: Tue · 18:30" */
export function formatNextOccurrenceLabel(at: Date, now: Date = new Date()): string {
  const timeStr = `${pad2(at.getHours())}:${pad2(at.getMinutes())}`;
  const startOf = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const dayDiff = Math.round((startOf(at) - startOf(now)) / 86400000);
  if (dayDiff === 0) return `Next: Today · ${timeStr}`;
  if (dayDiff === 1) return `Next: Tomorrow · ${timeStr}`;
  return `Next: ${DAY_SHORT[at.getDay()] ?? "—"} · ${timeStr}`;
}
