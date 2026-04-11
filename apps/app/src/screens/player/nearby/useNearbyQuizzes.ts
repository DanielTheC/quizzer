import { useCallback, useEffect, useState } from "react";
import { supabase } from "../../../lib/supabase";
import { captureSupabaseError } from "../../../lib/sentryInit";
import { interestCountFromInterestEmbed } from "../../../lib/quizEventInterestCount";
import { hapticRefreshDone } from "../../../lib/playerHaptics";
import type { QuizEvent } from "./nearbyTypes";

function mapQuizEventRow(raw: Record<string, unknown>): QuizEvent {
  const interest = interestCountFromInterestEmbed(
    raw as { quiz_event_interests?: { count?: number | string }[] | null }
  );
  const { quiz_event_interests: _q, venues, ...rest } = raw as Record<string, unknown> & {
    venues?: QuizEvent["venues"];
  };
  const base = rest as Omit<QuizEvent, "venues" | "interest_count">;
  return {
    ...base,
    venues: (venues as QuizEvent["venues"]) ?? null,
    ...(interest !== undefined ? { interest_count: interest } : {}),
  };
}

export function useNearbyQuizzes() {
  const [quizzes, setQuizzes] = useState<QuizEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const fetchQuizzes = useCallback(async () => {
    setErrorMsg(null);
    const selectBase = `
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
        `;
    const withInterest = `${selectBase.trim()},
          quiz_event_interests(count)`;

    const primary = await supabase
      .from("quiz_events")
      .select(withInterest)
      .eq("is_active", true)
      .order("day_of_week", { ascending: true })
      .order("start_time", { ascending: true });

    const resolved =
      primary.error != null
        ? await supabase
            .from("quiz_events")
            .select(selectBase)
            .eq("is_active", true)
            .order("day_of_week", { ascending: true })
            .order("start_time", { ascending: true })
        : primary;

    if (primary.error != null) {
      console.warn("quiz_events list with interest embed failed, retrying without:", primary.error.message);
    }

    if (resolved.error) {
      console.log("Error loading quizzes:", resolved.error);
      captureSupabaseError("quiz_events list", resolved.error);
      setErrorMsg(resolved.error.message);
      setQuizzes([]);
    } else {
      const rows = (resolved.data as unknown as Record<string, unknown>[]) ?? [];
      setQuizzes(rows.map((row) => mapQuizEventRow(row)));
    }
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
