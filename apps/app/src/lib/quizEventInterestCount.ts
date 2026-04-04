import { supabase } from "./supabase";

/** Server-side total interest rows for this quiz listing. Null on error (caller hides UI). */
export async function fetchQuizEventInterestCount(quizEventId: string): Promise<number | null> {
  const { data, error } = await supabase.rpc("get_quiz_event_interest_count", {
    p_quiz_event_id: quizEventId,
  });
  if (error) {
    console.warn("get_quiz_event_interest_count:", error.message);
    return null;
  }
  const raw = data as unknown;
  let n: number;
  if (typeof raw === "bigint") n = Number(raw);
  else if (typeof raw === "number") n = raw;
  else if (typeof raw === "string") n = parseInt(raw, 10);
  else return null;
  return Number.isFinite(n) ? n : null;
}

/** Label for quiz detail; null when count should be hidden. */
export function formatInterestCaption(count: number | null, saved: boolean): string | null {
  if (count == null || count < 1) return null;
  if (saved) {
    if (count === 1) return "You're interested";
    return `You + ${count - 1} others interested`;
  }
  return `${count} interested`;
}

/**
 * Nearby list: only surface popularity above noise floor (detail screen uses a lower threshold).
 */
export function formatNearbyListInterestLabel(
  count: number | undefined | null,
  saved: boolean
): string | null {
  if (count == null || count <= 3) return null;
  if (saved) return `You + ${count - 1} others interested`;
  return `${count} interested`;
}

/** Parse `quiz_event_interests(count)` embed from PostgREST. */
export function interestCountFromInterestEmbed(row: {
  quiz_event_interests?: { count?: number | string }[] | null;
}): number | undefined {
  const raw = row.quiz_event_interests;
  if (!Array.isArray(raw) || raw.length === 0) return undefined;
  const c = raw[0]?.count;
  if (c == null) return undefined;
  const n = typeof c === "number" ? c : parseInt(String(c), 10);
  return Number.isFinite(n) ? n : undefined;
}
