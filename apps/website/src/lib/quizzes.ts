import { getSupabaseSafe } from "./supabase";
import type { Quiz } from "@/data/types";

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

type SupabaseQuizRow = {
  id: string;
  day_of_week: number;
  start_time: string;
  entry_fee_pence: number;
  prize: string;
  venues: {
    name: string | null;
    address: string | null;
    postcode: string | null;
    city: string | null;
    lat: number | null;
    lng: number | null;
  } | null;
};

function formatTime(s: string): string {
  const str = String(s).trim();
  const parts = str.split(/[:.]/);
  const h = parseInt(parts[0], 10) || 0;
  const m = parseInt(parts[1], 10) || 0;
  const hour = h % 12 || 12;
  const ampm = h < 12 ? "AM" : "PM";
  return `${hour}:${m.toString().padStart(2, "0")} ${ampm}`;
}

function formatEntryFee(pence: number): string {
  if (pence === 0) return "Free";
  return `£${(pence / 100).toFixed(2)}`;
}

function toCitySlug(city: string | null): string {
  if (!city || !city.trim()) return "other";
  return city.trim().toLowerCase().replace(/\s+/g, "-");
}

function toSlug(venueName: string, citySlug: string, id: string): string {
  const base = venueName
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return base ? `${base}-${citySlug}` : id;
}

function rowToQuiz(row: SupabaseQuizRow): Quiz {
  const venue = row.venues;
  const venueName = venue?.name?.trim() ?? "Unknown venue";
  const citySlug = toCitySlug(venue?.city ?? null);
  const dayName = DAY_NAMES[row.day_of_week] ?? String(row.day_of_week);
  const area = venue?.city?.trim() ?? venue?.address?.split(",")[0]?.trim() ?? "—";

  return {
    id: row.id,
    venueName,
    slug: toSlug(venueName, citySlug, row.id),
    area,
    city: citySlug,
    day: dayName,
    time: formatTime(row.start_time),
    entryFee: formatEntryFee(row.entry_fee_pence),
    prize: (row.prize ?? "").replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()) || "—",
    tags: [],
  };
}

/**
 * Fetch all active quiz events with venues from Supabase.
 * Returns [] if Supabase is not configured or the request fails.
 */
export async function fetchQuizzesFromSupabase(): Promise<Quiz[]> {
  const supabase = getSupabaseSafe();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from("quiz_events")
    .select(
      `
      id,
      day_of_week,
      start_time,
      entry_fee_pence,
      prize,
      venues (
        name,
        address,
        postcode,
        city,
        lat,
        lng
      )
    `
    )
    .eq("is_active", true)
    .order("day_of_week", { ascending: true })
    .order("start_time", { ascending: true });

  if (error) {
    console.error("[website] Supabase quizzes fetch error:", error.message);
    return [];
  }

  const rows = (data as unknown as SupabaseQuizRow[]) ?? [];
  return rows.map(rowToQuiz);
}

/**
 * Fetch quizzes for a given city slug (e.g. "london", "birmingham").
 */
export async function fetchQuizzesByCityFromSupabase(citySlug: string): Promise<Quiz[]> {
  const all = await fetchQuizzesFromSupabase();
  return all.filter((q) => q.city === citySlug);
}
