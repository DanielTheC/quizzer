import { getSupabaseSafe } from "./supabase";
import type { Quiz } from "@/data/types";
import type { City } from "@/data/types";

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

type VenueShape = {
  name: string | null;
  address: string | null;
  postcode: string | null;
  city: string | null;
  lat: number | null;
  lng: number | null;
};

/** PostgREST returns FK relation as "venue" when using venue:venues(...) in select. */
type SupabaseQuizRow = {
  id: string;
  day_of_week: number;
  start_time: string;
  entry_fee_pence?: number | null;
  prize?: string | null;
  venues?: VenueShape | null;
  venue?: VenueShape | null;
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

function formatEntryFee(pence: number | null | undefined): string {
  const n = Number(pence);
  if (!Number.isFinite(n) || n === 0) return "Free";
  return `£${(n / 100).toFixed(2)}`;
}

function toCitySlug(city: string | null): string {
  if (!city || !city.trim()) return "other";
  return city.trim().toLowerCase().replace(/\s+/g, "-");
}

function toCityName(city: string | null): string {
  const c = (city ?? "").trim();
  if (!c) return "Other";
  // Keep it simple and readable (handles "london" -> "London", "Greater London" stays as is)
  return c.replace(/\b\w/g, (ch) => ch.toUpperCase());
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
  const venue = row.venues ?? row.venue ?? null;
  const venueName = venue?.name?.trim() ?? "Unknown venue";
  const citySlug = toCitySlug(venue?.city ?? null);
  const dayName = DAY_NAMES[row.day_of_week] ?? String(row.day_of_week);
  const area = venue?.city?.trim() ?? venue?.address?.split(",")[0]?.trim() ?? "—";

  const lat =
    venue?.lat != null && Number.isFinite(venue.lat) ? venue.lat : undefined;
  const lng =
    venue?.lng != null && Number.isFinite(venue.lng) ? venue.lng : undefined;

  return {
    id: row.id,
    venueName,
    slug: toSlug(venueName, citySlug, row.id),
    area,
    city: citySlug,
    day: dayName,
    time: formatTime(row.start_time ?? ""),
    entryFee: formatEntryFee(row.entry_fee_pence),
    prize: (row.prize ?? "").replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()) || "—",
    tags: [],
    lat,
    lng,
  };
}

/**
 * Fetch all active quiz events with venues from Supabase.
 * Returns [] if Supabase is not configured or the request fails.
 *
 * Supabase query: from("quiz_events").select("...").eq("is_active", true).
 * Relation name depends on FK: we read row.venues ?? row.venue.
 */
export async function fetchQuizzesFromSupabase(): Promise<Quiz[]> {
  const supabase = getSupabaseSafe();
  if (!supabase) return [];

  const query =
    "id, day_of_week, start_time, entry_fee_pence, prize, venues(name, address, postcode, city, lat, lng)";
  const { data, error } = await supabase
    .from("quiz_events")
    .select(query)
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

type SupabaseCityRow = { city: string | null };

/**
 * Fetch distinct city list from Supabase `venues`.
 * Returns [] if Supabase is not configured or the request fails.
 */
export async function getCities(): Promise<City[]> {
  const supabase = getSupabaseSafe();
  if (!supabase) return [];

  const { data, error } = await supabase.from("venues").select("city");

  if (error) {
    console.error("[website] Supabase cities fetch error:", error.message);
    return [];
  }

  const rows = (data as unknown as SupabaseCityRow[]) ?? [];
  const unique = new Map<string, City>();
  for (const row of rows) {
    const slug = toCitySlug(row.city);
    if (!unique.has(slug)) {
      const name = toCityName(row.city);
      unique.set(slug, {
        slug,
        name,
        description: `Find pub quizzes in ${name}.`,
      });
    }
  }

  return Array.from(unique.values()).sort((a, b) => a.name.localeCompare(b.name));
}

/** Result of getQuizzesAndCitiesForFindAQuiz: quizzes + cities + which source each came from. */
export type FindAQuizData = {
  quizzes: Quiz[];
  cities: City[];
  quizSource: "supabase" | "mock";
  citySource: "supabase" | "static";
};

/**
 * Load quizzes and cities for the find-a-quiz page. Exposes source so the UI can show a debug banner.
 */
export async function getQuizzesAndCitiesForFindAQuiz(): Promise<FindAQuizData> {
  const [fromSupabaseQuizzes, fromSupabaseCities] = await Promise.all([
    fetchQuizzesFromSupabase(),
    getCities(),
  ]);

  const quizSource = fromSupabaseQuizzes.length > 0 ? "supabase" : "mock";
  const citySource = fromSupabaseCities.length > 0 ? "supabase" : "static";

  const quizzes =
    quizSource === "supabase"
      ? fromSupabaseQuizzes
      : await import("@/data/quizzes").then((m) => m.quizzes);
  const cities =
    citySource === "supabase"
      ? fromSupabaseCities
      : await import("@/data/quizzes").then((m) => m.cities);

  return { quizzes, cities, quizSource, citySource };
}

/**
 * Fetch quizzes for a city slug from Supabase.
 * Alias of `fetchQuizzesByCityFromSupabase` to match website query-helper naming.
 */
export async function getQuizzesByCity(citySlug: string): Promise<Quiz[]> {
  return fetchQuizzesByCityFromSupabase(citySlug);
}
