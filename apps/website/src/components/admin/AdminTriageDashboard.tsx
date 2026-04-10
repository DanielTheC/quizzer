"use client";

import { createBrowserSupabaseClient } from "@/lib/supabase/browser";
import { captureSupabaseError } from "@/lib/observability/supabaseErrors";
import type { CSSProperties } from "react";
import { useCallback, useEffect, useRef, useState } from "react";

const REFRESH_MS = 60_000;
/** Tab return often fires both `visibilitychange` and `window` `focus` within milliseconds. */
const USER_ACTIVITY_REFETCH_GAP_MS = 900;

/** Postgres / JS convention: 0 = Sunday … 6 = Saturday (matches EXTRACT(DOW)). */
const DAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
] as const;

const EMPTY_COPY = "Nothing to action.";

function daysSinceCreated(iso: string): number {
  const c = new Date(iso);
  const start = new Date(c.getFullYear(), c.getMonth(), c.getDate());
  const n = new Date();
  const end = new Date(n.getFullYear(), n.getMonth(), n.getDate());
  return Math.max(0, Math.round((end.getTime() - start.getTime()) / 86_400_000));
}

function formatNextOccurrence(d: string) {
  const x = d.trim();
  if (!x) return "—";
  const parsed = /^\d{4}-\d{2}-\d{2}$/.test(x)
    ? new Date(`${x}T12:00:00`)
    : new Date(x);
  if (Number.isNaN(parsed.getTime())) return x;
  return parsed.toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

type HostApplication = {
  id: string;
  full_name: string;
  email: string;
  experience_notes: string;
  created_at: string;
  status: string;
};

type PublicanMessageRow = {
  id: string;
  venue_id: string;
  message_type: string;
  body: string;
  status: string;
  created_at: string;
  operator_reply: string | null;
  resolved_at: string | null;
  venues: { name: string } | null;
};

type UnhostedQuiz = {
  quiz_event_id: string;
  venue_id: string;
  venue_name: string;
  day_of_week: number;
  start_time: string;
  interest_count: number;
  next_occurrence: string;
};

function snippet(s: string, n: number) {
  const t = s.trim();
  if (t.length <= n) return t;
  return `${t.slice(0, n)}…`;
}

function formatTime(t: string) {
  const x = t.trim();
  if (/^\d{2}:\d{2}/.test(x)) return x.slice(0, 5);
  return x;
}

function venueFromEmbed(
  venues: { name: string } | { name: string }[] | null,
): { name: string } | null {
  if (!venues) return null;
  return Array.isArray(venues) ? (venues[0] ?? null) : venues;
}

function normalizePublicanRows(raw: unknown): PublicanMessageRow[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((r) => {
    const row = r as Omit<PublicanMessageRow, "venues"> & {
      venues: { name: string } | { name: string }[] | null;
    };
    return { ...row, venues: venueFromEmbed(row.venues) };
  });
}

export function AdminTriageDashboard() {
  const [apps, setApps] = useState<HostApplication[]>([]);
  const [msgs, setMsgs] = useState<PublicanMessageRow[]>([]);
  const [unhosted, setUnhosted] = useState<UnhostedQuiz[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [approveBusy, setApproveBusy] = useState<string | null>(null);
  const [rejectExpanded, setRejectExpanded] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [rejectBusy, setRejectBusy] = useState<string | null>(null);
  const [msgExpanded, setMsgExpanded] = useState<string | null>(null);
  const [replyDraft, setReplyDraft] = useState<Record<string, string>>({});
  const [replyStatusPick, setReplyStatusPick] = useState<
    Record<string, "open" | "in_progress" | "resolved">
  >({});
  const [replyBusy, setReplyBusy] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const initialLoad = useRef(true);
  const loadGenerationRef = useRef(0);
  const lastUserActivityRefetchAtRef = useRef(0);
  const loadAbortRef = useRef<AbortController | null>(null);

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
      const [a, m, u] = await Promise.all([
        supabase
          .from("host_applications")
          .select("id, full_name, email, experience_notes, created_at, status")
          .eq("status", "pending")
          .order("created_at", { ascending: true })
          .abortSignal(signal),
        supabase
          .from("publican_messages")
          .select(
            "id, venue_id, message_type, body, status, created_at, operator_reply, resolved_at, venues(name)",
          )
          .or("status.eq.open,status.eq.in_progress")
          .order("created_at", { ascending: true })
          .abortSignal(signal),
        supabase.rpc("operator_triage_unhosted_quizzes").abortSignal(signal),
      ]);

      if (gen !== loadGenerationRef.current) return;

      if (a.error) {
        captureSupabaseError("host_applications.pending_list", a.error);
        throw new Error(a.error.message);
      }
      if (m.error) {
        captureSupabaseError("publican_messages.open_list", m.error);
        throw new Error(m.error.message);
      }
      if (u.error) {
        captureSupabaseError("operator_triage_unhosted_quizzes", u.error);
        throw new Error(u.error.message);
      }

      setApps((a.data ?? []) as HostApplication[]);
      setMsgs(normalizePublicanRows(m.data));
      setUnhosted((u.data ?? []) as UnhostedQuiz[]);
    } catch (e) {
      if (gen !== loadGenerationRef.current) return;
      setError(e instanceof Error ? e.message : "Failed to load triage data.");
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

  async function approve(id: string) {
    setApproveBusy(id);
    setError(null);
    try {
      const supabase = createBrowserSupabaseClient();
      const { error: e } = await supabase.rpc("operator_approve_host_application", {
        p_application_id: id,
      });
      if (e) {
        captureSupabaseError("operator_approve_host_application", e, { applicationId: id });
        throw new Error(e.message);
      }
      setApps((prev) => prev.filter((a) => a.id !== id));
      setToast("Application approved.");
      void load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Approve failed.");
    } finally {
      setApproveBusy(null);
    }
  }

  async function reject(id: string) {
    setRejectBusy(id);
    setError(null);
    try {
      const supabase = createBrowserSupabaseClient();
      const reason = rejectReason.trim() || null;
      const { error: e } = await supabase
        .from("host_applications")
        .update({
          status: "rejected",
          reviewed_at: new Date().toISOString(),
          rejection_reason: reason,
        })
        .eq("id", id)
        .eq("status", "pending");
      if (e) {
        captureSupabaseError("host_applications.reject", e, { applicationId: id });
        throw new Error(e.message);
      }
      setRejectExpanded(null);
      setRejectReason("");
      void load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Reject failed.");
    } finally {
      setRejectBusy(null);
    }
  }

  async function submitReply(id: string) {
    const text = (replyDraft[id] ?? "").trim();
    const st = replyStatusPick[id] ?? "in_progress";
    setReplyBusy(id);
    setError(null);
    try {
      const supabase = createBrowserSupabaseClient();
      const { error: e } = await supabase
        .from("publican_messages")
        .update({
          operator_reply: text.length > 0 ? text : null,
          status: st,
          resolved_at: st === "resolved" ? new Date().toISOString() : null,
        })
        .eq("id", id);
      if (e) {
        captureSupabaseError("publican_messages.operator_reply", e, { messageId: id });
        throw new Error(e.message);
      }
      setMsgExpanded(null);
      void load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save reply.");
    } finally {
      setReplyBusy(null);
    }
  }

  function toggleMessage(row: PublicanMessageRow) {
    if (msgExpanded === row.id) {
      setMsgExpanded(null);
      return;
    }
    setMsgExpanded(row.id);
    setReplyDraft((d) => ({ ...d, [row.id]: row.operator_reply ?? "" }));
    setReplyStatusPick((s) => ({
      ...s,
      [row.id]:
        row.status === "resolved"
          ? "resolved"
          : row.status === "open"
            ? "open"
            : "in_progress",
    }));
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
      <h1 className="font-heading animate-admin-fade-in-up text-2xl uppercase text-quizzer-black">
        Triage
      </h1>
      {error ? (
        <p className="animate-admin-fade-in-up rounded-[var(--radius-button)] border-2 border-quizzer-red bg-quizzer-white px-3 py-2 text-sm text-quizzer-red">
          {error}
        </p>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-3">
        <section
          className="animate-admin-fade-in-up flex min-h-[320px] flex-col rounded-[var(--radius-button)] border-[var(--border-thick)] border-quizzer-black bg-quizzer-white p-4 shadow-[var(--shadow-card)]"
          style={{ "--admin-stagger": "0ms" } as CSSProperties}
        >
          <h2 className="flex flex-wrap items-center gap-2 font-heading text-sm uppercase tracking-wide text-quizzer-black">
            Pending host applications
            <span className="rounded-full border-2 border-quizzer-black bg-quizzer-yellow px-2 py-0.5 text-xs font-semibold normal-case tracking-normal">
              {apps.length}
            </span>
          </h2>
          <div className="mt-4 flex-1 space-y-3 overflow-y-auto">
            {loading && apps.length === 0 ? (
              <p className="text-sm text-quizzer-black/60">Loading…</p>
            ) : apps.length === 0 ? (
              <p className="text-sm text-quizzer-black/60">{EMPTY_COPY}</p>
            ) : (
              apps.map((app, rowIdx) => {
                const age = daysSinceCreated(app.created_at);
                return (
                <div
                  key={app.id}
                  className="animate-admin-row rounded-[var(--radius-button)] border-2 border-quizzer-black/15 bg-quizzer-cream/40 p-3"
                  style={
                    { "--admin-row-delay": `${Math.min(rowIdx, 12) * 42}ms` } as CSSProperties
                  }
                >
                  <p className="font-semibold text-quizzer-black">{app.full_name}</p>
                  <p className="text-xs text-quizzer-black/70">{app.email}</p>
                  <p className="mt-1 text-sm text-quizzer-black/85">
                    {snippet(app.experience_notes, 120)}
                  </p>
                  <p className="mt-1 text-xs text-quizzer-black/55">
                    {age} day{age === 1 ? "" : "s"} since applied
                  </p>
                  {rejectExpanded === app.id ? (
                    <div className="animate-admin-fade-in-up mt-2 space-y-2 border-t border-quizzer-black/10 pt-2">
                      <label className="block text-xs font-medium text-quizzer-black">
                        Rejection reason (optional)
                        <input
                          type="text"
                          value={rejectReason}
                          onChange={(e) => setRejectReason(e.target.value)}
                          className="mt-1 w-full rounded-[var(--radius-button)] border-2 border-quizzer-black bg-quizzer-white px-2 py-1 text-sm outline-none focus:ring-2 focus:ring-quizzer-yellow"
                        />
                      </label>
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          disabled={rejectBusy === app.id}
                          onClick={() => void reject(app.id)}
                          className="rounded-[var(--radius-button)] border-2 border-quizzer-black bg-quizzer-red px-2 py-1 text-xs font-semibold text-quizzer-white shadow-[var(--shadow-button)] hover:translate-x-[1px] hover:translate-y-[1px] disabled:opacity-50"
                        >
                          {rejectBusy === app.id ? "Saving…" : "Confirm reject"}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setRejectExpanded(null);
                            setRejectReason("");
                          }}
                          className="rounded-[var(--radius-button)] border-2 border-quizzer-black/25 bg-quizzer-white px-2 py-1 text-xs font-semibold text-quizzer-black"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="mt-2 flex flex-wrap gap-2">
                      <button
                        type="button"
                        disabled={approveBusy === app.id}
                        onClick={() => void approve(app.id)}
                        className="rounded-[var(--radius-button)] border-2 border-quizzer-black bg-quizzer-yellow px-2 py-1 text-xs font-semibold text-quizzer-black shadow-[var(--shadow-button)] hover:translate-x-[1px] hover:translate-y-[1px] disabled:opacity-50"
                      >
                        {approveBusy === app.id ? "Approving…" : "Approve"}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setRejectExpanded(app.id);
                          setRejectReason("");
                        }}
                        className="rounded-[var(--radius-button)] border-2 border-quizzer-black bg-quizzer-white px-2 py-1 text-xs font-semibold text-quizzer-black shadow-[var(--shadow-button)] hover:translate-x-[1px] hover:translate-y-[1px]"
                      >
                        Reject
                      </button>
                    </div>
                  )}
                </div>
                );
              })
            )}
          </div>
        </section>

        <section
          className="animate-admin-fade-in-up flex min-h-[320px] flex-col rounded-[var(--radius-button)] border-[var(--border-thick)] border-quizzer-black bg-quizzer-white p-4 shadow-[var(--shadow-card)]"
          style={{ "--admin-stagger": "70ms" } as CSSProperties}
        >
          <h2 className="flex flex-wrap items-center gap-2 font-heading text-sm uppercase tracking-wide text-quizzer-black">
            Unresolved publican messages
            <span className="rounded-full border-2 border-quizzer-black bg-quizzer-yellow px-2 py-0.5 text-xs font-semibold normal-case tracking-normal">
              {msgs.length}
            </span>
          </h2>
          <div className="mt-4 flex-1 space-y-2 overflow-y-auto">
            {loading && msgs.length === 0 ? (
              <p className="text-sm text-quizzer-black/60">Loading…</p>
            ) : msgs.length === 0 ? (
              <p className="text-sm text-quizzer-black/60">{EMPTY_COPY}</p>
            ) : (
              msgs.map((row, rowIdx) => {
                const venueName = row.venues?.name ?? "Venue";
                const expanded = msgExpanded === row.id;
                return (
                  <div
                    key={row.id}
                    className="animate-admin-row rounded-[var(--radius-button)] border-2 border-quizzer-black/15 bg-quizzer-cream/40"
                    style={
                      { "--admin-row-delay": `${Math.min(rowIdx, 12) * 42}ms` } as CSSProperties
                    }
                  >
                    <button
                      type="button"
                      onClick={() => toggleMessage(row)}
                      className="w-full rounded-[var(--radius-button)] p-3 text-left outline-none ring-quizzer-yellow focus-visible:ring-2"
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold text-quizzer-black">{venueName}</span>
                        <span className="rounded border border-quizzer-black/30 bg-quizzer-white px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-quizzer-black">
                          {row.message_type.replace(/_/g, " ")}
                        </span>
                        <span
                          className={`rounded border px-1.5 py-0.5 text-[10px] font-semibold uppercase ${
                            row.status === "open"
                              ? "border-quizzer-black bg-quizzer-yellow/80 text-quizzer-black"
                              : row.status === "in_progress"
                                ? "border-quizzer-black/40 bg-quizzer-cream text-quizzer-black"
                                : "border-quizzer-black/40 bg-quizzer-white text-quizzer-black"
                          }`}
                        >
                          {row.status.replace(/_/g, " ")}
                        </span>
                      </div>
                      <p className="mt-1 text-sm text-quizzer-black/85">{snippet(row.body, 120)}</p>
                      <p className="mt-1 text-xs text-quizzer-black/55">
                        {new Date(row.created_at).toLocaleString()}
                      </p>
                    </button>
                    {expanded ? (
                      <div className="animate-admin-fade-in-up border-t-2 border-quizzer-black/10 px-3 pb-3 pt-2">
                        <p className="whitespace-pre-wrap text-sm text-quizzer-black">{row.body}</p>
                        <label className="mt-3 block text-xs font-medium text-quizzer-black">
                          Operator reply
                          <textarea
                            value={replyDraft[row.id] ?? ""}
                            onChange={(e) =>
                              setReplyDraft((d) => ({ ...d, [row.id]: e.target.value }))
                            }
                            rows={4}
                            className="mt-1 w-full rounded-[var(--radius-button)] border-2 border-quizzer-black bg-quizzer-white px-2 py-1 text-sm outline-none focus:ring-2 focus:ring-quizzer-yellow"
                          />
                        </label>
                        <div className="mt-2 flex flex-wrap items-center gap-3">
                          <label className="flex items-center gap-2 text-xs font-medium text-quizzer-black">
                            <span>Status</span>
                            <select
                              value={replyStatusPick[row.id] ?? "in_progress"}
                              onChange={(e) =>
                                setReplyStatusPick((s) => ({
                                  ...s,
                                  [row.id]: e.target.value as
                                    | "open"
                                    | "in_progress"
                                    | "resolved",
                                }))
                              }
                              className="rounded-[var(--radius-button)] border-2 border-quizzer-black bg-quizzer-white px-2 py-1 text-xs"
                            >
                              <option value="open">Open</option>
                              <option value="in_progress">In progress</option>
                              <option value="resolved">Resolved</option>
                            </select>
                          </label>
                          <button
                            type="button"
                            disabled={replyBusy === row.id}
                            onClick={() => void submitReply(row.id)}
                            className="rounded-[var(--radius-button)] border-2 border-quizzer-black bg-quizzer-yellow px-3 py-1 text-xs font-semibold text-quizzer-black shadow-[var(--shadow-button)] hover:translate-x-[1px] hover:translate-y-[1px] disabled:opacity-50"
                          >
                            {replyBusy === row.id ? "Saving…" : "Save"}
                          </button>
                        </div>
                      </div>
                    ) : null}
                  </div>
                );
              })
            )}
          </div>
        </section>

        <section className="flex min-h-[320px] flex-col rounded-[var(--radius-button)] border-[var(--border-thick)] border-quizzer-black bg-quizzer-white p-4 shadow-[var(--shadow-card)]">
          <h2 className="flex flex-wrap items-center gap-2 font-heading text-sm uppercase tracking-wide text-quizzer-black">
            Unhosted quizzes
            <span className="rounded-full border-2 border-quizzer-black bg-quizzer-yellow px-2 py-0.5 text-xs font-semibold normal-case tracking-normal">
              {unhosted.length}
            </span>
          </h2>
          <div className="mt-4 flex-1 space-y-3 overflow-y-auto">
            {loading && unhosted.length === 0 ? (
              <p className="text-sm text-quizzer-black/60">Loading…</p>
            ) : unhosted.length === 0 ? (
              <p className="text-sm text-quizzer-black/60">{EMPTY_COPY}</p>
            ) : (
              unhosted.map((q, rowIdx) => {
                const dowIdx = Number(q.day_of_week);
                const dow =
                  dowIdx >= 0 && dowIdx < DAY_NAMES.length
                    ? DAY_NAMES[dowIdx]
                    : `Day ${q.day_of_week}`;
                const next = formatNextOccurrence(String(q.next_occurrence ?? ""));
                const ic =
                  typeof q.interest_count === "number"
                    ? q.interest_count
                    : Number(q.interest_count);
                return (
                  <div
                    key={q.quiz_event_id}
                    className="animate-admin-row rounded-[var(--radius-button)] border-2 border-quizzer-black/15 bg-quizzer-cream/40 p-3"
                    style={
                      { "--admin-row-delay": `${Math.min(rowIdx, 12) * 42}ms` } as CSSProperties
                    }
                  >
                    <p className="font-semibold text-quizzer-black">{q.venue_name}</p>
                    <p className="mt-1 text-sm text-quizzer-black/85">
                      {dow} · {formatTime(q.start_time)}
                    </p>
                    <p className="mt-1 text-xs text-quizzer-black/70">
                      Next: <span className="font-medium text-quizzer-black">{next}</span>
                    </p>
                    <p className="mt-1 text-xs text-quizzer-black/70">
                      RSVP interest:{" "}
                      <span className="font-medium text-quizzer-black">{ic}</span>
                    </p>
                  </div>
                );
              })
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
