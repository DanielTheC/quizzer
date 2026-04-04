const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export function formatScheduleDay(dayOfWeek: number): string {
  const d = Number(dayOfWeek);
  if (!Number.isInteger(d) || d < 0 || d > 6) return "—";
  return DAY_NAMES[d] ?? "—";
}

export function formatScheduleTime(startTime: string): string {
  const str = String(startTime).trim();
  const parts = str.split(/[:.]/);
  const h = parseInt(parts[0], 10) || 0;
  const m = parseInt(parts[1], 10) || 0;
  const hour = h % 12 || 12;
  const ampm = h < 12 ? "AM" : "PM";
  return `${hour}:${m.toString().padStart(2, "0")} ${ampm}`;
}

export function formatScheduleEntryFeePence(pence: number | null | undefined): string {
  const n = Number(pence);
  if (!Number.isFinite(n) || n === 0) return "Free";
  return `£${(n / 100).toFixed(2)}`;
}

export function formatSchedulePrize(prize: string | null | undefined): string {
  const raw = (prize ?? "").trim();
  if (!raw) return "—";
  return raw.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}
