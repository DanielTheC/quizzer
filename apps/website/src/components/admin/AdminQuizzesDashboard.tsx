"use client";

import Image from "next/image";
import { createBrowserSupabaseClient } from "@/lib/supabase/browser";
import { captureSupabaseError } from "@/lib/observability/supabaseErrors";
import {
  formatTime24 as formatTimeDisplay,
  toTimeInputValue,
  normalizeStartTimeForDb,
  formatFeePenceOrDash as formatFeePence,
  formatPrizeDisplay,
} from "@/lib/formatters";
import type { CSSProperties } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

const REFRESH_MS = 60_000;
const USER_ACTIVITY_REFETCH_GAP_MS = 900;

const DAY_NAMES = [
  "Sun",
  "Mon",
  "Tue",
  "Wed",
  "Thu",
  "Fri",
  "Sat",
] as const;

const DAY_OPTIONS = [
  { v: 0, label: "Sunday" },
  { v: 1, label: "Monday" },
  { v: 2, label: "Tuesday" },
  { v: 3, label: "Wednesday" },
  { v: 4, label: "Thursday" },
  { v: 5, label: "Friday" },
  { v: 6, label: "Saturday" },
] as const;

function recurrenceHelperText(
  frequency: "weekly" | "monthly" | "quarterly" | "one_off",
  day: number,
): string {
  const weekday = DAY_OPTIONS.find((d) => d.v === day)?.label ?? "day";
  switch (frequency) {
    case "weekly":
      return `Every ${weekday}`;
    case "monthly":
      return `First ${weekday} of the month`;
    case "quarterly":
      return `First ${weekday} of every third month`;
    case "one_off":
      return "Just the start date";
  }
}

const PRIZE_OPTIONS = ["cash", "bar_tab", "drinks", "voucher", "other"] as const;

type VenueRow = {
  id: string;
  name: string;
  city: string | null;
  address: string | null;
  postcode: string | null;
  borough: string | null;
  what_to_expect: string | null;
  google_maps_url: string | null;
  lat: number | null;
  lng: number | null;
};

type VenueImage = {
  id: string;
  storage_path: string;
  alt_text: string | null;
  sort_order: number;
};

type QuizEventRow = {
  id: string;
  venue_id: string;
  day_of_week: number;
  start_time: string;
  frequency: "weekly" | "monthly" | "quarterly" | "one_off";
  nth_week: number | null;
  start_date: string | null;
  occurrences_planned: number;
  is_active: boolean;
  entry_fee_pence: number | null;
  fee_basis: string | null;
  prize: string | null;
  prize_1st: string | null;
  prize_2nd: string | null;
  prize_3rd: string | null;
  turn_up_guidance: string | null;
};

function venueNameById(venues: VenueRow[], id: string) {
  return venues.find((v) => v.id === id)?.name ?? id;
}

function truncateEmail(email: string, maxLen: number) {
  const t = email.trim();
  if (t.length <= maxLen) return t;
  return `${t.slice(0, maxLen)}…`;
}

type QuizClaimSummary = { status: string; host_email: string };

type OccurrenceFeedRow = {
  quiz_event_id: string;
  occurrence_date: string;
  venue_id: string;
  venue_name: string;
  cadence_pill_label: string;
  cancelled: boolean;
  interest_count: number;
  has_host: boolean;
};

type OccurrenceClaimRow = {
  quiz_event_id: string;
  occurrence_date: string;
  host_user_id: string;
};

function ukTodayISO(): string {
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

function plusDaysISO(baseIso: string, days: number): string {
  const [y, m, d] = baseIso.split("-").map((s) => parseInt(s, 10));
  const dt = new Date(Date.UTC(y || 1970, (m || 1) - 1, d || 1));
  dt.setUTCDate(dt.getUTCDate() + days);
  const yy = String(dt.getUTCFullYear()).padStart(4, "0");
  const mm = String(dt.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(dt.getUTCDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

function formatOccurrenceDateLabel(iso: string): string {
  const [y, m, d] = iso.split("-").map((s) => parseInt(s, 10));
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return iso;
  const dt = new Date(Date.UTC(y || 1970, (m || 1) - 1, d || 1));
  return dt.toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });
}

export function AdminQuizzesDashboard() {
  const [venues, setVenues] = useState<VenueRow[]>([]);
  const [quizzes, setQuizzes] = useState<QuizEventRow[]>([]);
  const [quizClaimByEventId, setQuizClaimByEventId] = useState<Map<string, QuizClaimSummary>>(() => new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const [addVenueOpen, setAddVenueOpen] = useState(false);
  const [editingVenue, setEditingVenue] = useState<VenueRow | null>(null);
  const [venueName, setVenueName] = useState("");
  const [venueAddress, setVenueAddress] = useState("");
  const [venueCity, setVenueCity] = useState("");
  const [venuePostcode, setVenuePostcode] = useState("");
  const [venueGoogleMapsUrl, setVenueGoogleMapsUrl] = useState("");
  const [venueResolvedCoords, setVenueResolvedCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [venueResolveBusy, setVenueResolveBusy] = useState(false);
  const [venueResolveError, setVenueResolveError] = useState<string | null>(null);
  const [venueBoroughState, setVenueBoroughState] = useState("");
  const [venueWhatToExpect, setVenueWhatToExpect] = useState("");
  const [venueImages, setVenueImages] = useState<VenueImage[]>([]);
  const [imagesLoading, setImagesLoading] = useState(false);
  const [imageUploading, setImageUploading] = useState(false);
  const [imageError, setImageError] = useState<string | null>(null);
  const [venueSaveBusy, setVenueSaveBusy] = useState(false);
  const [venueDeleteBusy, setVenueDeleteBusy] = useState<string | null>(null);

  const [addQuizOpen, setAddQuizOpen] = useState(false);
  const [editingQuiz, setEditingQuiz] = useState<QuizEventRow | null>(null);
  const [qVenueId, setQVenueId] = useState("");
  const [qDay, setQDay] = useState(3);
  const [qStart, setQStart] = useState("20:00");
  const [qFrequency, setQFrequency] = useState<"weekly" | "monthly" | "quarterly" | "one_off">("weekly");
  const [qStartDate, setQStartDate] = useState("");
  const [qOccurrencesPlanned, setQOccurrencesPlanned] = useState("12");
  const [qFeePence, setQFeePence] = useState("");
  const [qFeeBasis, setQFeeBasis] = useState<"per_person" | "per_team">("per_person");
  const [qPrize, setQPrize] = useState<string>(PRIZE_OPTIONS[4]);
  const [qPrize1st, setQPrize1st] = useState("");
  const [qPrize2nd, setQPrize2nd] = useState("");
  const [qPrize3rd, setQPrize3rd] = useState("");
  const [qTurnUp, setQTurnUp] = useState("");
  const [qActive, setQActive] = useState(true);
  const [quizSaveBusy, setQuizSaveBusy] = useState(false);
  const [quizToggleBusy, setQuizToggleBusy] = useState<string | null>(null);
  const [quizDeleteBusy, setQuizDeleteBusy] = useState<string | null>(null);
  const [viewTab, setViewTab] = useState<"list" | "schedule">("list");
  const [scheduleRows, setScheduleRows] = useState<OccurrenceFeedRow[]>([]);
  const [occurrenceClaims, setOccurrenceClaims] = useState<Map<string, OccurrenceClaimRow>>(() => new Map());
  const [selectedOccurrence, setSelectedOccurrence] = useState<OccurrenceFeedRow | null>(null);
  const [occurrenceCancelReason, setOccurrenceCancelReason] = useState("");
  const [cancelOccurrenceBusy, setCancelOccurrenceBusy] = useState(false);

  const initialLoad = useRef(true);
  const loadGenerationRef = useRef(0);
  const lastUserActivityRefetchAtRef = useRef(0);
  const loadAbortRef = useRef<AbortController | null>(null);

  const resetVenueForm = useCallback(() => {
    setVenueName("");
    setVenueAddress("");
    setVenueCity("");
    setVenuePostcode("");
    setVenueGoogleMapsUrl("");
    setVenueResolvedCoords(null);
    setVenueResolveError(null);
    setVenueBoroughState("");
    setVenueWhatToExpect("");
    setVenueImages([]);
    setImageError(null);
  }, []);

  const resetQuizForm = useCallback(() => {
    setQVenueId("");
    setQDay(3);
    setQStart("20:00");
    setQFrequency("weekly");
    setQStartDate("");
    setQOccurrencesPlanned("12");
    setQFeePence("");
    setQFeeBasis("per_person");
    setQPrize(PRIZE_OPTIONS[4]);
    setQPrize1st("");
    setQPrize2nd("");
    setQPrize3rd("");
    setQTurnUp("");
    setQActive(true);
  }, []);

  const openEditVenue = useCallback((row: VenueRow) => {
    setEditingVenue(row);
    setAddVenueOpen(false);
    setVenueName(row.name);
    setVenueAddress(row.address ?? "");
    setVenueCity(row.city ?? "");
    setVenuePostcode(row.postcode ?? "");
    setVenueGoogleMapsUrl(row.google_maps_url ?? "");
    setVenueResolvedCoords(
      row.lat != null && row.lng != null ? { lat: row.lat, lng: row.lng } : null,
    );
    setVenueResolveError(null);
    setVenueBoroughState(row.borough ?? "");
    setVenueWhatToExpect(row.what_to_expect ?? "");
    setVenueImages([]);
    setImageError(null);
    void loadVenueImages(row.id);
  }, []);

  const openAddVenue = useCallback(() => {
    setEditingVenue(null);
    setAddVenueOpen(true);
    resetVenueForm();
  }, [resetVenueForm]);

  const openEditQuiz = useCallback(
    (row: QuizEventRow) => {
      setEditingQuiz(row);
      setAddQuizOpen(false);
      setQVenueId(row.venue_id);
      setQDay(row.day_of_week);
      setQStart(toTimeInputValue(row.start_time));
      setQFrequency(row.frequency ?? "weekly");
      setQStartDate(row.start_date ?? "");
      setQOccurrencesPlanned(String(row.occurrences_planned ?? 12));
      setQFeePence(row.entry_fee_pence != null ? String(row.entry_fee_pence) : "");
      setQFeeBasis(
        row.fee_basis === "per_team" ? "per_team" : "per_person",
      );
      setQPrize(
        row.prize && (PRIZE_OPTIONS as readonly string[]).includes(row.prize)
          ? row.prize
          : "other",
      );
      setQPrize1st(row.prize_1st ?? "");
      setQPrize2nd(row.prize_2nd ?? "");
      setQPrize3rd(row.prize_3rd ?? "");
      setQTurnUp(row.turn_up_guidance ?? "");
      setQActive(row.is_active);
    },
    [],
  );

  const openAddQuiz = useCallback(() => {
    setEditingQuiz(null);
    setAddQuizOpen(true);
    resetQuizForm();
  }, [resetQuizForm]);

  const load = useCallback(async () => {
    const gen = ++loadGenerationRef.current;
    loadAbortRef.current?.abort();
    const ac = new AbortController();
    loadAbortRef.current = ac;
    const { signal } = ac;

    if (initialLoad.current) setLoading(true);
    setError(null);
    try {
      const supabase = createBrowserSupabaseClient();
      const [v, q] = await Promise.all([
        supabase
          .from("venues")
          .select(
            "id, name, city, address, postcode, borough, what_to_expect, google_maps_url, lat, lng",
          )
          .order("name", { ascending: true })
          .abortSignal(signal),
        supabase
          .from("quiz_events")
          .select(
            "id, venue_id, day_of_week, start_time, frequency, nth_week, start_date, occurrences_planned, is_active, entry_fee_pence, fee_basis, prize, prize_1st, prize_2nd, prize_3rd, turn_up_guidance",
          )
          .order("day_of_week", { ascending: true })
          .order("start_time", { ascending: true })
          .abortSignal(signal),
      ]);

      if (gen !== loadGenerationRef.current) return;

      if (v.error) {
        captureSupabaseError("admin.venues_list", v.error);
        throw new Error(v.error.message);
      }
      if (q.error) {
        captureSupabaseError("admin.quiz_events_list", q.error);
        throw new Error(q.error.message);
      }

      const quizRows = (q.data ?? []) as QuizEventRow[];
      const quizIds = quizRows.map((r) => r.id);
      const fromIso = ukTodayISO();
      const toIso = plusDaysISO(fromIso, 56);

      let nextClaimMap = new Map<string, QuizClaimSummary>();
      if (quizIds.length > 0) {
        const { data: claimRows, error: claimsErr } = await supabase
          .from("quiz_claims")
          .select("quiz_event_id, status, host_email")
          .in("status", ["pending", "confirmed"])
          .in("quiz_event_id", quizIds)
          .order("claimed_at", { ascending: false })
          .abortSignal(signal);

        if (gen !== loadGenerationRef.current) return;

        if (claimsErr) {
          captureSupabaseError("admin.quiz_claims_for_events", claimsErr);
          nextClaimMap = new Map();
        } else {
          for (const r of (claimRows ?? []) as {
            quiz_event_id: string;
            status: string;
            host_email: string;
          }[]) {
            if (!nextClaimMap.has(r.quiz_event_id)) {
              nextClaimMap.set(r.quiz_event_id, { status: r.status, host_email: r.host_email });
            }
          }
        }
      }

      setVenues((v.data ?? []) as VenueRow[]);
      setQuizzes(quizRows);
      setQuizClaimByEventId(nextClaimMap);

      const { data: scheduleData, error: scheduleErr } = await supabase.rpc(
        "get_upcoming_occurrences_feed",
        { p_from: fromIso, p_to: toIso },
      );
      if (gen !== loadGenerationRef.current) return;
      if (scheduleErr) {
        captureSupabaseError("admin.schedule.get_upcoming_occurrences_feed", scheduleErr);
        setScheduleRows([]);
      } else {
        setScheduleRows((scheduleData ?? []) as OccurrenceFeedRow[]);
      }

      if (quizIds.length > 0) {
        const { data: occClaimRows, error: occClaimErr } = await supabase
          .from("quiz_occurrence_claims")
          .select("quiz_event_id, occurrence_date, host_user_id")
          .in("quiz_event_id", quizIds)
          .is("released_at", null)
          .gte("occurrence_date", fromIso)
          .lte("occurrence_date", toIso)
          .abortSignal(signal);
        if (gen !== loadGenerationRef.current) return;
        if (occClaimErr) {
          captureSupabaseError("admin.schedule.quiz_occurrence_claims", occClaimErr);
          setOccurrenceClaims(new Map());
        } else {
          const map = new Map<string, OccurrenceClaimRow>();
          for (const row of (occClaimRows ?? []) as OccurrenceClaimRow[]) {
            map.set(`${row.quiz_event_id}|${row.occurrence_date}`, row);
          }
          setOccurrenceClaims(map);
        }
      } else {
        setOccurrenceClaims(new Map());
      }
    } catch (e) {
      if (gen !== loadGenerationRef.current) return;
      setError(e instanceof Error ? e.message : "Failed to load data.");
    } finally {
      if (gen === loadGenerationRef.current) {
        setLoading(false);
        initialLoad.current = false;
      }
    }
  }, []);

  const loadAfterUserActivity = useCallback(() => {
    const now = Date.now();
    if (now - lastUserActivityRefetchAtRef.current < USER_ACTIVITY_REFETCH_GAP_MS) {
      return;
    }
    lastUserActivityRefetchAtRef.current = now;
    void load();
  }, [load]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    return () => {
      loadAbortRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    const t = setInterval(() => void load(), REFRESH_MS);
    const onVis = () => {
      if (document.visibilityState === "visible") loadAfterUserActivity();
    };
    const onFocus = () => loadAfterUserActivity();
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("focus", onFocus);
    return () => {
      clearInterval(t);
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("focus", onFocus);
    };
  }, [load, loadAfterUserActivity]);

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 3200);
    return () => window.clearTimeout(t);
  }, [toast]);

  async function loadVenueImages(venueId: string) {
    setImagesLoading(true);
    setImageError(null);
    try {
      const supabase = createBrowserSupabaseClient();
      const { data, error: e } = await supabase
        .from("venue_images")
        .select("id, storage_path, alt_text, sort_order")
        .eq("venue_id", venueId)
        .order("sort_order", { ascending: true });
      if (e) throw new Error(e.message);
      setVenueImages((data ?? []) as VenueImage[]);
    } catch (e) {
      setImageError(e instanceof Error ? e.message : "Could not load images.");
    } finally {
      setImagesLoading(false);
    }
  }

  async function uploadVenueImage(venueId: string, file: File) {
    if (!file.type.startsWith("image/")) {
      setImageError("Only image files are supported.");
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      setImageError("Image must be under 8 MB.");
      return;
    }
    setImageUploading(true);
    setImageError(null);
    try {
      const supabase = createBrowserSupabaseClient();
      const safeName = file.name.replace(/[^a-z0-9.\-_]/gi, "-").toLowerCase();
      const path = `${venueId}/${Date.now()}-${safeName}`;

      const { error: uploadError } = await supabase.storage
        .from("venue-images")
        .upload(path, file, { contentType: file.type, upsert: false });
      if (uploadError) throw new Error(uploadError.message);

      const nextOrder =
        venueImages.length > 0 ? Math.max(...venueImages.map((img) => img.sort_order)) + 1 : 0;

      const { error: dbError } = await supabase.from("venue_images").insert({
        venue_id: venueId,
        storage_path: path,
        alt_text: null,
        sort_order: nextOrder,
      });
      if (dbError) throw new Error(dbError.message);

      setToast("Photo uploaded.");
      void loadVenueImages(venueId);
    } catch (e) {
      setImageError(e instanceof Error ? e.message : "Upload failed.");
    } finally {
      setImageUploading(false);
    }
  }

  async function deleteVenueImage(venueId: string, image: VenueImage) {
    if (!window.confirm("Remove this photo?")) return;
    setImageError(null);
    try {
      const supabase = createBrowserSupabaseClient();
      const { error: storageError } = await supabase.storage
        .from("venue-images")
        .remove([image.storage_path]);
      if (storageError) throw new Error(storageError.message);

      const { error: dbError } = await supabase.from("venue_images").delete().eq("id", image.id);
      if (dbError) throw new Error(dbError.message);

      setToast("Photo removed.");
      void loadVenueImages(venueId);
    } catch (e) {
      setImageError(e instanceof Error ? e.message : "Could not remove photo.");
    }
  }

  async function resolveGoogleMapsUrl() {
    const raw = venueGoogleMapsUrl.trim();
    if (!raw) {
      setVenueResolveError("Paste a Google Maps URL first.");
      return;
    }
    setVenueResolveBusy(true);
    setVenueResolveError(null);
    try {
      const res = await fetch("/api/admin/resolve-google-maps-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: raw }),
      });
      const body = (await res.json()) as {
        ok?: boolean;
        error?: string;
        lat?: number;
        lng?: number;
      };
      if (!res.ok || !body?.ok) {
        setVenueResolvedCoords(null);
        setVenueResolveError(body?.error ?? "Could not resolve URL.");
        return;
      }
      if (typeof body.lat === "number" && typeof body.lng === "number") {
        setVenueResolvedCoords({ lat: body.lat, lng: body.lng });
      } else {
        setVenueResolvedCoords(null);
        setVenueResolveError("Could not resolve URL.");
      }
    } catch {
      setVenueResolveError("Network error.");
    } finally {
      setVenueResolveBusy(false);
    }
  }

  async function saveVenue() {
    const name = venueName.trim();
    if (!name) {
      setError("Venue name is required.");
      return;
    }
    if (venueGoogleMapsUrl.trim() && !venueResolvedCoords) {
      setError("Press Use to resolve the Google Maps URL before saving.");
      return;
    }
    setVenueSaveBusy(true);
    setError(null);
    try {
      const supabase = createBrowserSupabaseClient();
      const payload = {
        name,
        address: venueAddress.trim() || null,
        city: venueCity.trim() || null,
        postcode: venuePostcode.trim() || null,
        borough: venueBoroughState.trim() || null,
        what_to_expect: venueWhatToExpect.trim() || null,
        google_maps_url: venueGoogleMapsUrl.trim() || null,
        lat: venueResolvedCoords?.lat ?? null,
        lng: venueResolvedCoords?.lng ?? null,
      };
      if (editingVenue) {
        const { error: e } = await supabase.from("venues").update(payload).eq("id", editingVenue.id);
        if (e) {
          captureSupabaseError("admin.venues_update", e, { venueId: editingVenue.id });
          throw new Error(e.message);
        }
        setToast("Venue updated.");
        setEditingVenue(null);
      } else {
        const { error: e } = await supabase.from("venues").insert(payload);
        if (e) {
          captureSupabaseError("admin.venues_insert", e);
          throw new Error(e.message);
        }
        setToast("Venue added.");
        setAddVenueOpen(false);
        resetVenueForm();
      }
      void load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save venue.");
    } finally {
      setVenueSaveBusy(false);
    }
  }

  async function saveQuiz() {
    const venueId = qVenueId.trim();
    if (!venueId) {
      setError("Venue is required.");
      return;
    }
    const start = normalizeStartTimeForDb(qStart);
    if (!start) {
      setError("Start time is required.");
      return;
    }
    const feeRaw = qFeePence.trim();
    let entry_fee_pence: number | null = null;
    if (feeRaw !== "") {
      const parsed = Number.parseInt(feeRaw, 10);
      if (Number.isNaN(parsed)) {
        setError("Entry fee (pence) must be a whole number.");
        return;
      }
      entry_fee_pence = parsed;
    }
    const startDate = qStartDate.trim();
    if (!startDate) {
      setError("Start date is required.");
      return;
    }
    const occurrencesRaw = qOccurrencesPlanned.trim();
    const occurrences = Number.parseInt(occurrencesRaw, 10);
    if (!Number.isFinite(occurrences) || occurrences < 1 || occurrences > 52) {
      setError("Occurrences planned must be a whole number between 1 and 52.");
      return;
    }

    setQuizSaveBusy(true);
    setError(null);
    try {
      const supabase = createBrowserSupabaseClient();
      const nthWeek =
        qFrequency === "monthly" || qFrequency === "quarterly" ? 1 : null;
      const payload = {
        venue_id: venueId,
        day_of_week: qDay,
        start_time: start,
        frequency: qFrequency,
        nth_week: nthWeek,
        start_date: startDate,
        occurrences_planned: occurrences,
        entry_fee_pence,
        fee_basis: qFeeBasis,
        prize: qPrize,
        prize_1st: qPrize1st.trim() || null,
        prize_2nd: qPrize2nd.trim() || null,
        prize_3rd: qPrize3rd.trim() || null,
        turn_up_guidance: qTurnUp.trim() || null,
        is_active: qActive,
      };

      if (editingQuiz) {
        const { error: e } = await supabase.from("quiz_events").update(payload).eq("id", editingQuiz.id);
        if (e) {
          captureSupabaseError("admin.quiz_events_update", e, { quizEventId: editingQuiz.id });
          throw new Error(e.message);
        }
        setToast("Quiz event updated.");
        setEditingQuiz(null);
      } else {
        const { error: e } = await supabase.from("quiz_events").insert(payload);
        if (e) {
          captureSupabaseError("admin.quiz_events_insert", e);
          throw new Error(e.message);
        }
        setToast("Quiz event added.");
        setAddQuizOpen(false);
        resetQuizForm();
      }
      void load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save quiz event.");
    } finally {
      setQuizSaveBusy(false);
    }
  }

  async function toggleQuizActive(row: QuizEventRow) {
    setQuizToggleBusy(row.id);
    setError(null);
    try {
      const supabase = createBrowserSupabaseClient();
      const next = !row.is_active;
      const { error: e } = await supabase
        .from("quiz_events")
        .update({ is_active: next })
        .eq("id", row.id);
      if (e) {
        captureSupabaseError("admin.quiz_events_toggle_active", e, { quizEventId: row.id });
        throw new Error(e.message);
      }
      setToast("Quiz event updated.");
      void load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not update quiz.");
    } finally {
      setQuizToggleBusy(null);
    }
  }

  async function deleteVenue(row: VenueRow) {
    if (
      !window.confirm(
        `Permanently delete "${row.name}"? All quiz events for this venue must be removed first.`,
      )
    ) {
      return;
    }
    setVenueDeleteBusy(row.id);
    setError(null);
    try {
      const supabase = createBrowserSupabaseClient();
      const { error: e } = await supabase.from("venues").delete().eq("id", row.id);
      if (e) {
        captureSupabaseError("admin.venues_delete", e, { venueId: row.id });
        if (e.code === "23503") {
          setError("Remove all quiz events for this venue before deleting it.");
          return;
        }
        throw new Error(e.message);
      }
      if (editingVenue?.id === row.id) {
        setEditingVenue(null);
        resetVenueForm();
      }
      if (qVenueId === row.id) {
        setQVenueId("");
      }
      setToast("Venue deleted.");
      void load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not delete venue.");
    } finally {
      setVenueDeleteBusy(null);
    }
  }

  async function deleteQuiz(row: QuizEventRow) {
    if (!window.confirm("Permanently delete this quiz event? This cannot be undone.")) return;
    setQuizDeleteBusy(row.id);
    setError(null);
    try {
      const supabase = createBrowserSupabaseClient();
      const { error: e } = await supabase.from("quiz_events").delete().eq("id", row.id);
      if (e) {
        captureSupabaseError("admin.quiz_events_delete", e, { quizEventId: row.id });
        throw new Error(e.message);
      }
      if (editingQuiz?.id === row.id) {
        setEditingQuiz(null);
        resetQuizForm();
      }
      setToast("Quiz event deleted.");
      void load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not delete quiz event.");
    } finally {
      setQuizDeleteBusy(null);
    }
  }

  async function cancelSelectedOccurrence() {
    if (!selectedOccurrence) return;
    const reason = occurrenceCancelReason.trim();
    if (reason.length < 6) {
      setError("Please enter a reason (at least 6 characters).");
      return;
    }
    setCancelOccurrenceBusy(true);
    setError(null);
    try {
      const supabase = createBrowserSupabaseClient();
      const { data, error: rpcError } = await supabase.rpc("cancel_quiz_occurrence", {
        p_quiz_event_id: selectedOccurrence.quiz_event_id,
        p_occurrence_date: selectedOccurrence.occurrence_date,
        p_cancelled_by: "operator",
        p_reason: reason,
      });
      if (rpcError) {
        captureSupabaseError("admin.cancel_quiz_occurrence", rpcError, {
          quiz_event_id: selectedOccurrence.quiz_event_id,
          occurrence_date: selectedOccurrence.occurrence_date,
        });
        throw new Error(rpcError.message);
      }
      if (!data) {
        setError("Occurrence could not be cancelled (already cancelled or unavailable).");
        return;
      }
      setScheduleRows((prev) =>
        prev.map((row) =>
          row.quiz_event_id === selectedOccurrence.quiz_event_id &&
          row.occurrence_date === selectedOccurrence.occurrence_date
            ? { ...row, cancelled: true }
            : row
        )
      );
      setToast("Occurrence cancelled.");
      setSelectedOccurrence((prev) => (prev ? { ...prev, cancelled: true } : prev));
      setOccurrenceCancelReason("");
      void load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not cancel occurrence.");
    } finally {
      setCancelOccurrenceBusy(false);
    }
  }

  const venueFormVisible = addVenueOpen || editingVenue !== null;
  const quizFormVisible = addQuizOpen || editingQuiz !== null;
  const scheduleGroups = useMemo(() => {
    const grouped = new Map<string, OccurrenceFeedRow[]>();
    for (const row of scheduleRows) {
      const list = grouped.get(row.occurrence_date) ?? [];
      list.push(row);
      grouped.set(row.occurrence_date, list);
    }
    return Array.from(grouped.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([date, rows]) => ({
        date,
        rows: rows
          .slice()
          .sort((a, b) => a.venue_name.localeCompare(b.venue_name)),
      }));
  }, [scheduleRows]);

  const selectedOccurrenceClaim = selectedOccurrence
    ? occurrenceClaims.get(`${selectedOccurrence.quiz_event_id}|${selectedOccurrence.occurrence_date}`) ?? null
    : null;

  return (
    <div className="relative space-y-6">
      {toast ? (
        <p
          key={toast}
          className="animate-admin-toast fixed bottom-6 right-6 z-50 max-w-sm rounded-[var(--radius-button)] border-[3px] border-quizzer-black bg-quizzer-yellow px-4 py-2 text-sm font-semibold text-quizzer-black shadow-[var(--shadow-card)]"
          role="status"
        >
          {toast}
        </p>
      ) : null}
      <h1 className="font-heading animate-admin-fade-in-up text-2xl uppercase text-quizzer-black">
        Quizzes
      </h1>
      {error ? (
        <p className="animate-admin-fade-in-up rounded-[var(--radius-button)] border-[3px] border-quizzer-red bg-quizzer-cream px-3 py-2 text-sm text-quizzer-red">
          {error}
        </p>
      ) : null}

      <section
        className="animate-admin-fade-in-up rounded-[var(--radius-button)] border-[3px] border-quizzer-black bg-quizzer-white p-4 shadow-[var(--shadow-card)]"
        style={{ "--admin-stagger": "0ms" } as CSSProperties}
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-heading text-sm uppercase tracking-wide text-quizzer-black">Quiz events</h2>
          <button
            type="button"
            onClick={() => {
              if (quizFormVisible) {
                setAddQuizOpen(false);
                setEditingQuiz(null);
                resetQuizForm();
              } else openAddQuiz();
            }}
            className="rounded-[var(--radius-button)] border-[3px] border-quizzer-black bg-quizzer-yellow px-3 py-1.5 text-xs font-semibold text-quizzer-black shadow-[var(--shadow-button)] hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[var(--shadow-button-hover)]"
          >
            {quizFormVisible ? "Cancel" : "+ Add quiz event"}
          </button>
        </div>

        <div className="mt-3 flex gap-1 border-b-2 border-quizzer-black/10">
          {(["list", "schedule"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setViewTab(t)}
              className={`-mb-[2px] border-b-2 px-4 py-2 text-sm font-semibold capitalize transition-colors ${
                viewTab === t
                  ? "border-quizzer-black text-quizzer-black"
                  : "border-transparent text-quizzer-black/50 hover:text-quizzer-black"
              }`}
            >
              {t === "list" ? "List" : "Schedule"}
            </button>
          ))}
        </div>

        {quizFormVisible ? (
          <div className="animate-admin-fade-in-up mt-4 space-y-3 border-t border-quizzer-black/10 pt-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block text-xs font-medium text-quizzer-black">
                Venue *
                <select
                  value={qVenueId}
                  onChange={(e) => setQVenueId(e.target.value)}
                  className="mt-1 w-full rounded-[var(--radius-button)] border-[3px] border-quizzer-black bg-quizzer-white px-2 py-1 text-sm outline-none focus:ring-2 focus:ring-quizzer-yellow"
                >
                  <option value="">Select venue</option>
                  {venues.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-xs font-medium text-quizzer-black">
                Day *
                <select
                  value={qDay}
                  onChange={(e) => setQDay(Number(e.target.value))}
                  className="mt-1 w-full rounded-[var(--radius-button)] border-[3px] border-quizzer-black bg-quizzer-white px-2 py-1 text-sm outline-none focus:ring-2 focus:ring-quizzer-yellow"
                >
                  {DAY_OPTIONS.map((d) => (
                    <option key={d.v} value={d.v}>
                      {d.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-xs font-medium text-quizzer-black">
                Frequency *
                <select
                  value={qFrequency}
                  onChange={(e) =>
                    setQFrequency(e.target.value as "weekly" | "monthly" | "quarterly" | "one_off")
                  }
                  className="mt-1 w-full rounded-[var(--radius-button)] border-[3px] border-quizzer-black bg-quizzer-white px-2 py-1 text-sm outline-none focus:ring-2 focus:ring-quizzer-yellow"
                >
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                  <option value="quarterly">Quarterly</option>
                  <option value="one_off">One-off</option>
                </select>
              </label>
              <label className="block text-xs font-medium text-quizzer-black">
                Start time (HH:MM) *
                <input
                  type="time"
                  value={qStart}
                  onChange={(e) => setQStart(e.target.value)}
                  className="mt-1 w-full rounded-[var(--radius-button)] border-[3px] border-quizzer-black bg-quizzer-white px-2 py-1 text-sm outline-none focus:ring-2 focus:ring-quizzer-yellow"
                />
              </label>
              <label className="block text-xs font-medium text-quizzer-black">
                Start date *
                <input
                  type="date"
                  value={qStartDate}
                  onChange={(e) => setQStartDate(e.target.value)}
                  className="mt-1 w-full rounded-[var(--radius-button)] border-[3px] border-quizzer-black bg-quizzer-white px-2 py-1 text-sm outline-none focus:ring-2 focus:ring-quizzer-yellow"
                />
              </label>
              <label className="block text-xs font-medium text-quizzer-black">
                Occurrences planned *
                <input
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={52}
                  value={qOccurrencesPlanned}
                  onChange={(e) => setQOccurrencesPlanned(e.target.value)}
                  className="mt-1 w-full rounded-[var(--radius-button)] border-[3px] border-quizzer-black bg-quizzer-white px-2 py-1 text-sm outline-none focus:ring-2 focus:ring-quizzer-yellow"
                />
              </label>
              <p className="text-xs text-quizzer-black/70 sm:col-span-2">
                Recurrence rule: {recurrenceHelperText(qFrequency, qDay)}.
              </p>
              <label className="block text-xs font-medium text-quizzer-black">
                Entry fee (pence)
                <input
                  type="number"
                  inputMode="numeric"
                  min={0}
                  value={qFeePence}
                  onChange={(e) => setQFeePence(e.target.value)}
                  className="mt-1 w-full rounded-[var(--radius-button)] border-[3px] border-quizzer-black bg-quizzer-white px-2 py-1 text-sm outline-none focus:ring-2 focus:ring-quizzer-yellow"
                />
              </label>
              <label className="block text-xs font-medium text-quizzer-black">
                Fee basis
                <select
                  value={qFeeBasis}
                  onChange={(e) => setQFeeBasis(e.target.value as "per_person" | "per_team")}
                  className="mt-1 w-full rounded-[var(--radius-button)] border-[3px] border-quizzer-black bg-quizzer-white px-2 py-1 text-sm outline-none focus:ring-2 focus:ring-quizzer-yellow"
                >
                  <option value="per_person">Per person</option>
                  <option value="per_team">Per team</option>
                </select>
              </label>
              <label className="block text-xs font-medium text-quizzer-black">
                Prize
                <select
                  value={qPrize}
                  onChange={(e) => setQPrize(e.target.value)}
                  className="mt-1 w-full rounded-[var(--radius-button)] border-[3px] border-quizzer-black bg-quizzer-white px-2 py-1 text-sm outline-none focus:ring-2 focus:ring-quizzer-yellow"
                >
                  {PRIZE_OPTIONS.map((p) => (
                    <option key={p} value={p}>
                      {p.replace(/_/g, " ")}
                    </option>
                  ))}
                </select>
              </label>
              <div className="sm:col-span-2 space-y-3">
                <p className="text-xs font-semibold text-quizzer-black">Prize descriptions</p>
                <label className="block text-xs font-medium text-quizzer-black">
                  1st place prize
                  <input
                    type="text"
                    value={qPrize1st}
                    onChange={(e) => setQPrize1st(e.target.value)}
                    placeholder="e.g. £50 bar tab"
                    className="mt-1 w-full rounded-[var(--radius-button)] border-[3px] border-quizzer-black bg-quizzer-white px-2 py-1 text-sm outline-none focus:ring-2 focus:ring-quizzer-yellow"
                  />
                </label>
                <label className="block text-xs font-medium text-quizzer-black">
                  2nd place prize
                  <input
                    type="text"
                    value={qPrize2nd}
                    onChange={(e) => setQPrize2nd(e.target.value)}
                    placeholder="e.g. £25 bar tab"
                    className="mt-1 w-full rounded-[var(--radius-button)] border-[3px] border-quizzer-black bg-quizzer-white px-2 py-1 text-sm outline-none focus:ring-2 focus:ring-quizzer-yellow"
                  />
                </label>
                <label className="block text-xs font-medium text-quizzer-black">
                  3rd place prize
                  <input
                    type="text"
                    value={qPrize3rd}
                    onChange={(e) => setQPrize3rd(e.target.value)}
                    placeholder="e.g. £10 bar tab"
                    className="mt-1 w-full rounded-[var(--radius-button)] border-[3px] border-quizzer-black bg-quizzer-white px-2 py-1 text-sm outline-none focus:ring-2 focus:ring-quizzer-yellow"
                  />
                </label>
              </div>
            </div>
            <label className="block text-xs font-medium text-quizzer-black">
              Turn-up guidance
              <textarea
                value={qTurnUp}
                onChange={(e) => setQTurnUp(e.target.value)}
                rows={3}
                className="mt-1 w-full rounded-[var(--radius-button)] border-[3px] border-quizzer-black bg-quizzer-white px-2 py-1 text-sm outline-none focus:ring-2 focus:ring-quizzer-yellow"
              />
            </label>
            <label className="flex items-center gap-2 text-xs font-medium text-quizzer-black">
              <input
                type="checkbox"
                checked={qActive}
                onChange={(e) => setQActive(e.target.checked)}
                className="h-4 w-4 rounded border-2 border-quizzer-black"
              />
              Active
            </label>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={quizSaveBusy}
                onClick={() => void saveQuiz()}
                className="rounded-[var(--radius-button)] border-[3px] border-quizzer-black bg-quizzer-yellow px-3 py-1.5 text-xs font-semibold text-quizzer-black shadow-[var(--shadow-button)] hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[var(--shadow-button-hover)] disabled:opacity-50"
              >
                {quizSaveBusy ? "Saving…" : editingQuiz ? "Save changes" : "Save"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setAddQuizOpen(false);
                  setEditingQuiz(null);
                  resetQuizForm();
                }}
                className="rounded-[var(--radius-button)] border-[3px] border-quizzer-black/25 bg-quizzer-white px-3 py-1.5 text-xs font-semibold text-quizzer-black"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : null}

        {viewTab === "list" ? (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full border-collapse text-left text-sm text-quizzer-black">
            <thead>
              <tr className="border-b-[3px] border-quizzer-black bg-quizzer-cream">
                <th className="px-3 py-2 font-semibold">Venue</th>
                <th className="px-3 py-2 font-semibold">Day</th>
                <th className="px-3 py-2 font-semibold">Time</th>
                <th className="px-3 py-2 font-semibold">Fee</th>
                <th className="px-3 py-2 font-semibold">Prize</th>
                <th className="px-3 py-2 font-semibold">Active</th>
                <th className="px-3 py-2 font-semibold">Host</th>
                <th className="px-3 py-2 font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading && quizzes.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-3 py-4 text-quizzer-black/60">
                    Loading…
                  </td>
                </tr>
              ) : quizzes.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-3 py-4 text-quizzer-black/60">
                    No quiz events yet.
                  </td>
                </tr>
              ) : (
                quizzes.map((row, rowIdx) => {
                  const claim = quizClaimByEventId.get(row.id);
                  const dow =
                    row.day_of_week >= 0 && row.day_of_week < DAY_NAMES.length
                      ? DAY_NAMES[row.day_of_week]
                      : String(row.day_of_week);
                  return (
                    <tr
                      key={row.id}
                      className="animate-admin-row border-b border-quizzer-black/10"
                      style={
                        { "--admin-row-delay": `${Math.min(rowIdx, 20) * 24}ms` } as CSSProperties
                      }
                    >
                      <td className="px-3 py-2 font-medium">{venueNameById(venues, row.venue_id)}</td>
                      <td className="px-3 py-2">{dow}</td>
                      <td className="px-3 py-2">{formatTimeDisplay(row.start_time)}</td>
                      <td className="px-3 py-2">{formatFeePence(row.entry_fee_pence)}</td>
                      <td className="px-3 py-2">{formatPrizeDisplay(row.prize)}</td>
                      <td className="px-3 py-2" aria-label={row.is_active ? "Active" : "Inactive"}>
                        {row.is_active ? "✓" : "✗"}
                      </td>
                      <td className="px-3 py-2">
                        {claim?.status === "confirmed" ? (
                          <span
                            className="inline-block rounded-full border-[3px] border-quizzer-green bg-quizzer-green/10 px-2 py-0.5 text-xs font-semibold uppercase tracking-wide text-quizzer-green"
                            title={claim.host_email}
                          >
                            ✓ {truncateEmail(claim.host_email, 20)}
                          </span>
                        ) : claim?.status === "pending" ? (
                          <span className="inline-block rounded-full border-[3px] border-quizzer-orange bg-quizzer-yellow/20 px-2 py-0.5 text-xs font-semibold uppercase tracking-wide text-quizzer-orange">
                            ⏳ Pending
                          </span>
                        ) : (
                          <span className="text-xs text-quizzer-black/40">Unclaimed</span>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex flex-wrap gap-2">
                          <a
                            href={`/find-a-quiz/quiz/${row.id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="rounded-[var(--radius-button)] border-[3px] border-quizzer-black bg-quizzer-white px-2 py-1 text-xs font-semibold text-quizzer-black shadow-[var(--shadow-button)] hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[var(--shadow-button-hover)]"
                          >
                            Preview ↗
                          </a>
                          <button
                            type="button"
                            onClick={() => openEditQuiz(row)}
                            className="rounded-[var(--radius-button)] border-[3px] border-quizzer-black bg-quizzer-yellow px-2 py-1 text-xs font-semibold text-quizzer-black shadow-[var(--shadow-button)] hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[var(--shadow-button-hover)]"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            disabled={quizToggleBusy === row.id || quizDeleteBusy === row.id}
                            onClick={() => void toggleQuizActive(row)}
                            className="rounded-[var(--radius-button)] border-[3px] border-quizzer-black bg-quizzer-white px-2 py-1 text-xs font-semibold text-quizzer-black shadow-[var(--shadow-button)] hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[var(--shadow-button-hover)] disabled:opacity-50"
                          >
                            {quizToggleBusy === row.id
                              ? "…"
                              : row.is_active
                                ? "Deactivate"
                                : "Activate"}
                          </button>
                          <button
                            type="button"
                            disabled={quizDeleteBusy === row.id || quizToggleBusy === row.id}
                            onClick={() => void deleteQuiz(row)}
                            className="rounded-[var(--radius-button)] border-[3px] border-quizzer-black bg-quizzer-red px-2 py-1 text-xs font-semibold text-quizzer-white shadow-[var(--shadow-button)] hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[var(--shadow-button-hover)] disabled:opacity-50"
                          >
                            {quizDeleteBusy === row.id ? "…" : "Delete"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        ) : null}

        {viewTab === "schedule" ? (
          <div className="mt-4">
            {scheduleGroups.length === 0 ? (
              <p className="rounded-[var(--radius-button)] border-2 border-quizzer-black/10 bg-quizzer-cream/30 px-4 py-5 text-sm text-quizzer-black/65">
                No upcoming occurrences in the next 8 weeks.
              </p>
            ) : (
              <div className="space-y-4">
                {scheduleGroups.map((group) => (
                  <section
                    key={group.date}
                    className="rounded-[var(--radius-button)] border-2 border-quizzer-black/15 bg-quizzer-cream/20 p-3"
                  >
                    <h3 className="font-heading text-sm uppercase text-quizzer-black">
                      {formatOccurrenceDateLabel(group.date)}
                    </h3>
                    <div className="mt-2 grid gap-2 md:grid-cols-2">
                      {group.rows.map((row) => {
                        const claim = occurrenceClaims.get(`${row.quiz_event_id}|${row.occurrence_date}`);
                        const hostStatus = row.cancelled
                          ? "Cancelled"
                          : claim || row.has_host
                              ? "Claimed"
                              : "Open";
                        return (
                          <button
                            key={`${row.quiz_event_id}|${row.occurrence_date}`}
                            type="button"
                            onClick={() => {
                              setSelectedOccurrence(row);
                              setOccurrenceCancelReason("");
                            }}
                            className="w-full rounded-[var(--radius-button)] border-[3px] border-quizzer-black bg-quizzer-white p-2 text-left text-xs shadow-[var(--shadow-button)] outline-none ring-quizzer-yellow transition hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[var(--shadow-button-hover)] focus-visible:ring-2"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <p className="font-bold text-quizzer-black">{row.venue_name}</p>
                              <span className="rounded-full border-2 border-quizzer-black bg-quizzer-yellow/30 px-2 py-0.5 text-[10px] font-semibold uppercase">
                                {row.cadence_pill_label}
                              </span>
                            </div>
                            <p className="mt-1 text-quizzer-black/80">{row.interest_count} interested</p>
                            <p className="mt-1 text-[10px] font-semibold uppercase tracking-wide text-quizzer-black/70">
                              {hostStatus}
                            </p>
                          </button>
                        );
                      })}
                    </div>
                  </section>
                ))}
              </div>
            )}

            {selectedOccurrence ? (
              <div className="mt-4 rounded-[var(--radius-button)] border-[3px] border-quizzer-black bg-quizzer-white p-4 shadow-[var(--shadow-card)]">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-heading text-base uppercase text-quizzer-black">{selectedOccurrence.venue_name}</p>
                    <p className="text-sm text-quizzer-black/75">
                      {formatOccurrenceDateLabel(selectedOccurrence.occurrence_date)} · {selectedOccurrence.interest_count} interested
                    </p>
                    <p className="mt-1 text-xs text-quizzer-black/65">
                      {selectedOccurrence.cancelled
                        ? "Already cancelled"
                        : selectedOccurrenceClaim || selectedOccurrence.has_host
                          ? "Claimed by a host"
                          : "Unclaimed"}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedOccurrence(null)}
                    className="rounded-[var(--radius-button)] border-[3px] border-quizzer-black/25 bg-quizzer-white px-2 py-1 text-xs font-semibold text-quizzer-black"
                  >
                    Close
                  </button>
                </div>
                {!selectedOccurrence.cancelled ? (
                  <div className="mt-3 space-y-2 border-t border-quizzer-black/10 pt-3">
                    <label className="block text-xs font-medium text-quizzer-black">
                      Cancel reason (operator)
                      <textarea
                        value={occurrenceCancelReason}
                        onChange={(e) => setOccurrenceCancelReason(e.target.value)}
                        rows={3}
                        className="mt-1 w-full rounded-[var(--radius-button)] border-[3px] border-quizzer-black bg-quizzer-white px-2 py-1 text-sm outline-none focus:ring-2 focus:ring-quizzer-yellow"
                        placeholder="Reason shown in audit trail and operator notifications"
                      />
                    </label>
                    <button
                      type="button"
                      disabled={cancelOccurrenceBusy}
                      onClick={() => void cancelSelectedOccurrence()}
                      className="rounded-[var(--radius-button)] border-[3px] border-quizzer-black bg-quizzer-red px-3 py-1.5 text-xs font-semibold text-quizzer-white shadow-[var(--shadow-button)] hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[var(--shadow-button-hover)] disabled:opacity-50"
                    >
                      {cancelOccurrenceBusy ? "Cancelling…" : "Cancel occurrence"}
                    </button>
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        ) : null}
      </section>

      <section
        className="animate-admin-fade-in-up rounded-[var(--radius-button)] border-[3px] border-quizzer-black bg-quizzer-white p-4 shadow-[var(--shadow-card)]"
        style={{ "--admin-stagger": "70ms" } as CSSProperties}
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-heading text-sm uppercase tracking-wide text-quizzer-black">Venues</h2>
          <button
            type="button"
            onClick={() => {
              if (venueFormVisible) {
                setAddVenueOpen(false);
                setEditingVenue(null);
                resetVenueForm();
              } else openAddVenue();
            }}
            className="rounded-[var(--radius-button)] border-[3px] border-quizzer-black bg-quizzer-yellow px-3 py-1.5 text-xs font-semibold text-quizzer-black shadow-[var(--shadow-button)] hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[var(--shadow-button-hover)]"
          >
            {venueFormVisible ? "Cancel" : "+ Add venue"}
          </button>
        </div>

        {venueFormVisible ? (
          <div className="animate-admin-fade-in-up mt-4 space-y-3 border-t border-quizzer-black/10 pt-4">
            <label className="block text-xs font-medium text-quizzer-black">
              Name *
              <input
                type="text"
                value={venueName}
                onChange={(e) => setVenueName(e.target.value)}
                className="mt-1 w-full rounded-[var(--radius-button)] border-[3px] border-quizzer-black bg-quizzer-white px-2 py-1 text-sm outline-none focus:ring-2 focus:ring-quizzer-yellow"
              />
            </label>
            <label className="block text-xs font-medium text-quizzer-black">
              Address
              <input
                type="text"
                value={venueAddress}
                onChange={(e) => setVenueAddress(e.target.value)}
                className="mt-1 w-full rounded-[var(--radius-button)] border-[3px] border-quizzer-black bg-quizzer-white px-2 py-1 text-sm outline-none focus:ring-2 focus:ring-quizzer-yellow"
              />
            </label>
            <label className="block text-xs font-medium text-quizzer-black">
              City
              <input
                type="text"
                value={venueCity}
                onChange={(e) => setVenueCity(e.target.value)}
                className="mt-1 w-full rounded-[var(--radius-button)] border-[3px] border-quizzer-black bg-quizzer-white px-2 py-1 text-sm outline-none focus:ring-2 focus:ring-quizzer-yellow"
              />
            </label>
            <label className="block text-xs font-medium text-quizzer-black">
              Postcode
              <input
                type="text"
                value={venuePostcode}
                onChange={(e) => setVenuePostcode(e.target.value)}
                className="mt-1 w-full rounded-[var(--radius-button)] border-[3px] border-quizzer-black bg-quizzer-white px-2 py-1 text-sm outline-none focus:ring-2 focus:ring-quizzer-yellow"
              />
            </label>
            <div className="space-y-2">
              <label className="block text-xs font-semibold uppercase text-quizzer-black">
                Google Maps URL
              </label>
              <p className="text-xs text-quizzer-black/70">
                Open this venue in Google Maps, tap Share, copy the link, and paste it here. The mobile Maps
                button will open the business listing directly.
              </p>
              <div className="flex gap-2">
                <input
                  type="url"
                  value={venueGoogleMapsUrl}
                  onChange={(e) => {
                    setVenueGoogleMapsUrl(e.target.value);
                    setVenueResolvedCoords(null);
                    setVenueResolveError(null);
                  }}
                  placeholder="https://maps.app.goo.gl/..."
                  className="flex-1 rounded-[var(--radius-button)] border-[3px] border-quizzer-black bg-quizzer-white px-3 py-2 text-sm text-quizzer-black outline-none focus:ring-2 focus:ring-quizzer-yellow"
                />
                <button
                  type="button"
                  onClick={() => void resolveGoogleMapsUrl()}
                  disabled={venueResolveBusy || !venueGoogleMapsUrl.trim()}
                  className="rounded-[var(--radius-button)] border-[3px] border-quizzer-black bg-quizzer-yellow px-3 py-2 text-xs font-semibold text-quizzer-black shadow-[var(--shadow-button)] hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[var(--shadow-button-hover)] disabled:opacity-50"
                >
                  {venueResolveBusy ? "Resolving…" : "Use"}
                </button>
              </div>
              {venueResolvedCoords ? (
                <p className="text-xs text-quizzer-black/70">
                  Coordinates set: {venueResolvedCoords.lat.toFixed(6)}, {venueResolvedCoords.lng.toFixed(6)}
                </p>
              ) : null}
              {venueResolveError ? (
                <p className="text-xs text-quizzer-red">{venueResolveError}</p>
              ) : null}
            </div>
            <label className="block text-xs font-medium text-quizzer-black">
              Borough
              <input
                type="text"
                value={venueBoroughState}
                onChange={(e) => setVenueBoroughState(e.target.value)}
                placeholder="e.g. Hackney"
                className="mt-1 w-full rounded-[var(--radius-button)] border-[3px] border-quizzer-black bg-quizzer-white px-2 py-1 text-sm outline-none focus:ring-2 focus:ring-quizzer-yellow"
              />
            </label>

            <label className="block text-xs font-medium text-quizzer-black">
              What to expect
              <span className="ml-1 font-normal text-quizzer-black/50">
                (one bullet per line — shown to players in the app and website)
              </span>
              <textarea
                value={venueWhatToExpect}
                onChange={(e) => setVenueWhatToExpect(e.target.value)}
                rows={5}
                placeholder={
                  "8 rounds, 5 questions each, plus a picture round.\nAnswers on paper — host enters totals at the end.\nPrizes awarded immediately after the final round."
                }
                className="mt-1 w-full rounded-[var(--radius-button)] border-[3px] border-quizzer-black bg-quizzer-white px-2 py-1 text-sm outline-none focus:ring-2 focus:ring-quizzer-yellow"
              />
            </label>

            {editingVenue ? (
              <div className="border-t border-quizzer-black/10 pt-4 space-y-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-quizzer-black">
                  Photos
                </p>
                {imageError ? <p className="text-xs text-quizzer-red">{imageError}</p> : null}
                {imagesLoading ? (
                  <p className="text-xs text-quizzer-black/50">Loading photos…</p>
                ) : venueImages.length > 0 ? (
                  <div className="grid grid-cols-3 gap-2">
                    {venueImages.map((img) => {
                      const supabase = createBrowserSupabaseClient();
                      const { data: urlData } = supabase.storage
                        .from("venue-images")
                        .getPublicUrl(img.storage_path);
                      return (
                        <div
                          key={img.id}
                          className="relative group aspect-[4/3] rounded border-2 border-quizzer-black overflow-hidden bg-quizzer-cream"
                        >
                          <Image
                            src={urlData.publicUrl}
                            alt={img.alt_text ?? "Venue photo"}
                            fill
                            className="object-cover"
                            sizes="(max-width: 640px) 50vw, 33vw"
                          />
                          <button
                            type="button"
                            onClick={() => void deleteVenueImage(editingVenue.id, img)}
                            className="absolute top-1 right-1 rounded-[var(--radius-badge)] border-[3px] border-quizzer-black bg-quizzer-red px-1.5 py-0.5 text-[10px] font-bold text-quizzer-white invisible group-hover:visible"
                          >
                            ✕
                          </button>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-xs text-quizzer-black/50">No photos yet.</p>
                )}
                <label className="block">
                  <span className="text-xs font-medium text-quizzer-black">
                    {imageUploading ? "Uploading…" : "Upload a photo"}
                  </span>
                  <input
                    type="file"
                    accept="image/*"
                    disabled={imageUploading}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) void uploadVenueImage(editingVenue.id, file);
                      e.target.value = "";
                    }}
                    className="mt-1 block text-xs text-quizzer-black file:mr-3 file:rounded file:border-2 file:border-quizzer-black file:bg-quizzer-yellow file:px-2 file:py-1 file:text-xs file:font-semibold file:cursor-pointer disabled:opacity-50"
                  />
                  <p className="mt-1 text-[10px] text-quizzer-black/40">Max 8 MB · JPEG, PNG, WebP</p>
                </label>
              </div>
            ) : null}
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={venueSaveBusy}
                onClick={() => void saveVenue()}
                className="rounded-[var(--radius-button)] border-[3px] border-quizzer-black bg-quizzer-yellow px-3 py-1.5 text-xs font-semibold text-quizzer-black shadow-[var(--shadow-button)] hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[var(--shadow-button-hover)] disabled:opacity-50"
              >
                {venueSaveBusy ? "Saving…" : editingVenue ? "Save changes" : "Save"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setAddVenueOpen(false);
                  setEditingVenue(null);
                  resetVenueForm();
                }}
                className="rounded-[var(--radius-button)] border-[3px] border-quizzer-black/25 bg-quizzer-white px-3 py-1.5 text-xs font-semibold text-quizzer-black"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : null}

        <div className="mt-4 overflow-x-auto">
          <table className="w-full border-collapse text-left text-sm text-quizzer-black">
            <thead>
              <tr className="border-b-[3px] border-quizzer-black bg-quizzer-cream">
                <th className="px-3 py-2 font-semibold">Name</th>
                <th className="px-3 py-2 font-semibold">City</th>
                <th className="px-3 py-2 font-semibold">Address</th>
                <th className="px-3 py-2 font-semibold">Postcode</th>
                <th className="px-3 py-2 font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading && venues.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-3 py-4 text-quizzer-black/60">
                    Loading…
                  </td>
                </tr>
              ) : venues.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-3 py-4 text-quizzer-black/60">
                    No venues yet.
                  </td>
                </tr>
              ) : (
                venues.map((row, rowIdx) => (
                  <tr
                    key={row.id}
                    className="animate-admin-row border-b border-quizzer-black/10"
                    style={
                      { "--admin-row-delay": `${Math.min(rowIdx, 20) * 24}ms` } as CSSProperties
                    }
                  >
                    <td className="px-3 py-2 font-medium">{row.name}</td>
                    <td className="px-3 py-2">{row.city ?? "—"}</td>
                    <td className="px-3 py-2">{row.address ?? "—"}</td>
                    <td className="px-3 py-2">{row.postcode ?? "—"}</td>
                    <td className="px-3 py-2">
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          disabled={venueDeleteBusy === row.id}
                          onClick={() => openEditVenue(row)}
                          className="rounded-[var(--radius-button)] border-[3px] border-quizzer-black bg-quizzer-yellow px-2 py-1 text-xs font-semibold text-quizzer-black shadow-[var(--shadow-button)] hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[var(--shadow-button-hover)] disabled:opacity-50"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          disabled={venueDeleteBusy === row.id || venueSaveBusy}
                          onClick={() => void deleteVenue(row)}
                          className="rounded-[var(--radius-button)] border-[3px] border-quizzer-black bg-quizzer-red px-2 py-1 text-xs font-semibold text-quizzer-white shadow-[var(--shadow-button)] hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[var(--shadow-button-hover)] disabled:opacity-50"
                        >
                          {venueDeleteBusy === row.id ? "…" : "Delete"}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
