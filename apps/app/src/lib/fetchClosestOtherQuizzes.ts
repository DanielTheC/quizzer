import { supabase } from "./supabase";
import { haversineMiles } from "./haversine";
import { runSupabase } from "./runSupabase";

export type ClosestOtherQuizRow = {
  id: string;
  day_of_week: number;
  start_time: string;
  miles: number;
  venueName: string;
  city: string | null;
};

type QuizVenueLite = {
  name: string | null;
  lat: number | null;
  lng: number | null;
  city: string | null;
} | null;

type EventRow = {
  id: string;
  day_of_week: number;
  start_time: string;
  venues: QuizVenueLite;
};

/**
 * Active listings with coordinates, excluding `excludeQuizEventId`, sorted by distance from ref point.
 */
export async function fetchClosestOtherQuizzes(
  excludeQuizEventId: string,
  refLat: number,
  refLng: number,
  count: number
): Promise<ClosestOtherQuizRow[]> {
  if (count < 1) return [];

  let rows: EventRow[];
  try {
    const data = await runSupabase<unknown[]>("player.closest_other_quizzes", () =>
      supabase
        .from("quiz_events")
        .select("id, day_of_week, start_time, venues ( name, lat, lng, city )")
        .eq("is_active", true)
        .neq("id", excludeQuizEventId),
    );
    rows = data as unknown as EventRow[];
  } catch {
    return [];
  }
  const scored: { row: EventRow; miles: number }[] = [];

  for (const row of rows) {
    const v = row.venues;
    if (!v) continue;
    const lat = v.lat;
    const lng = v.lng;
    if (lat == null || lng == null || !Number.isFinite(lat) || !Number.isFinite(lng)) continue;
    const miles = haversineMiles(refLat, refLng, lat, lng);
    scored.push({ row, miles });
  }

  scored.sort((a, b) => a.miles - b.miles);

  return scored.slice(0, count).map(({ row, miles }) => ({
    id: row.id,
    day_of_week: row.day_of_week,
    start_time: row.start_time,
    miles,
    venueName: row.venues?.name?.trim() || "Quiz night",
    city: row.venues?.city ? row.venues.city.trim() : null,
  }));
}
