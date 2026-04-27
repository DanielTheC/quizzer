import { supabase } from "./supabase";
import { captureSupabaseError } from "./sentryInit";

export type QuizEventDetail = {
  id: string;
  day_of_week: number;
  start_time: string;
  frequency: "weekly" | "monthly" | "quarterly" | "one_off";
  cadence_pill_label: string | null;
  entry_fee_pence: number;
  fee_basis: string;
  prize: string;
  turn_up_guidance: string | null;
  venues: {
    name: string;
    address: string;
    postcode: string | null;
    city: string | null;
    borough?: string | null;
    lat?: number | null;
    lng?: number | null;
    google_maps_url: string | null;
    /** Line breaks become bullet items in the quiz detail card. */
    what_to_expect: string | null;
    venue_images?: { storage_path: string; alt_text: string | null; sort_order: number }[] | null;
  } | null;
};

const QUIZ_EVENT_DETAIL_SELECT = `
          id,
          day_of_week,
          start_time,
          frequency,
          cadence_pill_label,
          entry_fee_pence,
          fee_basis,
          prize,
          turn_up_guidance,
          venues (
            name,
            address,
            postcode,
            city,
            lat,
            lng,
            google_maps_url,
            what_to_expect,
            venue_images (
              storage_path,
              alt_text,
              sort_order
            )
          )
        `;

const CACHE_TTL_MS = 120_000;

type CacheEntry = { data: QuizEventDetail; storedAt: number };
const cache = new Map<string, CacheEntry>();
const pending = new Map<string, Promise<{ data: QuizEventDetail | null; error: string | null }>>();

export function getCachedQuizEventDetail(quizEventId: string): QuizEventDetail | null {
  const e = cache.get(quizEventId);
  if (!e) return null;
  if (Date.now() - e.storedAt > CACHE_TTL_MS) {
    cache.delete(quizEventId);
    return null;
  }
  return e.data;
}

async function loadFromNetwork(
  quizEventId: string
): Promise<{ data: QuizEventDetail | null; error: string | null }> {
  const { data, error } = await supabase
    .from("quiz_events")
    .select(QUIZ_EVENT_DETAIL_SELECT)
    .eq("id", quizEventId)
    .single();

  if (error) {
    captureSupabaseError("player.quiz_event_detail_by_id", error);
    return { data: null, error: error.message };
  }
  const row = data as unknown as QuizEventDetail;
  cache.set(quizEventId, { data: row, storedAt: Date.now() });
  return { data: row, error: null };
}

function startLoad(quizEventId: string): Promise<{ data: QuizEventDetail | null; error: string | null }> {
  let p = pending.get(quizEventId);
  if (!p) {
    p = loadFromNetwork(quizEventId).finally(() => pending.delete(quizEventId));
    pending.set(quizEventId, p);
  }
  return p;
}

/** Fire-and-forget: warms cache before navigation (e.g. list row press-in). */
export function prefetchQuizEventDetail(quizEventId: string): void {
  if (!quizEventId) return;
  if (getCachedQuizEventDetail(quizEventId)) return;
  void startLoad(quizEventId);
}

/** Used by QuizDetail: cache hit, or shared in-flight / new network request. */
export async function fetchQuizEventDetailForScreen(
  quizEventId: string
): Promise<{ data: QuizEventDetail | null; error: string | null }> {
  const hit = getCachedQuizEventDetail(quizEventId);
  if (hit) return { data: hit, error: null };
  return startLoad(quizEventId);
}
