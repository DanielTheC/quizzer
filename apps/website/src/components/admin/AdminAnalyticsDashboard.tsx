"use client";

import { createBrowserSupabaseClient } from "@/lib/supabase/browser";
import { captureSupabaseError } from "@/lib/observability/supabaseErrors";
import type { CSSProperties } from "react";
import { Fragment, useCallback, useEffect, useRef, useState } from "react";

const DAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

export type NetworkSummary = {
  active_quiz_count: number;
  total_interests: number;
  teams_last_7d: number;
  gross_last_7d_pence: number;
};

type VenueStat = {
  venue_id: string;
  venue_name: string;
  postcode: string | null;
  active_quiz_count: number;
  interest_count: number;
  teams_last_7d: number;
  gross_last_7d_pence: number;
  last_session_date: string | null;
};

type RecentSession = {
  session_id: string;
  session_date: string;
  venue_name: string;
  quiz_event_id: string;
  day_of_week: number;
  start_time: string;
  team_count: number;
  gross_pence: number;
};

type VenueQuizRow = {
  id: string;
  day_of_week: number;
  start_time: string;
  prize: string | null;
  is_active: boolean;
  interest_count: number;
};

function formatShortDate(isoDate: string) {
  const d = /^\d{4}-\d{2}-\d{2}$/.test(isoDate) ? new Date(`${isoDate}T12:00:00`) : new Date(isoDate);
  if (Number.isNaN(d.getTime())) return isoDate;
  return d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
}

function formatTime(t: string) {
  const x = t.trim();
  if (/^\d{2}:\d{2}/.test(x)) return x.slice(0, 5);
  return x;
}

function formatPrizeDisplay(p: string | null) {
  if (!p) return "—";
  return p.replace(/_/g, " ");
}

function formatGbpPence(pence: number) {
  return `£${(pence / 100).toFixed(2)}`;
}

function rowInterestCount(raw: { quiz_event_interests?: unknown }): number {
  const x = raw.quiz_event_interests;
  if (Array.isArray(x) && x.length > 0) {
    const c = (x[0] as { count?: number }).count;
    return typeof c === "number" ? c : 0;
  }
  if (x && typeof x === "object" && "count" in x) {
    const c = (x as { count: number }).count;
    return typeof c === "number" ? c : 0;
  }
  return 0;
}

function normalizeNetworkSummary(raw: unknown): NetworkSummary | null {
  if (!Array.isArray(raw) || raw.length === 0) return null;
  const r = raw[0] as Record<string, unknown>;
  return {
    active_quiz_count: Number(r.active_quiz_count ?? 0),
    total_interests: Number(r.total_interests ?? 0),
    teams_last_7d: Number(r.teams_last_7d ?? 0),
    gross_last_7d_pence: Number(r.gross_last_7d_pence ?? 0),
  };
}

function normalizeVenueStats(raw: unknown): VenueStat[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((row) => {
    const r = row as Record<string, unknown>;
    const last = r.last_session_date;
    return {
      venue_id: String(r.venue_id),
      venue_name: String(r.venue_name ?? ""),
      postcode: r.postcode == null ? null : String(r.postcode),
      active_quiz_count: Number(r.active_quiz_count ?? 0),
      interest_count: Number(r.interest_count ?? 0),
      teams_last_7d: Number(r.teams_last_7d ?? 0),
      gross_last_7d_pence: Number(r.gross_last_7d_pence ?? 0),
      last_session_date:
        last == null
          ? null
          : typeof last === "string"
            ? last
            : String(last),
    };
  });
}

function normalizeRecentSessions(raw: unknown): RecentSession[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((row) => {
    const r = row as Record<string, unknown>;
    const sd = r.session_date;
    const session_date =
      typeof sd === "string" ? sd : sd instanceof Date ? sd.toISOString().slice(0, 10) : String(sd ?? "");
    const qid = r.quiz_event_id;
    return {
      session_id: String(r.session_id),
      session_date,
      venue_name: String(r.venue_name ?? ""),
      quiz_event_id: qid == null ? "" : String(qid),
      day_of_week: Number(r.day_of_week ?? 0),
      start_time: String(r.start_time ?? ""),
      team_count: Number(r.team_count ?? 0),
      gross_pence: Number(r.gross_pence ?? 0),
    };
  });
}

function showDash7d(value: number, lastSessionDate: string | null): boolean {
  return value === 0 && lastSessionDate == null;
}

export function AdminAnalyticsDashboard() {
  const [summary, setSummary] = useState<NetworkSummary | null>(null);
  const [venues, setVenues] = useState<VenueStat[]>([]);
  const [sessions, setSessions] = useState<RecentSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [expandedVenueId, setExpandedVenueId] = useState<string | null>(null);
  const [venueQuizzes, setVenueQuizzes] = useState<Record<string, VenueQuizRow[]>>({});
  const [venueQuizzesLoading, setVenueQuizzesLoading] = useState<string | null>(null);
  const [venueQuizzesErrors, setVenueQuizzesErrors] = useState<Record<string, string>>({});

  const loadGenerationRef = useRef(0);
  const loadAbortRef = useRef<AbortController | null>(null);
  const expandAbortRef = useRef<AbortController | null>(null);

  const load = useCallback(async () => {
    const gen = ++loadGenerationRef.current;
    loadAbortRef.current?.abort();
    const ac = new AbortController();
    loadAbortRef.current = ac;
    const { signal } = ac;

    setLoading(true);
    setError(null);
    try {
      const supabase = createBrowserSupabaseClient();
      const [summaryRes, venueRes, sessionsRes] = await Promise.all([
        supabase.rpc("operator_network_summary").abortSignal(signal),
        supabase.rpc("operator_venue_stats").abortSignal(signal),
        supabase.rpc("operator_recent_sessions").abortSignal(signal),
      ]);

      if (gen !== loadGenerationRef.current) return;

      if (summaryRes.error) {
        captureSupabaseError("operator_network_summary", summaryRes.error);
        throw new Error(summaryRes.error.message);
      }
      if (venueRes.error) {
        captureSupabaseError("operator_venue_stats", venueRes.error);
        throw new Error(venueRes.error.message);
      }
      if (sessionsRes.error) {
        captureSupabaseError("operator_recent_sessions", sessionsRes.error);
        throw new Error(sessionsRes.error.message);
      }

      setSummary(normalizeNetworkSummary(summaryRes.data));
      setVenues(normalizeVenueStats(venueRes.data));
      setSessions(normalizeRecentSessions(sessionsRes.data));
    } catch (e) {
      if (gen !== loadGenerationRef.current) return;
      setError(e instanceof Error ? e.message : "Failed to load analytics.");
    } finally {
      if (gen === loadGenerationRef.current) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    return () => {
      loadAbortRef.current?.abort();
      expandAbortRef.current?.abort();
    };
  }, []);

  const fetchVenueQuizzes = useCallback(async (venueId: string) => {
    expandAbortRef.current?.abort();
    const ac = new AbortController();
    expandAbortRef.current = ac;
    const { signal } = ac;

    setVenueQuizzesLoading(venueId);
    setVenueQuizzesErrors((prev) => {
      const next = { ...prev };
      delete next[venueId];
      return next;
    });
    try {
      const supabase = createBrowserSupabaseClient();
      const { data, error: e } = await supabase
        .from("quiz_events")
        .select("id, day_of_week, start_time, prize, is_active, quiz_event_interests(count)")
        .eq("venue_id", venueId)
        .order("day_of_week", { ascending: true })
        .abortSignal(signal);

      if (e) {
        captureSupabaseError("admin.analytics.venue_quizzes", e, { venueId });
        throw new Error(e.message);
      }

      const rows: VenueQuizRow[] = (data ?? []).map((raw) => ({
        id: String((raw as { id: string }).id),
        day_of_week: Number((raw as { day_of_week: number }).day_of_week),
        start_time: String((raw as { start_time: string }).start_time),
        prize: (raw as { prize: string | null }).prize ?? null,
        is_active: Boolean((raw as { is_active: boolean }).is_active),
        interest_count: rowInterestCount(raw as { quiz_event_interests?: unknown }),
      }));

      setVenueQuizzes((prev) => ({ ...prev, [venueId]: rows }));
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") return;
      const msg = err instanceof Error ? err.message : "Could not load quizzes.";
      setVenueQuizzesErrors((prev) => ({ ...prev, [venueId]: msg }));
    } finally {
      setVenueQuizzesLoading((busy) => (busy === venueId ? null : busy));
    }
  }, []);

  function toggleVenueRow(venueId: string) {
    if (expandedVenueId === venueId) {
      setExpandedVenueId(null);
      return;
    }
    setExpandedVenueId(venueId);
    if (!venueQuizzes[venueId]) {
      void fetchVenueQuizzes(venueId);
    }
  }

  return (
    <div className="relative space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <h1 className="font-heading animate-admin-fade-in-up text-2xl uppercase text-quizzer-black">
          Analytics
        </h1>
        <button
          type="button"
          disabled={loading}
          onClick={() => void load()}
          className="rounded-[var(--radius-button)] border-[3px] border-quizzer-black bg-quizzer-white px-3 py-2 text-sm font-semibold shadow-[var(--shadow-button)] hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[var(--shadow-button-hover)] disabled:opacity-50"
          aria-label="Refresh analytics"
        >
          {"\u21bb"} Refresh
        </button>
      </div>

      {error ? (
        <p className="animate-admin-fade-in-up rounded-[var(--radius-button)] border-[3px] border-quizzer-red bg-quizzer-cream px-3 py-2 text-sm text-quizzer-red">
          {error}
        </p>
      ) : null}

      {loading && !summary ? (
        <div className="space-y-2" aria-hidden>
          <div className="h-10 animate-pulse rounded-[var(--radius-button)] bg-quizzer-black/15" />
          <div className="h-10 animate-pulse rounded-[var(--radius-button)] bg-quizzer-black/15" />
          <div className="h-10 animate-pulse rounded-[var(--radius-button)] bg-quizzer-black/15" />
        </div>
      ) : null}

      {summary ? (
        <section
          className="animate-admin-fade-in-up grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
          style={{ "--admin-stagger": "0ms" } as CSSProperties}
        >
          <div className="rounded-[var(--radius-button)] border-[3px] border-quizzer-black bg-quizzer-white p-4 text-center shadow-[var(--shadow-card)]">
            <p className="font-heading text-3xl tabular-nums text-quizzer-black">
              {summary.active_quiz_count}
            </p>
            <p className="mt-2 text-xs font-semibold uppercase tracking-wide text-quizzer-black/70">
              Active quiz events
            </p>
          </div>
          <div className="rounded-[var(--radius-button)] border-[3px] border-quizzer-black bg-quizzer-white p-4 text-center shadow-[var(--shadow-card)]">
            <p className="font-heading text-3xl tabular-nums text-quizzer-black">
              {summary.total_interests}
            </p>
            <p className="mt-2 text-xs font-semibold uppercase tracking-wide text-quizzer-black/70">
              Total interests
            </p>
          </div>
          <div className="rounded-[var(--radius-button)] border-[3px] border-quizzer-black bg-quizzer-white p-4 text-center shadow-[var(--shadow-card)]">
            <p className="font-heading text-3xl tabular-nums text-quizzer-black">
              {summary.teams_last_7d}
            </p>
            <p className="mt-2 text-xs font-semibold uppercase tracking-wide text-quizzer-black/70">
              Teams (7 days)
            </p>
          </div>
          <div className="rounded-[var(--radius-button)] border-[3px] border-quizzer-black bg-quizzer-white p-4 text-center shadow-[var(--shadow-card)]">
            <p className="font-heading text-3xl tabular-nums text-quizzer-black">
              {formatGbpPence(summary.gross_last_7d_pence)}
            </p>
            <p className="mt-2 text-xs font-semibold uppercase tracking-wide text-quizzer-black/70">
              Revenue (7 days)
            </p>
          </div>
        </section>
      ) : null}

      <section
        className="animate-admin-fade-in-up rounded-[var(--radius-button)] border-[3px] border-quizzer-black bg-quizzer-white p-4 shadow-[var(--shadow-card)]"
        style={{ "--admin-stagger": "50ms" } as CSSProperties}
      >
        <h2 className="font-heading text-sm uppercase tracking-wide text-quizzer-black">
          Venue performance
        </h2>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full border-collapse text-left text-sm text-quizzer-black">
            <thead>
              <tr className="border-b-[3px] border-quizzer-black bg-quizzer-cream">
                <th className="w-8 px-2 py-2" aria-hidden />
                <th className="px-3 py-2 font-semibold">Venue</th>
                <th className="px-3 py-2 font-semibold">Postcode</th>
                <th className="px-3 py-2 font-semibold">Active quizzes</th>
                <th className="px-3 py-2 font-semibold">Total interests</th>
                <th className="px-3 py-2 font-semibold">Teams (7d)</th>
                <th className="px-3 py-2 font-semibold">Revenue (7d)</th>
                <th className="px-3 py-2 font-semibold">Last session</th>
              </tr>
            </thead>
            <tbody>
              {loading && venues.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-3 py-4 text-quizzer-black/60">
                    Loading…
                  </td>
                </tr>
              ) : venues.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-3 py-4 text-quizzer-black/60">
                    No venues.
                  </td>
                </tr>
              ) : (
                venues.map((row, rowIdx) => {
                  const expanded = expandedVenueId === row.venue_id;
                  const warnNoSubmission =
                    row.active_quiz_count > 0 && row.teams_last_7d === 0;
                  const teamsCell = showDash7d(row.teams_last_7d, row.last_session_date)
                    ? "—"
                    : String(row.teams_last_7d);
                  const revCell = showDash7d(row.gross_last_7d_pence, row.last_session_date)
                    ? "—"
                    : formatGbpPence(row.gross_last_7d_pence);
                  const lastSess =
                    row.last_session_date == null || row.last_session_date === ""
                      ? null
                      : formatShortDate(row.last_session_date);
                  return (
                    <Fragment key={row.venue_id}>
                      <tr
                        className={`animate-admin-row border-b border-quizzer-black/10 ${
                          warnNoSubmission ? "border-l-[3px] border-l-quizzer-orange" : ""
                        }`}
                        style={
                          {
                            "--admin-row-delay": `${Math.min(rowIdx, 20) * 24}ms`,
                          } as CSSProperties
                        }
                      >
                        <td className="px-2 py-2 align-top">
                          <button
                            type="button"
                            onClick={() => toggleVenueRow(row.venue_id)}
                            className="rounded-[var(--radius-badge)] border-[3px] border-quizzer-black bg-quizzer-cream/50 px-1.5 py-0.5 text-xs font-semibold text-quizzer-black shadow-[var(--shadow-button)] hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[var(--shadow-button-hover)]"
                            aria-expanded={expanded}
                            aria-label={expanded ? "Collapse venue" : "Expand venue"}
                          >
                            {expanded ? "\u25bc" : "\u25b6"}
                          </button>
                        </td>
                        <td className="px-3 py-2 font-medium">{row.venue_name}</td>
                        <td className="px-3 py-2">{row.postcode ?? "—"}</td>
                        <td className="px-3 py-2 tabular-nums">{row.active_quiz_count}</td>
                        <td className="px-3 py-2 tabular-nums">{row.interest_count}</td>
                        <td className="px-3 py-2 tabular-nums">{teamsCell}</td>
                        <td className="px-3 py-2 tabular-nums">{revCell}</td>
                        <td className="px-3 py-2">
                          {lastSess ? (
                            lastSess
                          ) : (
                            <span className="text-quizzer-black/45">Never</span>
                          )}
                        </td>
                      </tr>
                      {expanded ? (
                        <tr key={`${row.venue_id}-detail`} className="border-b border-quizzer-black/10 bg-quizzer-cream/30">
                          <td colSpan={8} className="px-3 py-3">
                            {venueQuizzesLoading === row.venue_id ? (
                              <p className="text-sm text-quizzer-black/60">Loading quizzes…</p>
                            ) : venueQuizzesErrors[row.venue_id] ? (
                              <p className="text-sm text-quizzer-red">{venueQuizzesErrors[row.venue_id]}</p>
                            ) : (
                              <div className="overflow-x-auto">
                                <table className="w-full border-collapse text-left text-xs text-quizzer-black">
                                  <thead>
                                    <tr className="border-b-[3px] border-quizzer-black bg-quizzer-cream/50">
                                      <th className="py-2 pr-3 font-semibold">Quiz</th>
                                      <th className="py-2 pr-3 font-semibold">Day / time</th>
                                      <th className="py-2 pr-3 font-semibold">Interests</th>
                                      <th className="py-2 font-semibold">Active</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {(venueQuizzes[row.venue_id] ?? []).length === 0 ? (
                                      <tr>
                                        <td colSpan={4} className="py-2 text-quizzer-black/60">
                                          No quiz events for this venue.
                                        </td>
                                      </tr>
                                    ) : (
                                      (venueQuizzes[row.venue_id] ?? []).map((q) => {
                                        const dow =
                                          q.day_of_week >= 0 && q.day_of_week < DAY_SHORT.length
                                            ? DAY_SHORT[q.day_of_week]
                                            : String(q.day_of_week);
                                        return (
                                          <tr key={q.id} className="border-b border-quizzer-black/10">
                                            <td className="py-2 pr-3 font-medium">
                                              {formatPrizeDisplay(q.prize)}
                                            </td>
                                            <td className="py-2 pr-3">
                                              {dow} {formatTime(q.start_time)}
                                            </td>
                                            <td className="py-2 pr-3 tabular-nums">{q.interest_count}</td>
                                            <td className="py-2">{q.is_active ? "Yes" : "No"}</td>
                                          </tr>
                                        );
                                      })
                                    )}
                                  </tbody>
                                </table>
                              </div>
                            )}
                          </td>
                        </tr>
                      ) : null}
                    </Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section
        className="animate-admin-fade-in-up rounded-[var(--radius-button)] border-[3px] border-quizzer-black bg-quizzer-white p-4 shadow-[var(--shadow-card)]"
        style={{ "--admin-stagger": "100ms" } as CSSProperties}
      >
        <h2 className="font-heading text-sm uppercase tracking-wide text-quizzer-black">
          Recent sessions
        </h2>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full border-collapse text-left text-sm text-quizzer-black">
            <thead>
              <tr className="border-b-[3px] border-quizzer-black bg-quizzer-cream">
                <th className="px-3 py-2 font-semibold">Date</th>
                <th className="px-3 py-2 font-semibold">Venue</th>
                <th className="px-3 py-2 font-semibold">Day / time</th>
                <th className="px-3 py-2 font-semibold">Teams</th>
                <th className="px-3 py-2 font-semibold">Gross</th>
              </tr>
            </thead>
            <tbody>
              {loading && sessions.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-3 py-4 text-quizzer-black/60">
                    Loading…
                  </td>
                </tr>
              ) : sessions.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-3 py-4 text-quizzer-black/60">
                    No sessions recorded in the last 14 days.
                  </td>
                </tr>
              ) : (
                sessions.map((s, rowIdx) => {
                  const dow =
                    s.quiz_event_id && s.day_of_week >= 0 && s.day_of_week < DAY_SHORT.length
                      ? DAY_SHORT[s.day_of_week]
                      : null;
                  const slot =
                    dow && s.start_time
                      ? `${dow} ${formatTime(s.start_time)}`
                      : "—";
                  return (
                    <tr
                      key={s.session_id}
                      className="animate-admin-row border-b border-quizzer-black/10"
                      style={
                        {
                          "--admin-row-delay": `${Math.min(rowIdx, 20) * 24}ms`,
                        } as CSSProperties
                      }
                    >
                      <td className="px-3 py-2">{formatShortDate(s.session_date)}</td>
                      <td className="px-3 py-2 font-medium">{s.venue_name || "—"}</td>
                      <td className="px-3 py-2">{slot}</td>
                      <td className="px-3 py-2 tabular-nums">{s.team_count}</td>
                      <td className="px-3 py-2 tabular-nums">{formatGbpPence(s.gross_pence)}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
