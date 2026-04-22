import { getSupabaseSafe } from "./supabase";
import { captureSupabaseError } from "./observability/supabaseErrors";
import { runSupabase } from "./observability/runSupabase";
import {
  formatTime12 as formatTime,
  formatFeePenceOrFree as formatEntryFee,
} from "@/lib/formatters";
import type { City, Quiz, QuizDetail, VenueImage } from "@/data/types";

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

type VenueShape = {
  name: string | null;
  address: string | null;
  postcode: string | null;
  city: string | null;
  borough: string | null;
  lat: number | null;
  lng: number | null;
  what_to_expect?: string | null;
};

/** If last segment looks like a UK postcode, treat the segment before it as the town/city hint. */
function inferCityFromAddress(address: string | null): string | null {
  if (!address?.trim()) return null;
  const parts = address
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean);
  if (parts.length === 0) return null;
  const ukPost = /^[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}$/i;
  let i = parts.length - 1;
  if (ukPost.test(parts[i].replace(/\s+/g, ""))) {
    i -= 1;
  }
  if (i < 0) return null;
  return parts[i] ?? null;
}

/**
 * Prefer `city`, then `borough`, then the last segment of `address` (excluding postcode).
 * When everything is empty, quizzes bucket to slug "other" — backfill `venues.city` in Supabase when you can.
 */
export function resolveVenueCityLabel(venue: VenueShape | null): string | null {
  if (!venue) return null;
  const c = venue.city?.trim();
  if (c) return c;
  const b = venue.borough?.trim();
  if (b) return b;
  return inferCityFromAddress(venue.address ?? null);
}

/** PostgREST returns FK relation as "venue" when using venue:venues(...) in select. */
type SupabaseQuizRow = {
  id: string;
  venue_id?: string;
  day_of_week: number;
  start_time: string;
  entry_fee_pence?: number | null;
  fee_basis?: string | null;
  prize?: string | null;
  turn_up_guidance?: string | null;
  host_cancelled_at?: string | null;
  venues?: VenueShape | null;
  venue?: VenueShape | null;
};

const QUIZ_EVENT_DETAIL_SELECT =
  "id, venue_id, day_of_week, start_time, entry_fee_pence, fee_basis, prize, turn_up_guidance, host_cancelled_at, venues(name, address, postcode, city, borough, lat, lng, what_to_expect)";

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

/** Readable label for a city slug (breadcrumbs, “more in this city”). */
export function citySlugToLabel(slug: string): string {
  const s = slug.trim();
  if (!s || s === "other") return "Other";
  return s
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
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
  const cityLabel = resolveVenueCityLabel(venue);
  const citySlug = toCitySlug(cityLabel);
  const dayName = DAY_NAMES[row.day_of_week] ?? String(row.day_of_week);
  const area =
    venue?.borough?.trim() ??
    venue?.city?.trim() ??
    venue?.address?.split(",")[0]?.trim() ??
    "—";

  const lat =
    venue?.lat != null && Number.isFinite(venue.lat) ? venue.lat : undefined;
  const lng =
    venue?.lng != null && Number.isFinite(venue.lng) ? venue.lng : undefined;

  const addr = venue?.address?.trim();
  const pc = venue?.postcode?.trim();

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
    address: addr || undefined,
    postcode: pc || undefined,
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
    "id, day_of_week, start_time, entry_fee_pence, prize, venues(name, address, postcode, city, borough, lat, lng)";
  try {
    const data = await runSupabase<unknown[]>("marketing.quizzes_list", () =>
      supabase
        .from("quiz_events")
        .select(query)
        .eq("is_active", true)
        .order("day_of_week", { ascending: true })
        .order("start_time", { ascending: true }),
    );
    const rows = data as unknown as SupabaseQuizRow[];
    return rows.map(rowToQuiz);
  } catch {
    return [];
  }
}

/**
 * Single active quiz for detail pages (by Supabase `quiz_events.id`).
 */
export async function fetchQuizByIdFromSupabase(id: string): Promise<Quiz | null> {
  const supabase = getSupabaseSafe();
  if (!supabase) return null;

  const query =
    "id, day_of_week, start_time, entry_fee_pence, prize, venues(name, address, postcode, city, borough, lat, lng)";
  const { data, error } = await supabase
    .from("quiz_events")
    .select(query)
    .eq("id", id)
    .eq("is_active", true)
    .maybeSingle();

  if (error) {
    captureSupabaseError("marketing.quiz_by_id", error);
    return null;
  }
  if (!data) return null;

  return rowToQuiz(data as unknown as SupabaseQuizRow);
}

/**
 * Full quiz row for detail pages: extra event + venue fields and gallery images.
 */
export async function fetchQuizDetailById(id: string): Promise<QuizDetail | null> {
  const supabase = getSupabaseSafe();
  if (!supabase) return null;

  const { data: quizRow, error: quizError } = await supabase
    .from("quiz_events")
    .select(QUIZ_EVENT_DETAIL_SELECT)
    .eq("id", id)
    .eq("is_active", true)
    .maybeSingle();

  if (quizError) {
    captureSupabaseError("marketing.quiz_detail_by_id", quizError);
    return null;
  }
  if (!quizRow) return null;

  const row = quizRow as unknown as SupabaseQuizRow;
  const venueId = row.venue_id ?? null;

  let venueImages: VenueImage[] = [];
  if (venueId) {
    try {
      const imageRows = await runSupabase<
        Array<{
          id: string;
          venue_id: string;
          storage_path: string;
          alt_text: string | null;
          sort_order: number;
        }>
      >("marketing.venue_images_list", () =>
        supabase
          .from("venue_images")
          .select("id, venue_id, storage_path, alt_text, sort_order")
          .eq("venue_id", venueId)
          .order("sort_order", { ascending: true }),
      );
      venueImages = imageRows.map((img) => ({
        id: img.id,
        storagePath: img.storage_path,
        altText: img.alt_text,
        sortOrder: img.sort_order,
      }));
    } catch {
      // preserve prior behavior: continue with empty venueImages on error
    }
  }

  const base = rowToQuiz(row);
  const venue = row.venues ?? row.venue ?? null;

  return {
    ...base,
    feeBasis: row.fee_basis ?? "per_team",
    turnUpGuidance: row.turn_up_guidance ?? null,
    hostCancelledAt: row.host_cancelled_at ?? null,
    whatToExpect: venue?.what_to_expect ?? null,
    venueImages,
  };
}

export async function getQuizById(id: string): Promise<QuizDetail | Quiz | null> {
  const detail = await fetchQuizDetailById(id);
  if (detail) return detail;
  const { quizzes } = await import("@/data/quizzes");
  return quizzes.find((q) => q.id === id) ?? null;
}

/** Public URL for a file path in the `venue-images` storage bucket. */
export function venueImageUrl(storagePath: string): string {
  const supabase = getSupabaseSafe();
  if (!supabase) return "";
  const { data } = supabase.storage.from("venue-images").getPublicUrl(storagePath);
  return data.publicUrl;
}

/**
 * Fetch quizzes for a given city slug (e.g. "london", "birmingham").
 */
export async function fetchQuizzesByCityFromSupabase(citySlug: string): Promise<Quiz[]> {
  const all = await fetchQuizzesFromSupabase();
  return all.filter((q) => q.city === citySlug);
}

type SupabaseVenueAreaRow = {
  city: string | null;
  borough: string | null;
  address: string | null;
};

/**
 * Fetch distinct city list from Supabase `venues`, using the same resolution as quiz cards
 * (city → borough → address inference) so buckets match `/find-a-quiz/[city]`.
 */
export async function getCities(): Promise<City[]> {
  const supabase = getSupabaseSafe();
  if (!supabase) return [];

  let rows: SupabaseVenueAreaRow[] = [];
  try {
    rows = await runSupabase<SupabaseVenueAreaRow[]>("marketing.cities_list", () =>
      supabase.from("venues").select("city, borough, address"),
    );
  } catch {
    return [];
  }

  const unique = new Map<string, City>();
  for (const row of rows) {
    const label = resolveVenueCityLabel({
      name: null,
      address: row.address,
      postcode: null,
      city: row.city,
      borough: row.borough,
      lat: null,
      lng: null,
    });
    const slug = toCitySlug(label);
    if (!unique.has(slug)) {
      const name = toCityName(label);
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
