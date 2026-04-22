import { useCallback, useEffect, useState } from "react";
import { supabase } from "../../../lib/supabase";
import { captureSupabaseError } from "../../../lib/sentryInit";
import { hapticRefreshDone } from "../../../lib/playerHaptics";
import type { QuizEvent, Venue } from "./nearbyTypes";

const FEED_WINDOW_DAYS = 21;

/** yyyy-mm-dd in Europe/London. Matches the RPC default `p_from`. */
function todayUkISO(): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/London",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const y = parts.find((p) => p.type === "year")?.value ?? "1970";
  const m = parts.find((p) => p.type === "month")?.value ?? "01";
  const d = parts.find((p) => p.type === "day")?.value ?? "01";
  return `${y}-${m}-${d}`;
}

/** yyyy-mm-dd in Europe/London, `days` ahead of `todayUkISO()`. */
function todayUkPlusDaysISO(days: number): string {
  const base = todayUkISO();
  const [y, m, d] = base.split("-").map((s) => parseInt(s, 10));
  const safeY = Number.isFinite(y) ? y : 1970;
  const safeM = Number.isFinite(m) ? (m as number) : 1;
  const safeD = Number.isFinite(d) ? (d as number) : 1;
  const dt = new Date(Date.UTC(safeY, safeM - 1, safeD));
  dt.setUTCDate(dt.getUTCDate() + days);
  const yy = dt.getUTCFullYear().toString().padStart(4, "0");
  const mm = (dt.getUTCMonth() + 1).toString().padStart(2, "0");
  const dd = dt.getUTCDate().toString().padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

type FeedRow = {
  quiz_event_id?: string | null;
  occurrence_date?: string | null;
  venue_id?: string | null;
  venue_name?: string | null;
  cadence_pill_label?: string | null;
  cancelled?: boolean | null;
  interest_count?: number | string | null;
  has_host?: boolean | null;
};

type SeriesMetaRow = {
  id: string;
  day_of_week: number;
  start_time: string;
  entry_fee_pence: number | null;
  prize: string | null;
  venues?: {
    name?: string | null;
    address?: string | null;
    postcode?: string | null;
    city?: string | null;
    lat?: number | null;
    lng?: number | null;
  } | null;
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

    const uniqueSeriesIds = Array.from(new Set(feedRows.map((r) => r.quiz_event_id)));

    const metaRes = await supabase
      .from("quiz_events")
      .select(
        "id, day_of_week, start_time, entry_fee_pence, prize, venues(name, address, postcode, city, lat, lng)",
      )
      .in("id", uniqueSeriesIds);

    if (metaRes.error) {
      captureSupabaseError("nearby.quiz_events_meta_for_feed", metaRes.error);
      setErrorMsg(metaRes.error.message);
      setQuizzes([]);
      return;
    }

    const metaById = new Map<string, SeriesMetaRow>();
    for (const row of (metaRes.data as unknown as SeriesMetaRow[]) ?? []) {
      if (row?.id) metaById.set(row.id, row);
    }

    const joined: QuizEvent[] = [];
    for (const r of feedRows) {
      const meta = metaById.get(r.quiz_event_id);
      if (!meta) continue;
      const venueBase = meta.venues ?? null;
      const venues: Venue | null = venueBase
        ? {
            name: venueBase.name ?? r.venue_name ?? "Unknown venue",
            address: venueBase.address ?? "",
            postcode: venueBase.postcode ?? null,
            city: venueBase.city ?? null,
            lat: venueBase.lat ?? null,
            lng: venueBase.lng ?? null,
          }
        : r.venue_name
          ? { name: r.venue_name, address: "" }
          : null;
      joined.push({
        id: r.quiz_event_id,
        day_of_week: Number(meta.day_of_week ?? 0),
        start_time: String(meta.start_time ?? ""),
        entry_fee_pence: Number(meta.entry_fee_pence ?? 0) || 0,
        prize: String(meta.prize ?? ""),
        venues,
        occurrence_date: r.occurrence_date,
        cancelled: Boolean(r.cancelled),
        has_host: Boolean(r.has_host),
        cadence_pill_label: String(r.cadence_pill_label ?? ""),
        interest_count: Number(r.interest_count ?? 0) || 0,
      });
    }

    setQuizzes(joined);
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
