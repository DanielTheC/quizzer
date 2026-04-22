import { useEffect, useMemo, useRef } from "react";
import type { SortMode } from "../../../lib/sortStorage";
import { startTimeToMinutes } from "./nearbyConstants";
import type { DistanceFilter, PrizeFilter, QuizEvent, Venue } from "./nearbyTypes";

function ukTodayIso(): string {
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

export type NearbyFilteredInput = {
  quizzes: QuizEvent[];
  referenceLocation: { lat: number; lng: number } | null;
  getMiles: (venue: Venue | null) => number | null;
  tonightMode: boolean;
  selectedDays: number[];
  prizeFilter: PrizeFilter;
  maxFeePounds: string;
  distanceFilterMiles: DistanceFilter;
  savedOnly: boolean;
  isSaved: (id: string) => boolean;
  sortBy: SortMode;
  debouncedSearchQuery: string;
  nearbyView: "list" | "map";
};

export function useNearbyFilteredQuizzes(p: NearbyFilteredInput) {
  const searchLower = p.debouncedSearchQuery.trim().toLowerCase();

  const isSavedRef = useRef(p.isSaved);
  useEffect(() => {
    isSavedRef.current = p.isSaved;
  }, [p.isSaved]);

  const filteredQuizzes = useMemo(() => {
    const matchesSearch = (q: QuizEvent) => {
      if (!searchLower) return true;
      const name = (q.venues?.name ?? "").toLowerCase();
      const address = (q.venues?.address ?? "").toLowerCase();
      const postcode = (q.venues?.postcode ?? "").toLowerCase();
      return name.includes(searchLower) || address.includes(searchLower) || postcode.includes(searchLower);
    };

    const parsed = Number(p.maxFeePounds.replace(",", "."));
    const maxFeePence =
      p.maxFeePounds.trim() === "" || !Number.isFinite(parsed) ? null : Math.round(parsed * 100);

    const todayIso = ukTodayIso();

    if (p.tonightMode) {
      let filtered = p.quizzes.filter((q) => {
        if (q.occurrence_date !== todayIso) return false;
        if (!matchesSearch(q)) return false;
        if (p.prizeFilter !== "all" && q.prize !== p.prizeFilter) return false;
        if (maxFeePence !== null && q.entry_fee_pence > maxFeePence) return false;
        if (p.distanceFilterMiles != null && p.referenceLocation) {
          const miles = p.getMiles(q.venues);
          if (miles == null || miles > p.distanceFilterMiles) return false;
        }
        if (p.savedOnly && !isSavedRef.current(q.id)) return false;
        return true;
      });

      const sorted = [...filtered].sort((a, b) => {
        if (p.sortBy === "distance" && p.referenceLocation) {
          const ma = p.getMiles(a.venues) ?? Infinity;
          const mb = p.getMiles(b.venues) ?? Infinity;
          if (ma !== mb) return ma - mb;
        }
        if (p.sortBy === "entry_fee") {
          if (a.entry_fee_pence !== b.entry_fee_pence) return a.entry_fee_pence - b.entry_fee_pence;
        }
        return startTimeToMinutes(a.start_time) - startTimeToMinutes(b.start_time);
      });
      return sorted;
    }

    let filtered = p.quizzes.filter((q) => {
      if (!matchesSearch(q)) return false;
      if (p.selectedDays.length > 0 && !p.selectedDays.includes(q.day_of_week)) return false;
      if (p.prizeFilter !== "all" && q.prize !== p.prizeFilter) return false;
      if (maxFeePence !== null && q.entry_fee_pence > maxFeePence) return false;
      if (p.distanceFilterMiles != null && p.referenceLocation) {
        const miles = p.getMiles(q.venues);
        if (miles == null || miles > p.distanceFilterMiles) return false;
      }
      if (p.savedOnly && !isSavedRef.current(q.id)) return false;
      return true;
    });

    const sorted = [...filtered].sort((a, b) => {
      if (p.sortBy === "distance" && p.referenceLocation) {
        const ma = p.getMiles(a.venues) ?? Infinity;
        const mb = p.getMiles(b.venues) ?? Infinity;
        if (ma !== mb) return ma - mb;
      }
      if (p.sortBy === "entry_fee") {
        if (a.entry_fee_pence !== b.entry_fee_pence) return a.entry_fee_pence - b.entry_fee_pence;
      }
      const dateCmp = String(a.occurrence_date).localeCompare(String(b.occurrence_date));
      if (dateCmp !== 0) return dateCmp;
      return startTimeToMinutes(a.start_time) - startTimeToMinutes(b.start_time);
    });
    return sorted;
  }, [
    p.tonightMode,
    p.quizzes,
    p.selectedDays,
    p.prizeFilter,
    p.maxFeePounds,
    p.distanceFilterMiles,
    p.referenceLocation,
    p.getMiles,
    p.savedOnly,
    p.sortBy,
    searchLower,
  ]);

  const mapPlottableCount = useMemo(() => {
    const seen = new Set<string>();
    for (const q of filteredQuizzes) {
      if (q.venues?.lat == null || q.venues?.lng == null) continue;
      seen.add(q.id);
    }
    return seen.size;
  }, [filteredQuizzes]);

  const resultLine =
    p.nearbyView === "map"
      ? `${mapPlottableCount} on map · ${filteredQuizzes.length} total`
      : p.tonightMode
        ? `Showing ${filteredQuizzes.length} quiz${filteredQuizzes.length !== 1 ? "zes" : ""} tonight`
        : `Showing ${filteredQuizzes.length} of ${p.quizzes.length}`;

  const sortLabelShort =
    p.sortBy === "soonest" ? "Soonest" : p.sortBy === "distance" ? "Distance" : "Entry fee";

  const listToolbarCompactSummary =
    `${p.tonightMode ? "Tonight" : "All week"} · ${sortLabelShort} · ` +
    (p.tonightMode
      ? `${filteredQuizzes.length} quiz${filteredQuizzes.length !== 1 ? "zes" : ""}`
      : `${filteredQuizzes.length} of ${p.quizzes.length}`);

  return {
    filteredQuizzes,
    mapPlottableCount,
    resultLine,
    sortLabelShort,
    listToolbarCompactSummary,
  };
}
