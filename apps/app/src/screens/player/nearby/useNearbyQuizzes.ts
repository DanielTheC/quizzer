import { useCallback, useEffect, useState } from "react";
import { supabase } from "../../../lib/supabase";
import { captureSupabaseError } from "../../../lib/sentryInit";
import { hapticRefreshDone } from "../../../lib/playerHaptics";
import { todayUkISO, todayUkPlusDaysISO } from "../../../lib/dateUtils";
import type { QuizEvent, Venue } from "./nearbyTypes";

const FEED_WINDOW_DAYS = 21;

type FeedRow = {
  quiz_event_id?: string | null;
  occurrence_date?: string | null;
  venue_id?: string | null;
  venue_name?: string | null;
  venue_address?: string | null;
  venue_postcode?: string | null;
  venue_city?: string | null;
  venue_lat?: number | string | null;
  venue_lng?: number | string | null;
  day_of_week?: number | string | null;
  start_time?: string | null;
  entry_fee_pence?: number | string | null;
  prize?: string | null;
  cadence_pill_label?: string | null;
  cancelled?: boolean | null;
  interest_count?: number | string | null;
  has_host?: boolean | null;
};

export function useNearbyQuizzes() {
  const [quizzes, setQuizzes] = useState<QuizEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const fetchQuizzes = useCallback(async () => {
    setErrorMsg(null);

    const feedRes = await supabase.rpc("get_upcoming_occurrences_feed", {
      p_from: todayUkISO(),
      p_to: todayUkPlusDaysISO(FEED_WINDOW_DAYS),
    });

    if (feedRes.error) {
      captureSupabaseError("nearby.get_upcoming_occurrences_feed", feedRes.error);
      setErrorMsg(feedRes.error.message);
      setQuizzes([]);
      return;
    }

    const feedRows = ((feedRes.data as unknown as FeedRow[]) ?? []).filter(
      (r): r is FeedRow & { quiz_event_id: string; occurrence_date: string } =>
        typeof r?.quiz_event_id === "string" &&
        r.quiz_event_id.length > 0 &&
        typeof r?.occurrence_date === "string" &&
        r.occurrence_date.length > 0,
    );

    if (feedRows.length === 0) {
      setQuizzes([]);
      return;
    }

    const quizzes: QuizEvent[] = [];
    for (const r of feedRows) {
      const venues: Venue | null = r.venue_name
        ? {
            name: r.venue_name,
            address: r.venue_address ?? "",
            postcode: r.venue_postcode ?? null,
            city: r.venue_city ?? null,
            lat: Number(r.venue_lat ?? NaN) || null,
            lng: Number(r.venue_lng ?? NaN) || null,
          }
        : null;
      quizzes.push({
        id: r.quiz_event_id,
        day_of_week: Number(r.day_of_week ?? 0) || 0,
        start_time: String(r.start_time ?? ""),
        entry_fee_pence: Number(r.entry_fee_pence ?? 0) || 0,
        prize: String(r.prize ?? ""),
        venues,
        occurrence_date: r.occurrence_date,
        cancelled: Boolean(r.cancelled),
        has_host: Boolean(r.has_host),
        cadence_pill_label: String(r.cadence_pill_label ?? ""),
        interest_count: Number(r.interest_count ?? 0) || 0,
      });
    }

    setQuizzes(quizzes);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      await fetchQuizzes();
      if (!cancelled) setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [fetchQuizzes]);

  const onRefreshList = useCallback(async () => {
    setRefreshing(true);
    await fetchQuizzes();
    setRefreshing(false);
    hapticRefreshDone();
  }, [fetchQuizzes]);

  return { quizzes, loading, errorMsg, refreshing, fetchQuizzes, onRefreshList };
}
