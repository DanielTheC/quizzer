"use client";

import { createBrowserSupabaseClient } from "@/lib/supabase/browser";
import { captureSupabaseError } from "@/lib/observability/supabaseErrors";
import type { CSSProperties } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

const REFRESH_MS = 60_000;
const USER_ACTIVITY_REFETCH_GAP_MS = 900;

const EMPTY_COPY = "No messages.";

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

type MessageStatusFilter = "all" | "open" | "in_progress" | "resolved";

function snippet(s: string, n: number) {
  const t = s.trim();
  if (t.length <= n) return t;
  return `${t.slice(0, n)}…`;
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

export function AdminMessagesDashboard() {
  const [allMsgs, setAllMsgs] = useState<PublicanMessageRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [msgExpanded, setMsgExpanded] = useState<string | null>(null);
  const [replyDraft, setReplyDraft] = useState<Record<string, string>>({});
  const [replyStatusPick, setReplyStatusPick] = useState<
    Record<string, "open" | "in_progress" | "resolved">
  >({});
  const [replyBusy, setReplyBusy] = useState<string | null>(null);
  const [filterTab, setFilterTab] = useState<MessageStatusFilter>("all");

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
      const m = await supabase
        .from("publican_messages")
        .select(
          "id, venue_id, message_type, body, status, created_at, operator_reply, resolved_at, venues(name)",
        )
        .order("created_at", { ascending: false })
        .abortSignal(signal);

      if (gen !== loadGenerationRef.current) return;

      if (m.error) {
        captureSupabaseError("publican_messages.admin_all_list", m.error);
        throw new Error(m.error.message);
      }

      setAllMsgs(normalizePublicanRows(m.data));
    } catch (e) {
      if (gen !== loadGenerationRef.current) return;
      setError(e instanceof Error ? e.message : "Failed to load messages.");
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

  const tabCounts = useMemo(() => {
    const open = allMsgs.filter((m) => m.status === "open").length;
    const inProgress = allMsgs.filter((m) => m.status === "in_progress").length;
    const resolved = allMsgs.filter((m) => m.status === "resolved").length;
    return {
      all: allMsgs.length,
      open,
      in_progress: inProgress,
      resolved,
    };
  }, [allMsgs]);

  const filteredMsgs = useMemo(() => {
    if (filterTab === "all") return allMsgs;
    return allMsgs.filter((m) => m.status === filterTab);
  }, [allMsgs, filterTab]);

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

  const tabBtn =
    "rounded-[var(--radius-button)] border-2 px-3 py-1.5 text-xs font-semibold shadow-[var(--shadow-button)] transition hover:translate-x-[1px] hover:translate-y-[1px]";
  const tabActive = "border-quizzer-black bg-quizzer-yellow text-quizzer-black";
  const tabIdle = "border-quizzer-black/25 bg-quizzer-white text-quizzer-black";

  return (
    <div className="relative space-y-6">
      <h1 className="font-heading animate-admin-fade-in-up text-2xl uppercase text-quizzer-black">
        Messages
      </h1>
      {error ? (
        <p className="animate-admin-fade-in-up rounded-[var(--radius-button)] border-2 border-quizzer-red bg-quizzer-white px-3 py-2 text-sm text-quizzer-red">
          {error}
        </p>
      ) : null}

      <section
        className="animate-admin-fade-in-up flex min-h-[320px] flex-col rounded-[var(--radius-button)] border-[var(--border-thick)] border-quizzer-black bg-quizzer-white p-4 shadow-[var(--shadow-card)]"
        style={{ "--admin-stagger": "0ms" } as CSSProperties}
      >
        <h2 className="flex flex-wrap items-center gap-2 font-heading text-sm uppercase tracking-wide text-quizzer-black">
          Publican messages
          <span className="rounded-full border-2 border-quizzer-black bg-quizzer-yellow px-2 py-0.5 text-xs font-semibold normal-case tracking-normal">
            {allMsgs.length}
          </span>
        </h2>

        <div
          className="animate-admin-fade-in-up mt-4 flex flex-wrap gap-2 border-t border-quizzer-black/10 pt-4"
          role="tablist"
          aria-label="Filter by status"
        >
          <button
            type="button"
            role="tab"
            aria-selected={filterTab === "all"}
            onClick={() => setFilterTab("all")}
            className={`${tabBtn} inline-flex items-center gap-2 ${filterTab === "all" ? tabActive : tabIdle}`}
          >
            All
            <span className="rounded-full border border-quizzer-black/30 bg-quizzer-white px-1.5 py-0.5 text-[10px] font-bold">
              {tabCounts.all}
            </span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={filterTab === "open"}
            onClick={() => setFilterTab("open")}
            className={`${tabBtn} inline-flex items-center gap-2 ${filterTab === "open" ? tabActive : tabIdle}`}
          >
            Open
            <span className="rounded-full border border-quizzer-black/30 bg-quizzer-white px-1.5 py-0.5 text-[10px] font-bold">
              {tabCounts.open}
            </span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={filterTab === "in_progress"}
            onClick={() => setFilterTab("in_progress")}
            className={`${tabBtn} inline-flex items-center gap-2 ${filterTab === "in_progress" ? tabActive : tabIdle}`}
          >
            In Progress
            <span className="rounded-full border border-quizzer-black/30 bg-quizzer-white px-1.5 py-0.5 text-[10px] font-bold">
              {tabCounts.in_progress}
            </span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={filterTab === "resolved"}
            onClick={() => setFilterTab("resolved")}
            className={`${tabBtn} inline-flex items-center gap-2 ${filterTab === "resolved" ? tabActive : tabIdle}`}
          >
            Resolved
            <span className="rounded-full border border-quizzer-black/30 bg-quizzer-white px-1.5 py-0.5 text-[10px] font-bold">
              {tabCounts.resolved}
            </span>
          </button>
        </div>

        <div className="mt-4 flex-1 space-y-2 overflow-y-auto">
          {loading && allMsgs.length === 0 ? (
            <p className="text-sm text-quizzer-black/60">Loading…</p>
          ) : filteredMsgs.length === 0 ? (
            <p className="text-sm text-quizzer-black/60">{EMPTY_COPY}</p>
          ) : (
            filteredMsgs.map((row, rowIdx) => {
              const venueName = row.venues?.name ?? "Venue";
              const expanded = msgExpanded === row.id;
              const isResolved = row.status === "resolved";
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
                      {isResolved && row.resolved_at ? (
                        <p className="mt-3 text-xs text-quizzer-black/50">
                          Resolved {new Date(row.resolved_at).toLocaleString("en-GB")}
                        </p>
                      ) : null}
                      {isResolved && row.operator_reply ? (
                        <p className="mt-2 whitespace-pre-wrap text-sm text-quizzer-black/60">
                          <span className="mr-2 text-xs font-semibold uppercase tracking-wide text-quizzer-black/45">
                            Saved reply
                          </span>
                          {row.operator_reply}
                        </p>
                      ) : null}
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
    </div>
  );
}
