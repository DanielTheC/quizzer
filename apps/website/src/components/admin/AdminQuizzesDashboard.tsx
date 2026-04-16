"use client";

import { createBrowserSupabaseClient } from "@/lib/supabase/browser";
import { captureSupabaseError } from "@/lib/observability/supabaseErrors";
import type { CSSProperties } from "react";
import { useCallback, useEffect, useRef, useState } from "react";

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

const PRIZE_OPTIONS = ["cash", "bar_tab", "drinks", "voucher", "other"] as const;

type VenueRow = {
  id: string;
  name: string;
  city: string | null;
  address: string | null;
  postcode: string | null;
  borough: string | null;
  what_to_expect: string | null;
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
  is_active: boolean;
  entry_fee_pence: number | null;
  fee_basis: string | null;
  prize: string | null;
  turn_up_guidance: string | null;
};

function formatTimeDisplay(t: string) {
  const x = t.trim();
  if (/^\d{2}:\d{2}/.test(x)) return x.slice(0, 5);
  return x;
}

function toTimeInputValue(t: string) {
  return formatTimeDisplay(t);
}

function normalizeStartTimeForDb(value: string): string {
  const v = value.trim();
  if (/^\d{2}:\d{2}$/.test(v)) return `${v}:00`;
  return v;
}

function formatFeePence(p: number | null) {
  if (p == null || Number.isNaN(Number(p))) return "—";
  return `£${(Number(p) / 100).toFixed(2)}`;
}

function formatPrizeDisplay(p: string | null) {
  if (!p) return "—";
  return p.replace(/_/g, " ");
}

function venueNameById(venues: VenueRow[], id: string) {
  return venues.find((v) => v.id === id)?.name ?? id;
}

export function AdminQuizzesDashboard() {
  const [venues, setVenues] = useState<VenueRow[]>([]);
  const [quizzes, setQuizzes] = useState<QuizEventRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const [addVenueOpen, setAddVenueOpen] = useState(false);
  const [editingVenue, setEditingVenue] = useState<VenueRow | null>(null);
  const [venueName, setVenueName] = useState("");
  const [venueAddress, setVenueAddress] = useState("");
  const [venueCity, setVenueCity] = useState("");
  const [venuePostcode, setVenuePostcode] = useState("");
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
  const [qFeePence, setQFeePence] = useState("");
  const [qFeeBasis, setQFeeBasis] = useState<"per_person" | "per_team">("per_person");
  const [qPrize, setQPrize] = useState<string>(PRIZE_OPTIONS[4]);
  const [qTurnUp, setQTurnUp] = useState("");
  const [qActive, setQActive] = useState(true);
  const [quizSaveBusy, setQuizSaveBusy] = useState(false);
  const [quizToggleBusy, setQuizToggleBusy] = useState<string | null>(null);
  const [quizDeleteBusy, setQuizDeleteBusy] = useState<string | null>(null);

  const initialLoad = useRef(true);
  const loadGenerationRef = useRef(0);
  const lastUserActivityRefetchAtRef = useRef(0);
  const loadAbortRef = useRef<AbortController | null>(null);

  const resetVenueForm = useCallback(() => {
    setVenueName("");
    setVenueAddress("");
    setVenueCity("");
    setVenuePostcode("");
    setVenueBoroughState("");
    setVenueWhatToExpect("");
    setVenueImages([]);
    setImageError(null);
  }, []);

  const resetQuizForm = useCallback(() => {
    setQVenueId("");
    setQDay(3);
    setQStart("20:00");
    setQFeePence("");
    setQFeeBasis("per_person");
    setQPrize(PRIZE_OPTIONS[4]);
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
      setQFeePence(row.entry_fee_pence != null ? String(row.entry_fee_pence) : "");
      setQFeeBasis(
        row.fee_basis === "per_team" ? "per_team" : "per_person",
      );
      setQPrize(
        row.prize && (PRIZE_OPTIONS as readonly string[]).includes(row.prize)
          ? row.prize
          : "other",
      );
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
          .select("id, name, city, address, postcode, borough, what_to_expect")
          .order("name", { ascending: true })
          .abortSignal(signal),
        supabase
          .from("quiz_events")
          .select(
            "id, venue_id, day_of_week, start_time, is_active, entry_fee_pence, fee_basis, prize, turn_up_guidance",
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

      setVenues((v.data ?? []) as VenueRow[]);
      setQuizzes((q.data ?? []) as QuizEventRow[]);
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

  async function saveVenue() {
    const name = venueName.trim();
    if (!name) {
      setError("Venue name is required.");
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

    setQuizSaveBusy(true);
    setError(null);
    try {
      const supabase = createBrowserSupabaseClient();
      const payload = {
        venue_id: venueId,
        day_of_week: qDay,
        start_time: start,
        entry_fee_pence,
        fee_basis: qFeeBasis,
        prize: qPrize,
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

  const venueFormVisible = addVenueOpen || editingVenue !== null;
  const quizFormVisible = addQuizOpen || editingQuiz !== null;

  return (
    <div className="relative space-y-6">
      {toast ? (
        <p
          key={toast}
          className="animate-admin-toast fixed bottom-6 right-6 z-50 max-w-sm rounded-[var(--radius-button)] border-2 border-quizzer-black bg-quizzer-yellow px-4 py-2 text-sm font-semibold text-quizzer-black shadow-[var(--shadow-card)]"
          role="status"
        >
          {toast}
        </p>
      ) : null}
      <h1 className="font-heading animate-admin-fade-in-up text-2xl uppercase text-quizzer-black">
        Quizzes
      </h1>
      {error ? (
        <p className="animate-admin-fade-in-up rounded-[var(--radius-button)] border-2 border-quizzer-red bg-quizzer-white px-3 py-2 text-sm text-quizzer-red">
          {error}
        </p>
      ) : null}

      <section
        className="animate-admin-fade-in-up rounded-[var(--radius-button)] border-[var(--border-thick)] border-quizzer-black bg-quizzer-white p-4 shadow-[var(--shadow-card)]"
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
            className="rounded-[var(--radius-button)] border-2 border-quizzer-black bg-quizzer-yellow px-3 py-1.5 text-xs font-semibold text-quizzer-black shadow-[var(--shadow-button)] hover:translate-x-[1px] hover:translate-y-[1px]"
          >
            {quizFormVisible ? "Cancel" : "+ Add quiz event"}
          </button>
        </div>

        {quizFormVisible ? (
          <div className="animate-admin-fade-in-up mt-4 space-y-3 border-t border-quizzer-black/10 pt-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block text-xs font-medium text-quizzer-black">
                Venue *
                <select
                  value={qVenueId}
                  onChange={(e) => setQVenueId(e.target.value)}
                  className="mt-1 w-full rounded-[var(--radius-button)] border-2 border-quizzer-black bg-quizzer-white px-2 py-1 text-sm outline-none focus:ring-2 focus:ring-quizzer-yellow"
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
                  className="mt-1 w-full rounded-[var(--radius-button)] border-2 border-quizzer-black bg-quizzer-white px-2 py-1 text-sm outline-none focus:ring-2 focus:ring-quizzer-yellow"
                >
                  {DAY_OPTIONS.map((d) => (
                    <option key={d.v} value={d.v}>
                      {d.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-xs font-medium text-quizzer-black">
                Start time (HH:MM) *
                <input
                  type="time"
                  value={qStart}
                  onChange={(e) => setQStart(e.target.value)}
                  className="mt-1 w-full rounded-[var(--radius-button)] border-2 border-quizzer-black bg-quizzer-white px-2 py-1 text-sm outline-none focus:ring-2 focus:ring-quizzer-yellow"
                />
              </label>
              <label className="block text-xs font-medium text-quizzer-black">
                Entry fee (pence)
                <input
                  type="number"
                  inputMode="numeric"
                  min={0}
                  value={qFeePence}
                  onChange={(e) => setQFeePence(e.target.value)}
                  className="mt-1 w-full rounded-[var(--radius-button)] border-2 border-quizzer-black bg-quizzer-white px-2 py-1 text-sm outline-none focus:ring-2 focus:ring-quizzer-yellow"
                />
              </label>
              <label className="block text-xs font-medium text-quizzer-black">
                Fee basis
                <select
                  value={qFeeBasis}
                  onChange={(e) => setQFeeBasis(e.target.value as "per_person" | "per_team")}
                  className="mt-1 w-full rounded-[var(--radius-button)] border-2 border-quizzer-black bg-quizzer-white px-2 py-1 text-sm outline-none focus:ring-2 focus:ring-quizzer-yellow"
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
                  className="mt-1 w-full rounded-[var(--radius-button)] border-2 border-quizzer-black bg-quizzer-white px-2 py-1 text-sm outline-none focus:ring-2 focus:ring-quizzer-yellow"
                >
                  {PRIZE_OPTIONS.map((p) => (
                    <option key={p} value={p}>
                      {p.replace(/_/g, " ")}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <label className="block text-xs font-medium text-quizzer-black">
              Turn-up guidance
              <textarea
                value={qTurnUp}
                onChange={(e) => setQTurnUp(e.target.value)}
                rows={3}
                className="mt-1 w-full rounded-[var(--radius-button)] border-2 border-quizzer-black bg-quizzer-white px-2 py-1 text-sm outline-none focus:ring-2 focus:ring-quizzer-yellow"
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
                className="rounded-[var(--radius-button)] border-2 border-quizzer-black bg-quizzer-yellow px-3 py-1.5 text-xs font-semibold text-quizzer-black shadow-[var(--shadow-button)] hover:translate-x-[1px] hover:translate-y-[1px] disabled:opacity-50"
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
                className="rounded-[var(--radius-button)] border-2 border-quizzer-black/25 bg-quizzer-white px-3 py-1.5 text-xs font-semibold text-quizzer-black"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : null}

        <div className="mt-4 overflow-x-auto">
          <table className="w-full border-collapse text-left text-sm text-quizzer-black">
            <thead>
              <tr className="border-b border-quizzer-black/20 bg-quizzer-cream">
                <th className="px-3 py-2 font-semibold">Venue</th>
                <th className="px-3 py-2 font-semibold">Day</th>
                <th className="px-3 py-2 font-semibold">Time</th>
                <th className="px-3 py-2 font-semibold">Fee</th>
                <th className="px-3 py-2 font-semibold">Prize</th>
                <th className="px-3 py-2 font-semibold">Active</th>
                <th className="px-3 py-2 font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading && quizzes.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-3 py-4 text-quizzer-black/60">
                    Loading…
                  </td>
                </tr>
              ) : quizzes.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-3 py-4 text-quizzer-black/60">
                    No quiz events yet.
                  </td>
                </tr>
              ) : (
                quizzes.map((row, rowIdx) => {
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
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => openEditQuiz(row)}
                            className="rounded-[var(--radius-button)] border-2 border-quizzer-black bg-quizzer-yellow px-2 py-1 text-xs font-semibold text-quizzer-black shadow-[var(--shadow-button)] hover:translate-x-[1px] hover:translate-y-[1px]"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            disabled={quizToggleBusy === row.id || quizDeleteBusy === row.id}
                            onClick={() => void toggleQuizActive(row)}
                            className="rounded-[var(--radius-button)] border-2 border-quizzer-black bg-quizzer-white px-2 py-1 text-xs font-semibold text-quizzer-black shadow-[var(--shadow-button)] hover:translate-x-[1px] hover:translate-y-[1px] disabled:opacity-50"
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
                            className="rounded-[var(--radius-button)] border-2 border-quizzer-black bg-red-600 px-2 py-1 text-xs font-semibold text-white shadow-[var(--shadow-button)] hover:translate-x-[1px] hover:translate-y-[1px] hover:bg-red-700 disabled:opacity-50"
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
      </section>

      <section
        className="animate-admin-fade-in-up rounded-[var(--radius-button)] border-[var(--border-thick)] border-quizzer-black bg-quizzer-white p-4 shadow-[var(--shadow-card)]"
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
            className="rounded-[var(--radius-button)] border-2 border-quizzer-black bg-quizzer-yellow px-3 py-1.5 text-xs font-semibold text-quizzer-black shadow-[var(--shadow-button)] hover:translate-x-[1px] hover:translate-y-[1px]"
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
                className="mt-1 w-full rounded-[var(--radius-button)] border-2 border-quizzer-black bg-quizzer-white px-2 py-1 text-sm outline-none focus:ring-2 focus:ring-quizzer-yellow"
              />
            </label>
            <label className="block text-xs font-medium text-quizzer-black">
              Address
              <input
                type="text"
                value={venueAddress}
                onChange={(e) => setVenueAddress(e.target.value)}
                className="mt-1 w-full rounded-[var(--radius-button)] border-2 border-quizzer-black bg-quizzer-white px-2 py-1 text-sm outline-none focus:ring-2 focus:ring-quizzer-yellow"
              />
            </label>
            <label className="block text-xs font-medium text-quizzer-black">
              City
              <input
                type="text"
                value={venueCity}
                onChange={(e) => setVenueCity(e.target.value)}
                className="mt-1 w-full rounded-[var(--radius-button)] border-2 border-quizzer-black bg-quizzer-white px-2 py-1 text-sm outline-none focus:ring-2 focus:ring-quizzer-yellow"
              />
            </label>
            <label className="block text-xs font-medium text-quizzer-black">
              Postcode
              <input
                type="text"
                value={venuePostcode}
                onChange={(e) => setVenuePostcode(e.target.value)}
                className="mt-1 w-full rounded-[var(--radius-button)] border-2 border-quizzer-black bg-quizzer-white px-2 py-1 text-sm outline-none focus:ring-2 focus:ring-quizzer-yellow"
              />
            </label>
            <label className="block text-xs font-medium text-quizzer-black">
              Borough
              <input
                type="text"
                value={venueBoroughState}
                onChange={(e) => setVenueBoroughState(e.target.value)}
                placeholder="e.g. Hackney"
                className="mt-1 w-full rounded-[var(--radius-button)] border-2 border-quizzer-black bg-quizzer-white px-2 py-1 text-sm outline-none focus:ring-2 focus:ring-quizzer-yellow"
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
                className="mt-1 w-full rounded-[var(--radius-button)] border-2 border-quizzer-black bg-quizzer-white px-2 py-1 text-sm outline-none focus:ring-2 focus:ring-quizzer-yellow"
              />
            </label>

            {editingVenue ? (
              <div className="border-t border-quizzer-black/10 pt-4 space-y-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-quizzer-black">
                  Photos
                </p>
                {imageError ? <p className="text-xs text-red-600">{imageError}</p> : null}
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
                          <img
                            src={urlData.publicUrl}
                            alt={img.alt_text ?? "Venue photo"}
                            className="w-full h-full object-cover"
                          />
                          <button
                            type="button"
                            onClick={() => void deleteVenueImage(editingVenue.id, img)}
                            className="absolute top-1 right-1 rounded bg-red-600 px-1.5 py-0.5 text-[10px] font-bold text-white opacity-0 group-hover:opacity-100 transition-opacity"
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
                className="rounded-[var(--radius-button)] border-2 border-quizzer-black bg-quizzer-yellow px-3 py-1.5 text-xs font-semibold text-quizzer-black shadow-[var(--shadow-button)] hover:translate-x-[1px] hover:translate-y-[1px] disabled:opacity-50"
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
                className="rounded-[var(--radius-button)] border-2 border-quizzer-black/25 bg-quizzer-white px-3 py-1.5 text-xs font-semibold text-quizzer-black"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : null}

        <div className="mt-4 overflow-x-auto">
          <table className="w-full border-collapse text-left text-sm text-quizzer-black">
            <thead>
              <tr className="border-b border-quizzer-black/20 bg-quizzer-cream">
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
                          className="rounded-[var(--radius-button)] border-2 border-quizzer-black bg-quizzer-yellow px-2 py-1 text-xs font-semibold text-quizzer-black shadow-[var(--shadow-button)] hover:translate-x-[1px] hover:translate-y-[1px] disabled:opacity-50"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          disabled={venueDeleteBusy === row.id || venueSaveBusy}
                          onClick={() => void deleteVenue(row)}
                          className="rounded-[var(--radius-button)] border-2 border-quizzer-black bg-red-600 px-2 py-1 text-xs font-semibold text-white shadow-[var(--shadow-button)] hover:translate-x-[1px] hover:translate-y-[1px] hover:bg-red-700 disabled:opacity-50"
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
