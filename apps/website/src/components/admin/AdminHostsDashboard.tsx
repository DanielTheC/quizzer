"use client";

import { createBrowserSupabaseClient } from "@/lib/supabase/browser";
import { captureSupabaseError } from "@/lib/observability/supabaseErrors";
import type { CSSProperties } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

const REFRESH_MS = 60_000;
const USER_ACTIVITY_REFETCH_GAP_MS = 900;

const DAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

type HostRosterRow = {
  host_user_id: string;
  email: string;
  assigned_quiz_count: number;
  sessions_this_month: number;
  payout_this_month_pence: number;
  sessions_all_time: number;
  last_session_date: string | null;
};

type AssignedQuiz = {
  quiz_event_id: string;
  day_of_week: number;
  start_time: string;
  venue_name: string;
  venue_id: string;
  postcode: string | null;
  is_active: boolean;
};

type SessionRow = {
  session_id: string;
  session_date: string;
  venue_name: string;
  venue_id: string;
  team_count: number;
  gross_pence: number;
  fee_pence: number;
  this_month: boolean;
};

type VenueRate = {
  venue_id: string;
  venue_name: string;
  postcode: string | null;
  fee_pence: number;
  notes: string | null;
};

type HostDetail = {
  assigned_quizzes: AssignedQuiz[] | null;
  recent_sessions: SessionRow[] | null;
  venue_rates: VenueRate[] | null;
};

type AllowlistRow = {
  id: string;
  email: string;
  created_at: string;
};

type ApprovedHostRow = {
  id: string;
  full_name: string;
  email: string;
  created_at: string;
  reviewed_at: string | null;
  quiz_event_id: string | null;
};

function formatShortDate(isoDate: string | null) {
  if (!isoDate) return null;
  const d = /^\d{4}-\d{2}-\d{2}$/.test(isoDate) ? new Date(`${isoDate}T12:00:00`) : new Date(isoDate);
  if (Number.isNaN(d.getTime())) return isoDate;
  return d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
}

function formatTime(t: string) {
  const x = t.trim();
  if (/^\d{2}:\d{2}/.test(x)) return x.slice(0, 5);
  return x;
}

function formatGbpPence(pence: number) {
  return `£${(pence / 100).toFixed(2)}`;
}

function formatDateTime(iso: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function normalizeRoster(raw: unknown): HostRosterRow[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((row) => {
    const r = row as Record<string, unknown>;
    const last = r.last_session_date;
    return {
      host_user_id: String(r.host_user_id),
      email: String(r.email ?? ""),
      assigned_quiz_count: Number(r.assigned_quiz_count ?? 0),
      sessions_this_month: Number(r.sessions_this_month ?? 0),
      payout_this_month_pence: Number(r.payout_this_month_pence ?? 0),
      sessions_all_time: Number(r.sessions_all_time ?? 0),
      last_session_date:
        last == null ? null : typeof last === "string" ? last : String(last),
    };
  });
}

function parseHostDetail(raw: unknown): HostDetail {
  const empty: HostDetail = { assigned_quizzes: [], recent_sessions: [], venue_rates: [] };
  if (!raw || typeof raw !== "object") return empty;
  const o = raw as Record<string, unknown>;

  const assigned = o.assigned_quizzes;
  const assigned_quizzes: AssignedQuiz[] = Array.isArray(assigned)
    ? assigned.map((x) => {
        const q = x as Record<string, unknown>;
        return {
          quiz_event_id: String(q.quiz_event_id),
          day_of_week: Number(q.day_of_week ?? 0),
          start_time: String(q.start_time ?? ""),
          venue_name: String(q.venue_name ?? ""),
          venue_id: String(q.venue_id),
          postcode: q.postcode == null ? null : String(q.postcode),
          is_active: Boolean(q.is_active),
        };
      })
    : [];

  const sessions = o.recent_sessions;
  const recent_sessions: SessionRow[] = Array.isArray(sessions)
    ? sessions.map((x) => {
        const s = x as Record<string, unknown>;
        const sd = s.session_date;
        return {
          session_id: String(s.session_id),
          session_date:
            typeof sd === "string" ? sd : sd instanceof Date ? sd.toISOString().slice(0, 10) : String(sd ?? ""),
          venue_name: String(s.venue_name ?? ""),
          venue_id: String(s.venue_id ?? ""),
          team_count: Number(s.team_count ?? 0),
          gross_pence: Number(s.gross_pence ?? 0),
          fee_pence: Number(s.fee_pence ?? 0),
          this_month: Boolean(s.this_month),
        };
      })
    : [];

  const rates = o.venue_rates;
  const venue_rates: VenueRate[] = Array.isArray(rates)
    ? rates.map((x) => {
        const v = x as Record<string, unknown>;
        return {
          venue_id: String(v.venue_id),
          venue_name: String(v.venue_name ?? ""),
          postcode: v.postcode == null ? null : String(v.postcode),
          fee_pence: Number(v.fee_pence ?? 0),
          notes: v.notes == null ? null : String(v.notes),
        };
      })
    : [];

  return { assigned_quizzes, recent_sessions, venue_rates };
}

function AmberWarnIcon({ title }: { title: string }) {
  return (
    <span
      className="inline-flex cursor-help text-amber-600"
      title={title}
      role="img"
      aria-label={title}
    >
      {"\u26A0\uFE0F"}
    </span>
  );
}

export function AdminHostsDashboard() {
  const [roster, setRoster] = useState<HostRosterRow[]>([]);
  const [selectedHostId, setSelectedHostId] = useState<string | null>(null);
  const [detail, setDetail] = useState<HostDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const [allowlist, setAllowlist] = useState<AllowlistRow[]>([]);
  const [approved, setApproved] = useState<ApprovedHostRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [toastError, setToastError] = useState<string | null>(null);
  const [newEmail, setNewEmail] = useState("");
  const [addBusy, setAddBusy] = useState(false);
  const [removeBusy, setRemoveBusy] = useState<string | null>(null);

  const [editingFeeVenueId, setEditingFeeVenueId] = useState<string | null>(null);
  const [feeDraftPounds, setFeeDraftPounds] = useState("");
  const [editingNotesVenueId, setEditingNotesVenueId] = useState<string | null>(null);
  const [notesDraft, setNotesDraft] = useState("");
  const [rateSaveBusy, setRateSaveBusy] = useState<string | null>(null);

  const [showAddRate, setShowAddRate] = useState(false);
  const [newRateVenueId, setNewRateVenueId] = useState("");
  const [newRatePounds, setNewRatePounds] = useState("");
  const [newRateNotes, setNewRateNotes] = useState("");
  const [addRateBusy, setAddRateBusy] = useState(false);

  const initialLoad = useRef(true);
  const loadGenerationRef = useRef(0);
  const detailGenerationRef = useRef(0);
  const lastUserActivityRefetchAtRef = useRef(0);
  const loadAbortRef = useRef<AbortController | null>(null);
  const detailAbortRef = useRef<AbortController | null>(null);

  const loadRoster = useCallback(async () => {
    const gen = ++loadGenerationRef.current;
    loadAbortRef.current?.abort();
    const ac = new AbortController();
    loadAbortRef.current = ac;
    const { signal } = ac;

    if (initialLoad.current) setLoading(true);
    setError(null);
    try {
      const supabase = createBrowserSupabaseClient();
      const [rosterRes, al, ap] = await Promise.all([
        supabase.rpc("operator_host_roster").abortSignal(signal),
        supabase
          .from("host_allowlisted_emails")
          .select("id, email, created_at")
          .order("created_at", { ascending: false })
          .abortSignal(signal),
        supabase
          .from("host_applications")
          .select("id, full_name, email, created_at, reviewed_at, quiz_event_id")
          .eq("status", "approved")
          .order("reviewed_at", { ascending: false })
          .abortSignal(signal),
      ]);

      if (gen !== loadGenerationRef.current) return;

      if (rosterRes.error) {
        captureSupabaseError("operator_host_roster", rosterRes.error);
        throw new Error(rosterRes.error.message);
      }
      if (al.error) {
        captureSupabaseError("admin.host_allowlisted_emails_list", al.error);
        throw new Error(al.error.message);
      }
      if (ap.error) {
        captureSupabaseError("admin.host_applications_approved_list", ap.error);
        throw new Error(ap.error.message);
      }

      setRoster(normalizeRoster(rosterRes.data));
      setAllowlist((al.data ?? []) as AllowlistRow[]);
      setApproved((ap.data ?? []) as ApprovedHostRow[]);
    } catch (e) {
      if (gen !== loadGenerationRef.current) return;
      setError(e instanceof Error ? e.message : "Failed to load hosts data.");
    } finally {
      if (gen === loadGenerationRef.current) {
        setLoading(false);
        initialLoad.current = false;
      }
    }
  }, []);

  const loadDetail = useCallback(async (hostId: string) => {
    const gen = ++detailGenerationRef.current;
    detailAbortRef.current?.abort();
    const ac = new AbortController();
    detailAbortRef.current = ac;
    const { signal } = ac;

    setDetailLoading(true);
    try {
      const supabase = createBrowserSupabaseClient();
      const { data, error: e } = await supabase
        .rpc("operator_host_detail", { p_host_user_id: hostId })
        .abortSignal(signal);

      if (gen !== detailGenerationRef.current) return;
      if (e) {
        captureSupabaseError("operator_host_detail", e, { hostId });
        throw new Error(e.message);
      }
      setDetail(parseHostDetail(data));
    } catch (err) {
      if (gen !== detailGenerationRef.current) return;
      setError(err instanceof Error ? err.message : "Failed to load host detail.");
      setDetail(null);
    } finally {
      if (gen === detailGenerationRef.current) {
        setDetailLoading(false);
      }
    }
  }, []);

  const loadAfterUserActivity = useCallback(() => {
    const now = Date.now();
    if (now - lastUserActivityRefetchAtRef.current < USER_ACTIVITY_REFETCH_GAP_MS) {
      return;
    }
    lastUserActivityRefetchAtRef.current = now;
    void loadRoster();
    if (selectedHostId) void loadDetail(selectedHostId);
  }, [loadRoster, loadDetail, selectedHostId]);

  useEffect(() => {
    void loadRoster();
  }, [loadRoster]);

  useEffect(() => {
    if (!selectedHostId) {
      setDetail(null);
      return;
    }
    void loadDetail(selectedHostId);
  }, [selectedHostId, loadDetail]);

  useEffect(() => {
    return () => {
      loadAbortRef.current?.abort();
      detailAbortRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    const t = setInterval(() => {
      void loadRoster();
      if (selectedHostId) void loadDetail(selectedHostId);
    }, REFRESH_MS);
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
  }, [loadRoster, loadDetail, loadAfterUserActivity, selectedHostId]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 3200);
    return () => window.clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    if (!toastError) return;
    const timer = window.setTimeout(() => setToastError(null), 4200);
    return () => window.clearTimeout(timer);
  }, [toastError]);

  const monthSummary = useMemo(() => {
    if (!detail?.recent_sessions?.length) {
      return { count: 0, owedPence: 0, missingRateCount: 0 };
    }
    const thisMonth = detail.recent_sessions.filter((s) => s.this_month);
    const owedPence = thisMonth.reduce((a, s) => a + s.fee_pence, 0);
    const missingRateCount = thisMonth.filter((s) => s.fee_pence === 0).length;
    return { count: thisMonth.length, owedPence, missingRateCount };
  }, [detail]);

  const venuesNeedingRate = useMemo(() => {
    if (!detail?.assigned_quizzes?.length) return [];
    const rated = new Set((detail.venue_rates ?? []).map((r) => r.venue_id));
    const byVenue = new Map<string, { venue_id: string; venue_name: string; postcode: string | null }>();
    for (const q of detail.assigned_quizzes) {
      if (!q.is_active) continue;
      if (rated.has(q.venue_id)) continue;
      if (!byVenue.has(q.venue_id)) {
        byVenue.set(q.venue_id, {
          venue_id: q.venue_id,
          venue_name: q.venue_name,
          postcode: q.postcode,
        });
      }
    }
    return [...byVenue.values()].sort((a, b) => a.venue_name.localeCompare(b.venue_name));
  }, [detail]);

  async function upsertRate(
    hostId: string,
    venueId: string,
    feePence: number,
    notes: string | null,
  ) {
    setRateSaveBusy(venueId);
    setToastError(null);
    try {
      const supabase = createBrowserSupabaseClient();
      const { error: e } = await supabase.from("host_venue_rates").upsert(
        {
          host_user_id: hostId,
          venue_id: venueId,
          fee_pence: feePence,
          notes: notes?.trim() ? notes.trim() : null,
        },
        { onConflict: "host_user_id,venue_id" },
      );
      if (e) {
        captureSupabaseError("admin.host_venue_rates_upsert", e, { hostId, venueId });
        throw new Error(e.message);
      }
      setToast("Saved.");
      await loadDetail(hostId);
      void loadRoster();
    } catch (e) {
      setToastError(e instanceof Error ? e.message : "Save failed.");
    } finally {
      setRateSaveBusy(null);
    }
  }

  function startEditFee(row: VenueRate) {
    setEditingFeeVenueId(row.venue_id);
    setFeeDraftPounds((row.fee_pence / 100).toFixed(2));
  }

  async function commitFee(hostId: string, row: VenueRate) {
    const parsed = Number.parseFloat(feeDraftPounds);
    if (Number.isNaN(parsed) || parsed < 0) {
      setToastError("Enter a valid fee in pounds.");
      setEditingFeeVenueId(null);
      return;
    }
    setEditingFeeVenueId(null);
    await upsertRate(hostId, row.venue_id, Math.round(parsed * 100), row.notes);
  }

  function startEditNotes(row: VenueRate) {
    setEditingNotesVenueId(row.venue_id);
    setNotesDraft(row.notes ?? "");
  }

  async function commitNotes(hostId: string, row: VenueRate) {
    setEditingNotesVenueId(null);
    await upsertRate(hostId, row.venue_id, row.fee_pence, notesDraft.trim() ? notesDraft.trim() : null);
  }

  async function addNewRate(hostId: string) {
    const vid = newRateVenueId.trim();
    if (!vid) {
      setToastError("Select a venue.");
      return;
    }
    const parsed = Number.parseFloat(newRatePounds);
    if (Number.isNaN(parsed) || parsed < 0) {
      setToastError("Enter a valid fee in pounds.");
      return;
    }
    setAddRateBusy(true);
    setToastError(null);
    try {
      await upsertRate(hostId, vid, Math.round(parsed * 100), newRateNotes.trim() ? newRateNotes.trim() : null);
      setShowAddRate(false);
      setNewRateVenueId("");
      setNewRatePounds("");
      setNewRateNotes("");
    } finally {
      setAddRateBusy(false);
    }
  }

  async function addEmail() {
    const email = newEmail.trim().toLowerCase();
    if (!email) {
      setError("Enter an email address.");
      return;
    }
    setAddBusy(true);
    setError(null);
    try {
      const supabase = createBrowserSupabaseClient();
      const { error: e } = await supabase.from("host_allowlisted_emails").insert({ email });
      if (e) {
        captureSupabaseError("admin.host_allowlisted_emails_insert", e);
        throw new Error(e.message);
      }
      setNewEmail("");
      setToast("Email added to allowlist.");
      void loadRoster();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not add email.");
    } finally {
      setAddBusy(false);
    }
  }

  async function removeEmail(row: AllowlistRow) {
    const ok = window.confirm(`Remove ${row.email} from host allowlist?`);
    if (!ok) return;
    setRemoveBusy(row.id);
    setError(null);
    try {
      const supabase = createBrowserSupabaseClient();
      const { error: e } = await supabase.from("host_allowlisted_emails").delete().eq("id", row.id);
      if (e) {
        captureSupabaseError("admin.host_allowlisted_emails_delete", e, { id: row.id });
        throw new Error(e.message);
      }
      setToast("Removed from allowlist.");
      void loadRoster();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not remove email.");
    } finally {
      setRemoveBusy(null);
    }
  }

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
      {toastError ? (
        <p
          key={toastError}
          className="animate-admin-toast fixed bottom-24 right-6 z-50 max-w-sm rounded-[var(--radius-button)] border-2 border-quizzer-red bg-quizzer-white px-4 py-2 text-sm font-semibold text-quizzer-red shadow-[var(--shadow-card)]"
          role="alert"
        >
          {toastError}
        </p>
      ) : null}

      <div className="flex flex-wrap items-start justify-between gap-4">
        <h1 className="font-heading animate-admin-fade-in-up text-2xl uppercase text-quizzer-black">
          Hosts
        </h1>
        {!selectedHostId ? (
          <button
            type="button"
            disabled={loading}
            onClick={() => void loadRoster()}
            className="rounded-[var(--radius-button)] border-2 border-quizzer-black bg-quizzer-white px-3 py-2 text-sm font-semibold shadow-[var(--shadow-button)] hover:translate-x-[1px] hover:translate-y-[1px] disabled:opacity-50"
            aria-label="Refresh roster"
          >
            {"\u21bb"} Refresh
          </button>
        ) : null}
      </div>

      {error ? (
        <p className="animate-admin-fade-in-up rounded-[var(--radius-button)] border-2 border-quizzer-red bg-quizzer-white px-3 py-2 text-sm text-quizzer-red">
          {error}
        </p>
      ) : null}

      {!selectedHostId ? (
        <>
          <section
            className="animate-admin-fade-in-up rounded-[var(--radius-button)] border-[var(--border-thick)] border-quizzer-black bg-quizzer-white p-4 shadow-[var(--shadow-card)]"
            style={{ "--admin-stagger": "0ms" } as CSSProperties}
          >
            <h2 className="font-heading text-sm uppercase tracking-wide text-quizzer-black">
              Host roster
            </h2>
            <div className="mt-4 overflow-x-auto">
              <table className="w-full border-collapse text-left text-sm text-quizzer-black">
                <thead>
                  <tr className="border-b border-quizzer-black/20 bg-quizzer-cream">
                    <th className="px-3 py-2 font-semibold">Host (email)</th>
                    <th className="px-3 py-2 font-semibold">Assigned quizzes</th>
                    <th className="px-3 py-2 font-semibold">Sessions this month</th>
                    <th className="px-3 py-2 font-semibold">Payout this month</th>
                    <th className="px-3 py-2 font-semibold">All-time sessions</th>
                    <th className="px-3 py-2 font-semibold">Last session</th>
                  </tr>
                </thead>
                <tbody>
                  {loading && roster.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-3 py-4 text-quizzer-black/60">
                        Loading…
                      </td>
                    </tr>
                  ) : roster.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-3 py-4 text-quizzer-black/60">
                        No hosts in roster yet (approved applications with linked auth user).
                      </td>
                    </tr>
                  ) : (
                    roster.map((row, rowIdx) => {
                      const payoutWarn =
                        row.sessions_this_month > 0 && row.payout_this_month_pence === 0;
                      const last = formatShortDate(row.last_session_date);
                      return (
                        <tr
                          key={row.host_user_id}
                          role="button"
                          tabIndex={0}
                          onClick={() => {
                            setError(null);
                            setSelectedHostId(row.host_user_id);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              setError(null);
                              setSelectedHostId(row.host_user_id);
                            }
                          }}
                          className="animate-admin-row cursor-pointer border-b border-quizzer-black/10 hover:bg-quizzer-cream/50"
                          style={
                            {
                              "--admin-row-delay": `${Math.min(rowIdx, 20) * 24}ms`,
                            } as CSSProperties
                          }
                        >
                          <td className="px-3 py-2 font-medium break-all">{row.email}</td>
                          <td className="px-3 py-2 tabular-nums">{row.assigned_quiz_count}</td>
                          <td className="px-3 py-2 tabular-nums">{row.sessions_this_month}</td>
                          <td className="px-3 py-2 tabular-nums">
                            <span className="inline-flex items-center gap-1.5">
                              {formatGbpPence(row.payout_this_month_pence)}
                              {payoutWarn ? (
                                <AmberWarnIcon title="Set venue rates to calculate payout" />
                              ) : null}
                            </span>
                          </td>
                          <td className="px-3 py-2 tabular-nums">{row.sessions_all_time}</td>
                          <td className="px-3 py-2">
                            {last ? last : <span className="text-quizzer-black/45">Never</span>}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <div className="grid gap-6 lg:grid-cols-2">
            <section
              className="animate-admin-fade-in-up flex min-h-[280px] flex-col rounded-[var(--radius-button)] border-[var(--border-thick)] border-quizzer-black bg-quizzer-white p-4 shadow-[var(--shadow-card)]"
              style={{ "--admin-stagger": "40ms" } as CSSProperties}
            >
              <h2 className="flex flex-wrap items-center gap-2 font-heading text-sm uppercase tracking-wide text-quizzer-black">
                Host allowlist
                <span className="rounded-full border-2 border-quizzer-black bg-quizzer-yellow px-2 py-0.5 text-xs font-semibold normal-case tracking-normal">
                  {allowlist.length}
                </span>
              </h2>
              <div className="animate-admin-fade-in-up mt-4 space-y-2 border-t border-quizzer-black/10 pt-4">
                <p className="text-xs font-medium text-quizzer-black">Add email</p>
                <div className="flex flex-wrap gap-2">
                  <input
                    type="email"
                    autoComplete="off"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    placeholder="host@example.com"
                    className="min-w-[200px] flex-1 rounded-[var(--radius-button)] border-2 border-quizzer-black bg-quizzer-white px-2 py-1 text-sm outline-none focus:ring-2 focus:ring-quizzer-yellow"
                  />
                  <button
                    type="button"
                    disabled={addBusy}
                    onClick={() => void addEmail()}
                    className="rounded-[var(--radius-button)] border-2 border-quizzer-black bg-quizzer-yellow px-3 py-1 text-xs font-semibold text-quizzer-black shadow-[var(--shadow-button)] hover:translate-x-[1px] hover:translate-y-[1px] disabled:opacity-50"
                  >
                    {addBusy ? "Adding…" : "Add"}
                  </button>
                </div>
              </div>
              <div className="mt-4 flex-1 space-y-3 overflow-y-auto">
                {loading && allowlist.length === 0 ? (
                  <p className="text-sm text-quizzer-black/60">Loading…</p>
                ) : allowlist.length === 0 ? (
                  <p className="text-sm text-quizzer-black/60">No allowlisted emails yet.</p>
                ) : (
                  allowlist.map((row, rowIdx) => (
                    <div
                      key={row.id}
                      className="animate-admin-row flex flex-wrap items-start justify-between gap-2 rounded-[var(--radius-button)] border-2 border-quizzer-black/15 bg-quizzer-cream/40 p-3"
                      style={
                        { "--admin-row-delay": `${Math.min(rowIdx, 12) * 42}ms` } as CSSProperties
                      }
                    >
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-quizzer-black break-all">{row.email}</p>
                        <p className="text-xs text-quizzer-black/55">Added {formatDateTime(row.created_at)}</p>
                      </div>
                      <button
                        type="button"
                        disabled={removeBusy === row.id}
                        onClick={() => void removeEmail(row)}
                        className="shrink-0 rounded-[var(--radius-button)] border-2 border-quizzer-black bg-quizzer-white px-2 py-1 text-xs font-semibold text-quizzer-black shadow-[var(--shadow-button)] hover:translate-x-[1px] hover:translate-y-[1px] disabled:opacity-50"
                      >
                        {removeBusy === row.id ? "…" : "Remove"}
                      </button>
                    </div>
                  ))
                )}
              </div>
            </section>

            <section
              className="animate-admin-fade-in-up flex min-h-[280px] flex-col rounded-[var(--radius-button)] border-[var(--border-thick)] border-quizzer-black bg-quizzer-white p-4 shadow-[var(--shadow-card)]"
              style={{ "--admin-stagger": "80ms" } as CSSProperties}
            >
              <h2 className="flex flex-wrap items-center gap-2 font-heading text-sm uppercase tracking-wide text-quizzer-black">
                Approved hosts
                <span className="rounded-full border-2 border-quizzer-black bg-quizzer-yellow px-2 py-0.5 text-xs font-semibold normal-case tracking-normal">
                  {approved.length}
                </span>
              </h2>
              <div className="mt-4 flex-1 space-y-3 overflow-y-auto">
                {loading && approved.length === 0 ? (
                  <p className="text-sm text-quizzer-black/60">Loading…</p>
                ) : approved.length === 0 ? (
                  <p className="text-sm text-quizzer-black/60">No approved applications yet.</p>
                ) : (
                  approved.map((row, rowIdx) => (
                    <div
                      key={row.id}
                      className="animate-admin-row rounded-[var(--radius-button)] border-2 border-quizzer-black/15 bg-quizzer-cream/40 p-3"
                      style={
                        { "--admin-row-delay": `${Math.min(rowIdx, 12) * 42}ms` } as CSSProperties
                      }
                    >
                      <p className="font-semibold text-quizzer-black">{row.full_name}</p>
                      <p className="text-xs text-quizzer-black/70 break-all">{row.email}</p>
                      <p className="mt-1 text-xs text-quizzer-black/55">
                        Reviewed {formatDateTime(row.reviewed_at)}
                      </p>
                      <p className="mt-2 text-sm text-quizzer-black/60">
                        {row.quiz_event_id ? (
                          <span className="text-quizzer-black/80">Linked to quiz</span>
                        ) : (
                          <span>No quiz linked</span>
                        )}
                      </p>
                    </div>
                  ))
                )}
              </div>
            </section>
          </div>
        </>
      ) : (
        <div className="space-y-6">
          <button
            type="button"
            onClick={() => {
              setSelectedHostId(null);
              setDetail(null);
              setShowAddRate(false);
              setEditingFeeVenueId(null);
              setEditingNotesVenueId(null);
            }}
            className="rounded-[var(--radius-button)] border-2 border-quizzer-black bg-quizzer-white px-3 py-2 text-sm font-semibold shadow-[var(--shadow-button)] hover:translate-x-[1px] hover:translate-y-[1px]"
          >
            ← All hosts
          </button>

          {detailLoading || !detail ? (
            <p className="text-sm text-quizzer-black/60">Loading host…</p>
          ) : (
            <>
              <div className="rounded-[var(--radius-button)] border-[var(--border-thick)] border-quizzer-black bg-quizzer-cream/40 px-4 py-3 text-sm text-quizzer-black shadow-[var(--shadow-card)]">
                <p className="font-semibold">
                  Month to date: {monthSummary.count} session{monthSummary.count === 1 ? "" : "s"} ·{" "}
                  {formatGbpPence(monthSummary.owedPence)} owed
                </p>
                {monthSummary.missingRateCount > 0 ? (
                  <p className="mt-2 text-amber-800">
                    {"\u26A0\uFE0F"} {monthSummary.missingRateCount} session
                    {monthSummary.missingRateCount === 1 ? "" : "s"} have no rate set — add venue rates
                    below
                  </p>
                ) : null}
              </div>

              <section
                className="rounded-[var(--radius-button)] border-[var(--border-thick)] border-quizzer-black bg-quizzer-white p-4 shadow-[var(--shadow-card)]"
              >
                <h2 className="font-heading text-sm uppercase tracking-wide text-quizzer-black">
                  Assigned quizzes
                </h2>
                <div className="mt-4 overflow-x-auto">
                  <table className="w-full border-collapse text-left text-sm text-quizzer-black">
                    <thead>
                      <tr className="border-b border-quizzer-black/20 bg-quizzer-cream">
                        <th className="px-3 py-2 font-semibold">Venue</th>
                        <th className="px-3 py-2 font-semibold">Postcode</th>
                        <th className="px-3 py-2 font-semibold">Day</th>
                        <th className="px-3 py-2 font-semibold">Time</th>
                        <th className="px-3 py-2 font-semibold">Active</th>
                      </tr>
                    </thead>
                    <tbody>
                      {!detail.assigned_quizzes?.length ? (
                        <tr>
                          <td colSpan={5} className="px-3 py-4 text-quizzer-black/60">
                            No approved quiz assignments.
                          </td>
                        </tr>
                      ) : (
                        detail.assigned_quizzes.map((q) => {
                          const dow =
                            q.day_of_week >= 0 && q.day_of_week < DAY_SHORT.length
                              ? DAY_SHORT[q.day_of_week]
                              : String(q.day_of_week);
                          return (
                            <tr key={q.quiz_event_id} className="border-b border-quizzer-black/10">
                              <td className="px-3 py-2 font-medium">{q.venue_name}</td>
                              <td className="px-3 py-2">{q.postcode ?? "—"}</td>
                              <td className="px-3 py-2">{dow}</td>
                              <td className="px-3 py-2">{formatTime(q.start_time)}</td>
                              <td className="px-3 py-2">
                                {q.is_active ? (
                                  <span className="text-green-700" aria-label="Active">
                                    {"\u2713"}
                                  </span>
                                ) : (
                                  <span className="text-quizzer-black/35">–</span>
                                )}
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
                className="rounded-[var(--radius-button)] border-[var(--border-thick)] border-quizzer-black bg-quizzer-white p-4 shadow-[var(--shadow-card)]"
              >
                <h2 className="font-heading text-sm uppercase tracking-wide text-quizzer-black">
                  Session history
                </h2>
                <div className="mt-4 overflow-x-auto">
                  <table className="w-full border-collapse text-left text-sm text-quizzer-black">
                    <thead>
                      <tr className="border-b border-quizzer-black/20 bg-quizzer-cream">
                        <th className="px-3 py-2 font-semibold">Date</th>
                        <th className="px-3 py-2 font-semibold">Venue</th>
                        <th className="px-3 py-2 font-semibold">Teams</th>
                        <th className="px-3 py-2 font-semibold">Gross (player fees)</th>
                        <th className="px-3 py-2 font-semibold">Host fee</th>
                        <th className="px-3 py-2 font-semibold">This month?</th>
                      </tr>
                    </thead>
                    <tbody>
                      {!detail.recent_sessions?.length ? (
                        <tr>
                          <td colSpan={6} className="px-3 py-4 text-quizzer-black/60">
                            No sessions recorded yet.
                          </td>
                        </tr>
                      ) : (
                        [...detail.recent_sessions]
                          .sort((a, b) => b.session_date.localeCompare(a.session_date))
                          .map((s) => (
                            <tr key={s.session_id} className="border-b border-quizzer-black/10">
                              <td className="px-3 py-2">{formatShortDate(s.session_date) ?? "—"}</td>
                              <td className="px-3 py-2 font-medium">{s.venue_name || "—"}</td>
                              <td className="px-3 py-2 tabular-nums">{s.team_count}</td>
                              <td className="px-3 py-2 tabular-nums">{formatGbpPence(s.gross_pence)}</td>
                              <td className="px-3 py-2 tabular-nums">
                                {s.fee_pence > 0 ? (
                                  formatGbpPence(s.fee_pence)
                                ) : (
                                  <span
                                    className="inline-flex items-center gap-1 text-quizzer-black/45"
                                    title="No venue rate set"
                                  >
                                    —
                                    <span className="h-2 w-2 rounded-full bg-amber-500" aria-hidden />
                                  </span>
                                )}
                              </td>
                              <td className="px-3 py-2">
                                {s.this_month ? (
                                  <span className="rounded-full border border-green-700 bg-green-50 px-2 py-0.5 text-xs font-semibold text-green-800">
                                    This month
                                  </span>
                                ) : null}
                              </td>
                            </tr>
                          ))
                      )}
                    </tbody>
                  </table>
                </div>
              </section>

              <section
                className="rounded-[var(--radius-button)] border-[var(--border-thick)] border-quizzer-black bg-quizzer-white p-4 shadow-[var(--shadow-card)]"
              >
                <h2 className="font-heading text-sm uppercase tracking-wide text-quizzer-black">
                  Venue pay rates
                </h2>
                <div className="mt-4 overflow-x-auto">
                  <table className="w-full border-collapse text-left text-sm text-quizzer-black">
                    <thead>
                      <tr className="border-b border-quizzer-black/20 bg-quizzer-cream">
                        <th className="px-3 py-2 font-semibold">Venue</th>
                        <th className="px-3 py-2 font-semibold">Postcode</th>
                        <th className="px-3 py-2 font-semibold">Fee per session</th>
                        <th className="px-3 py-2 font-semibold">Notes</th>
                        <th className="px-3 py-2 font-semibold">Edit</th>
                      </tr>
                    </thead>
                    <tbody>
                      {!detail.venue_rates?.length ? (
                        <tr>
                          <td colSpan={5} className="px-3 py-4 text-quizzer-black/60">
                            No venue rates yet. Add one below.
                          </td>
                        </tr>
                      ) : (
                        detail.venue_rates.map((row) => (
                          <tr key={row.venue_id} className="border-b border-quizzer-black/10">
                            <td className="px-3 py-2 font-medium">{row.venue_name}</td>
                            <td className="px-3 py-2">{row.postcode ?? "—"}</td>
                            <td className="px-3 py-2">
                              {editingFeeVenueId === row.venue_id ? (
                                <input
                                  type="number"
                                  min={0}
                                  step="0.01"
                                  value={feeDraftPounds}
                                  autoFocus
                                  onChange={(e) => setFeeDraftPounds(e.target.value)}
                                  onBlur={() => {
                                    if (selectedHostId) void commitFee(selectedHostId, row);
                                  }}
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter" && selectedHostId) void commitFee(selectedHostId, row);
                                  }}
                                  className="w-28 rounded-[var(--radius-button)] border-2 border-quizzer-black px-2 py-1 text-sm"
                                />
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => startEditFee(row)}
                                  className="text-left font-semibold tabular-nums underline decoration-dotted underline-offset-2 hover:opacity-80"
                                >
                                  {formatGbpPence(row.fee_pence)}
                                </button>
                              )}
                            </td>
                            <td className="max-w-xs px-3 py-2">
                              {editingNotesVenueId === row.venue_id ? (
                                <input
                                  type="text"
                                  value={notesDraft}
                                  autoFocus
                                  onChange={(e) => setNotesDraft(e.target.value)}
                                  onBlur={() => {
                                    if (selectedHostId) void commitNotes(selectedHostId, row);
                                  }}
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter" && selectedHostId) void commitNotes(selectedHostId, row);
                                  }}
                                  className="w-full rounded-[var(--radius-button)] border-2 border-quizzer-black px-2 py-1 text-sm"
                                />
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => startEditNotes(row)}
                                  className="w-full truncate text-left text-sm underline decoration-dotted underline-offset-2 hover:opacity-80"
                                >
                                  {row.notes?.trim() ? row.notes : "—"}
                                </button>
                              )}
                            </td>
                            <td className="px-3 py-2 text-xs text-quizzer-black/60">
                              {rateSaveBusy === row.venue_id ? "Saving…" : "Click field"}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

                {!showAddRate ? (
                  <button
                    type="button"
                    onClick={() => {
                      setShowAddRate(true);
                      setNewRateVenueId(venuesNeedingRate[0]?.venue_id ?? "");
                    }}
                    className="mt-4 rounded-[var(--radius-button)] border-2 border-quizzer-black bg-quizzer-yellow px-3 py-1.5 text-xs font-semibold text-quizzer-black shadow-[var(--shadow-button)] hover:translate-x-[1px] hover:translate-y-[1px]"
                  >
                    + Add venue rate
                  </button>
                ) : (
                  <div className="mt-4 flex flex-wrap items-end gap-3 rounded-[var(--radius-button)] border-2 border-quizzer-black/20 bg-quizzer-cream/30 p-3">
                    <label className="block text-xs font-medium text-quizzer-black">
                      Venue
                      <select
                        value={newRateVenueId}
                        onChange={(e) => setNewRateVenueId(e.target.value)}
                        className="mt-1 block w-56 rounded-[var(--radius-button)] border-2 border-quizzer-black bg-quizzer-white px-2 py-1 text-sm"
                      >
                        <option value="">Select venue</option>
                        {venuesNeedingRate.map((v) => (
                          <option key={v.venue_id} value={v.venue_id}>
                            {v.venue_name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="block text-xs font-medium text-quizzer-black">
                      Fee (£)
                      <input
                        type="number"
                        min={0}
                        step="0.01"
                        value={newRatePounds}
                        onChange={(e) => setNewRatePounds(e.target.value)}
                        className="mt-1 block w-28 rounded-[var(--radius-button)] border-2 border-quizzer-black bg-quizzer-white px-2 py-1 text-sm"
                      />
                    </label>
                    <label className="block min-w-[160px] flex-1 text-xs font-medium text-quizzer-black">
                      Notes
                      <input
                        type="text"
                        value={newRateNotes}
                        onChange={(e) => setNewRateNotes(e.target.value)}
                        className="mt-1 w-full rounded-[var(--radius-button)] border-2 border-quizzer-black bg-quizzer-white px-2 py-1 text-sm"
                      />
                    </label>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        disabled={addRateBusy || venuesNeedingRate.length === 0}
                        onClick={() => selectedHostId && void addNewRate(selectedHostId)}
                        className="rounded-[var(--radius-button)] border-2 border-quizzer-black bg-quizzer-yellow px-3 py-1.5 text-xs font-semibold text-quizzer-black shadow-[var(--shadow-button)] hover:translate-x-[1px] hover:translate-y-[1px] disabled:opacity-50"
                      >
                        {addRateBusy ? "Saving…" : "Save"}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setShowAddRate(false);
                          setNewRateVenueId("");
                          setNewRatePounds("");
                          setNewRateNotes("");
                        }}
                        className="rounded-[var(--radius-button)] border-2 border-quizzer-black/25 bg-quizzer-white px-3 py-1.5 text-xs font-semibold text-quizzer-black"
                      >
                        Cancel
                      </button>
                    </div>
                    {venuesNeedingRate.length === 0 ? (
                      <p className="w-full text-xs text-quizzer-black/60">
                        All assigned active venues already have a rate (or no active assignments).
                      </p>
                    ) : null}
                  </div>
                )}
              </section>
            </>
          )}
        </div>
      )}
    </div>
  );
}
