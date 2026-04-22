"use client";

import type { NetworkSummary } from "@/components/admin/AdminAnalyticsDashboard";
import { createBrowserSupabaseClient } from "@/lib/supabase/browser";
import { captureSupabaseError } from "@/lib/observability/supabaseErrors";
import {
  formatTime24 as formatTime,
  dayShort as dayShortLabel,
} from "@/lib/formatters";
import Link from "next/link";
import type { CSSProperties } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

const REFRESH_MS = 60_000;
const USER_ACTIVITY_REFETCH_GAP_MS = 900;

const DAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
] as const;

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
  const parsed = /^\d{4}-\d{2}-\d{2}$/.test(x) ? new Date(`${x}T12:00:00`) : new Date(x);
  if (Number.isNaN(parsed.getTime())) return x;
  return parsed.toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
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

type QuizEventEmbed = {
  day_of_week: number;
  start_time: string;
  venues: { name: string } | { name: string }[] | null;
};

type PendingClaimInbox = {
  id: string;
  host_email: string;
  claimed_at: string;
  quiz_event_id: string;
  quiz_events: QuizEventEmbed | null;
};

function normalizePendingClaimRow(raw: unknown): PendingClaimInbox {
  const r = raw as Record<string, unknown>;
  let ev: QuizEventEmbed | null = null;
  const qeRaw = r.quiz_events;
  const qeFirst = Array.isArray(qeRaw) ? qeRaw[0] : qeRaw;
  if (qeFirst && typeof qeFirst === "object") {
    const o = qeFirst as Record<string, unknown>;
    ev = {
      day_of_week: Number(o.day_of_week ?? 0),
      start_time: String(o.start_time ?? ""),
      venues: (o.venues as QuizEventEmbed["venues"]) ?? null,
    };
  }
  return {
    id: String(r.id ?? ""),
    host_email: String(r.host_email ?? ""),
    claimed_at: String(r.claimed_at ?? ""),
    quiz_event_id: String(r.quiz_event_id ?? ""),
    quiz_events: ev,
  };
}

function snippet(s: string, n: number) {
  const t = s.trim();
  if (t.length <= n) return t;
  return `${t.slice(0, n)}…`;
}

function venueFromEmbed(venues: { name: string } | { name: string }[] | null): { name: string } | null {
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

function claimVenueTitle(c: PendingClaimInbox): string {
  const ev = c.quiz_events;
  const vname = ev ? venueFromEmbed(ev.venues)?.name?.trim() || "Venue" : "Venue";
  if (!ev) return vname;
  return `${vname} · ${dayShortLabel(ev.day_of_week)} ${formatTime(ev.start_time)}`;
}

function BtnSpinner() {
  return (
    <span
      className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-quizzer-black border-t-transparent"
      aria-hidden
    />
  );
}

type OperatorNotificationRow = {
  id: string;
  reason: string;
  payload: Record<string, unknown>;
  created_at: string;
  read_at: string | null;
};

type LateUnclaimPayload = {
  quiz_event_id: string;
  occurrence_date: string;
  host_user_id: string;
  hours_until: number;
};

type OccurrenceCancelledPayload = {
  quiz_event_id: string;
  occurrence_date: string;
  cancelled_by: string;
  reason?: string | null;
};

type QuizEventLookup = {
  quiz_event_id: string;
  venue_name: string;
  day_of_week: number;
  start_time: string;
};

type HostLookup = {
  host_user_id: string;
  display_name: string;
  email: string | null;
};

type InboxItem =
  | { kind: "application"; sortAt: string; app: HostApplication }
  | { kind: "claim"; sortAt: string; claim: PendingClaimInbox }
  | { kind: "message"; sortAt: string; msg: PublicanMessageRow }
  | { kind: "late_unclaim"; sortAt: string; isRead: boolean; note: OperatorNotificationRow; payload: LateUnclaimPayload }
  | { kind: "occurrence_cancelled"; sortAt: string; isRead: boolean; note: OperatorNotificationRow; payload: OccurrenceCancelledPayload };

function formatOccurrenceDate(iso: string): string {
  const s = (iso ?? "").trim();
  if (!s) return "—";
  const parsed = /^\d{4}-\d{2}-\d{2}$/.test(s) ? new Date(`${s}T12:00:00`) : new Date(s);
  if (Number.isNaN(parsed.getTime())) return s;
  return parsed.toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatHoursUntil(n: unknown): string {
  const v = typeof n === "number" ? n : Number(n);
  if (!Number.isFinite(v)) return "—";
  const rounded = Math.round(v * 10) / 10;
  if (rounded <= 0) return "now";
  const whole = Math.round(rounded);
  return `${whole} hr${whole === 1 ? "" : "s"}`;
}

function labelForQuiz(q: QuizEventLookup | undefined, fallbackQuizEventId: string): string {
  if (!q) return `Quiz ${fallbackQuizEventId.slice(0, 8)}…`;
  return `${q.venue_name} · ${dayShortLabel(q.day_of_week)} ${formatTime(q.start_time)}`;
}

function cancelledByLabel(v: unknown): string {
  const s = typeof v === "string" ? v.trim() : "";
  if (!s) return "unknown";
  if (s === "publican") return "Publican";
  if (s === "operator") return "Operator";
  if (s === "host") return "Host";
  return s;
}

export function AdminHomeDashboard() {
  const [apps, setApps] = useState<HostApplication[]>([]);
  const [msgs, setMsgs] = useState<PublicanMessageRow[]>([]);
  const [unhosted, setUnhosted] = useState<UnhostedQuiz[]>([]);
  const [pendingClaims, setPendingClaims] = useState<PendingClaimInbox[]>([]);
  const [pendingClaimsCount, setPendingClaimsCount] = useState(0);
  const [networkSummary, setNetworkSummary] = useState<NetworkSummary | null>(null);
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
  const [claimNotesDraft, setClaimNotesDraft] = useState<Record<string, string>>({});
  const [claimBusy, setClaimBusy] = useState<{ id: string; action: "confirm" | "reject" } | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [notifications, setNotifications] = useState<OperatorNotificationRow[]>([]);
  const [quizLookup, setQuizLookup] = useState<Record<string, QuizEventLookup>>({});
  const [hostLookup, setHostLookup] = useState<Record<string, HostLookup>>({});
  const [notificationAckBusy, setNotificationAckBusy] = useState<string | null>(null);
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
      const [a, m, u, claimsCountRes, netRes, claimsRowsRes, notificationsRes] = await Promise.all([
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
        supabase
          .from("quiz_claims")
          .select("id", { count: "exact", head: true })
          .eq("status", "pending")
          .abortSignal(signal),
        supabase.rpc("operator_network_summary").abortSignal(signal),
        supabase
          .from("quiz_claims")
          .select("id, host_email, claimed_at, quiz_event_id, quiz_events(day_of_week, start_time, venues(name))")
          .eq("status", "pending")
          .order("claimed_at", { ascending: true })
          .abortSignal(signal),
        supabase
          .from("operator_notifications")
          .select("id, reason, payload, created_at, read_at")
          .in("reason", ["late_unclaim_attempt", "occurrence_cancelled"])
          .order("read_at", { ascending: true, nullsFirst: true })
          .order("created_at", { ascending: false })
          .limit(50)
          .abortSignal(signal),
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

      if (claimsCountRes.error) {
        captureSupabaseError("quiz_claims.pending_count", claimsCountRes.error);
        setPendingClaimsCount(0);
      } else {
        setPendingClaimsCount(claimsCountRes.count ?? 0);
      }

      if (netRes.error) {
        captureSupabaseError("operator_network_summary", netRes.error);
        setNetworkSummary(null);
      } else {
        setNetworkSummary(normalizeNetworkSummary(netRes.data));
      }

      if (claimsRowsRes.error) {
        captureSupabaseError("quiz_claims.pending_inbox", claimsRowsRes.error);
        setPendingClaims([]);
      } else {
        const rows = (claimsRowsRes.data ?? []).map(normalizePendingClaimRow);
        setPendingClaims(rows);
        setClaimNotesDraft((prev) => {
          const next: Record<string, string> = { ...prev };
          for (const r of rows) {
            if (next[r.id] === undefined) next[r.id] = "";
          }
          for (const id of Object.keys(next)) {
            if (!rows.some((x) => x.id === id)) delete next[id];
          }
          return next;
        });
      }

      let notes: OperatorNotificationRow[] = [];
      if (notificationsRes.error) {
        captureSupabaseError("operator_notifications.triage_list", notificationsRes.error);
        setNotifications([]);
      } else {
        notes = (notificationsRes.data ?? []).map((r) => ({
          id: String(r.id ?? ""),
          reason: String(r.reason ?? ""),
          payload: (r.payload ?? {}) as Record<string, unknown>,
          created_at: String(r.created_at ?? ""),
          read_at: r.read_at != null ? String(r.read_at) : null,
        }));
        setNotifications(notes);
      }

      const quizIds = new Set<string>();
      const hostIds = new Set<string>();
      for (const n of notes) {
        const qid = n.payload?.quiz_event_id;
        if (typeof qid === "string" && qid.length > 0) quizIds.add(qid);
        if (n.reason === "late_unclaim_attempt") {
          const hid = n.payload?.host_user_id;
          if (typeof hid === "string" && hid.length > 0) hostIds.add(hid);
        }
      }

      if (quizIds.size > 0) {
        const qRes = await supabase
          .from("quiz_events")
          .select("id, day_of_week, start_time, venues(name)")
          .in("id", Array.from(quizIds))
          .abortSignal(signal);
        if (gen !== loadGenerationRef.current) return;
        if (qRes.error) {
          captureSupabaseError("operator_notifications.quiz_lookup", qRes.error);
        } else {
          const map: Record<string, QuizEventLookup> = {};
          for (const row of (qRes.data ?? []) as Array<{
            id: string;
            day_of_week: number;
            start_time: string;
            venues: { name: string } | { name: string }[] | null;
          }>) {
            const v = venueFromEmbed(row.venues);
            map[row.id] = {
              quiz_event_id: row.id,
              venue_name: v?.name?.trim() || "Venue",
              day_of_week: Number(row.day_of_week ?? 0),
              start_time: String(row.start_time ?? ""),
            };
          }
          setQuizLookup(map);
        }
      } else {
        setQuizLookup({});
      }

      if (hostIds.size > 0) {
        const hRes = await supabase
          .from("host_applications")
          .select("host_user_id, full_name, email")
          .in("host_user_id", Array.from(hostIds))
          .abortSignal(signal);
        if (gen !== loadGenerationRef.current) return;
        if (hRes.error) {
          captureSupabaseError("operator_notifications.host_lookup", hRes.error);
        } else {
          const map: Record<string, HostLookup> = {};
          for (const row of (hRes.data ?? []) as Array<{
            host_user_id: string | null;
            full_name: string | null;
            email: string | null;
          }>) {
            if (!row.host_user_id) continue;
            if (map[row.host_user_id]) continue;
            map[row.host_user_id] = {
              host_user_id: row.host_user_id,
              display_name: (row.full_name ?? "").trim() || (row.email ?? "").trim() || "Host",
              email: row.email ?? null,
            };
          }
          setHostLookup(map);
        }
      } else {
        setHostLookup({});
      }

      setApps((a.data ?? []) as HostApplication[]);
      setMsgs(normalizePublicanRows(m.data));
      setUnhosted((u.data ?? []) as UnhostedQuiz[]);
    } catch (e) {
      if (gen !== loadGenerationRef.current) return;
      setError(e instanceof Error ? e.message : "Failed to load home data.");
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

  const inboxItems = useMemo((): InboxItem[] => {
    const unreadNotes: InboxItem[] = [];
    const readNotes: InboxItem[] = [];
    for (const n of notifications) {
      if (n.reason === "late_unclaim_attempt") {
        const p = n.payload as Partial<LateUnclaimPayload>;
        const payload: LateUnclaimPayload = {
          quiz_event_id: String(p.quiz_event_id ?? ""),
          occurrence_date: String(p.occurrence_date ?? ""),
          host_user_id: String(p.host_user_id ?? ""),
          hours_until: typeof p.hours_until === "number" ? p.hours_until : Number(p.hours_until ?? 0),
        };
        const item: InboxItem = {
          kind: "late_unclaim",
          sortAt: n.created_at,
          isRead: n.read_at != null,
          note: n,
          payload,
        };
        (item.isRead ? readNotes : unreadNotes).push(item);
      } else if (n.reason === "occurrence_cancelled") {
        const p = n.payload as Partial<OccurrenceCancelledPayload>;
        const payload: OccurrenceCancelledPayload = {
          quiz_event_id: String(p.quiz_event_id ?? ""),
          occurrence_date: String(p.occurrence_date ?? ""),
          cancelled_by: String(p.cancelled_by ?? ""),
          reason: typeof p.reason === "string" ? p.reason : null,
        };
        const item: InboxItem = {
          kind: "occurrence_cancelled",
          sortAt: n.created_at,
          isRead: n.read_at != null,
          note: n,
          payload,
        };
        (item.isRead ? readNotes : unreadNotes).push(item);
      }
    }

    const descByCreated = (x: InboxItem, y: InboxItem) =>
      new Date(y.sortAt).getTime() - new Date(x.sortAt).getTime();
    unreadNotes.sort(descByCreated);
    readNotes.sort(descByCreated);

    const legacy: InboxItem[] = [];
    for (const app of apps) {
      legacy.push({ kind: "application", sortAt: app.created_at, app });
    }
    for (const claim of pendingClaims) {
      legacy.push({ kind: "claim", sortAt: claim.claimed_at, claim });
    }
    for (const msg of msgs) {
      legacy.push({ kind: "message", sortAt: msg.created_at, msg });
    }
    legacy.sort((x, y) => new Date(x.sortAt).getTime() - new Date(y.sortAt).getTime());

    return [...unreadNotes, ...legacy, ...readNotes];
  }, [apps, pendingClaims, msgs, notifications]);

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

  async function updateClaim(claimId: string, status: "confirmed" | "rejected") {
    const action = status === "confirmed" ? "confirm" : "reject";
    setClaimBusy({ id: claimId, action });
    setError(null);
    try {
      const supabase = createBrowserSupabaseClient();
      const notes = (claimNotesDraft[claimId] ?? "").trim() || null;
      const { error: e } = await supabase
        .from("quiz_claims")
        .update({
          status,
          reviewed_at: new Date().toISOString(),
          notes,
        })
        .eq("id", claimId);
      if (e) {
        captureSupabaseError("quiz_claims.home_inbox_update", e, { claimId });
        throw new Error(e.message);
      }
      setToast(status === "confirmed" ? "Claim confirmed." : "Claim rejected.");
      void load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not update claim.");
    } finally {
      setClaimBusy(null);
    }
  }

  async function acknowledgeNotification(id: string) {
    setNotificationAckBusy(id);
    setError(null);
    const nowIso = new Date().toISOString();
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read_at: n.read_at ?? nowIso } : n)),
    );
    try {
      const supabase = createBrowserSupabaseClient();
      const { error: e } = await supabase
        .from("operator_notifications")
        .update({ read_at: nowIso })
        .eq("id", id);
      if (e) {
        captureSupabaseError("operator_notifications.acknowledge", e, { notificationId: id });
        setNotifications((prev) =>
          prev.map((n) => (n.id === id ? { ...n, read_at: null } : n)),
        );
        throw new Error(e.message);
      }
      setToast("Notification acknowledged.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not acknowledge notification.");
    } finally {
      setNotificationAckBusy(null);
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

  const grossFormatted =
    networkSummary != null ? `£${(networkSummary.gross_last_7d_pence / 100).toFixed(2)}` : "—";

  const kpiCardClass = (actionHighlight: boolean) =>
    `min-w-[10.5rem] shrink-0 rounded-[var(--radius-button)] border-[3px] border-quizzer-black p-4 shadow-[var(--shadow-card)] ${
      actionHighlight ? "bg-quizzer-yellow" : "bg-quizzer-white"
    }`;

  return (
    <div className="relative space-y-8">
      {toast ? (
        <p
          key={toast}
          className="animate-admin-toast fixed bottom-6 right-6 z-50 max-w-sm rounded-[var(--radius-button)] border-[3px] border-quizzer-black bg-quizzer-yellow px-4 py-2 text-sm font-semibold text-quizzer-black shadow-[var(--shadow-card)]"
          role="status"
        >
          {toast}
        </p>
      ) : null}
      <h1 className="font-heading animate-admin-fade-in-up text-2xl uppercase text-quizzer-black">Home</h1>
      {error ? (
        <p className="animate-admin-fade-in-up rounded-[var(--radius-button)] border-[3px] border-quizzer-red bg-quizzer-cream px-3 py-2 text-sm text-quizzer-red">
          {error}
        </p>
      ) : null}

      {/* Zone 1 — KPI strip */}
      <div className="animate-admin-fade-in-up flex flex-nowrap gap-3 overflow-x-auto pb-1 [-webkit-overflow-scrolling:touch]">
        <div className={kpiCardClass(false)}>
          <h2 className="text-xs font-semibold uppercase tracking-wide text-quizzer-black">Active quizzes</h2>
          <p className="font-heading mt-2 text-3xl text-quizzer-black">
            {networkSummary != null ? networkSummary.active_quiz_count : loading ? "…" : "—"}
          </p>
        </div>
        <div className={kpiCardClass(false)}>
          <h2 className="text-xs font-semibold uppercase tracking-wide text-quizzer-black">Teams this week</h2>
          <p className="font-heading mt-2 text-3xl text-quizzer-black">
            {networkSummary != null ? networkSummary.teams_last_7d : loading ? "…" : "—"}
          </p>
        </div>
        <div className={kpiCardClass(false)}>
          <h2 className="text-xs font-semibold uppercase tracking-wide text-quizzer-black">Revenue this week</h2>
          <p className="font-heading mt-2 text-3xl text-quizzer-black">{grossFormatted}</p>
        </div>
        <Link href="/admin/hosts" className={`block ${kpiCardClass(pendingClaimsCount > 0)}`}>
          <h2 className="text-xs font-semibold uppercase tracking-wide text-quizzer-black">Pending claims</h2>
          <p className="font-heading mt-2 text-3xl text-quizzer-black">{pendingClaimsCount}</p>
        </Link>
        <Link href="/admin/messages" className={`block ${kpiCardClass(msgs.length > 0)}`}>
          <h2 className="text-xs font-semibold uppercase tracking-wide text-quizzer-black">Open messages</h2>
          <p className="font-heading mt-2 text-3xl text-quizzer-black">{msgs.length}</p>
        </Link>
      </div>

      {/* Zone 2 — Action inbox */}
      <section
        className="animate-admin-fade-in-up rounded-[var(--radius-button)] border-[3px] border-quizzer-black bg-quizzer-white p-4 shadow-[var(--shadow-card)]"
        style={{ "--admin-stagger": "0ms" } as CSSProperties}
      >
        <h2 className="font-heading text-sm uppercase tracking-wide text-quizzer-black">Needs action</h2>
        <div className="mt-4 space-y-3">
          {loading && inboxItems.length === 0 ? (
            <p className="text-sm text-quizzer-black/60">Loading…</p>
          ) : inboxItems.length === 0 ? (
            <p className="py-16 text-center font-heading text-2xl text-quizzer-black/70">All clear ✓</p>
          ) : (
            inboxItems.map((item, rowIdx) => {
              if (item.kind === "application") {
                const app = item.app;
                const age = daysSinceCreated(app.created_at);
                return (
                  <div
                    key={`app-${app.id}`}
                    className="animate-admin-row rounded-[var(--radius-button)] border-[3px] border-quizzer-black/15 bg-quizzer-cream/40 p-4"
                    style={{ "--admin-row-delay": `${Math.min(rowIdx, 20) * 32}ms` } as CSSProperties}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <span className="rounded-full border-[3px] border-quizzer-black bg-quizzer-yellow px-2 py-0.5 text-xs font-semibold text-quizzer-black">
                        Application
                      </span>
                    </div>
                    <p className="mt-2 font-semibold text-quizzer-black">{app.full_name}</p>
                    <p className="mt-1 text-sm text-quizzer-black/80">
                      {app.email} · {age} day{age === 1 ? "" : "s"} waiting
                    </p>
                    <p className="mt-2 text-sm text-quizzer-black/85">{snippet(app.experience_notes, 160)}</p>
                    {rejectExpanded === app.id ? (
                      <div className="animate-admin-fade-in-up mt-3 space-y-2 border-t border-quizzer-black/10 pt-3">
                        <label className="block text-xs font-medium text-quizzer-black">
                          Rejection reason (optional)
                          <input
                            type="text"
                            value={rejectReason}
                            onChange={(e) => setRejectReason(e.target.value)}
                            className="mt-1 w-full rounded-[var(--radius-button)] border-[3px] border-quizzer-black bg-quizzer-white px-2 py-1 text-sm outline-none focus:ring-2 focus:ring-quizzer-yellow"
                          />
                        </label>
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            disabled={rejectBusy === app.id}
                            onClick={() => void reject(app.id)}
                            className="rounded-[var(--radius-button)] border-[3px] border-quizzer-black bg-quizzer-red px-2 py-1 text-xs font-semibold text-quizzer-white shadow-[var(--shadow-button)] hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[var(--shadow-button-hover)] disabled:opacity-50"
                          >
                            {rejectBusy === app.id ? "Saving…" : "Confirm reject"}
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setRejectExpanded(null);
                              setRejectReason("");
                            }}
                            className="rounded-[var(--radius-button)] border-[3px] border-quizzer-black/25 bg-quizzer-white px-2 py-1 text-xs font-semibold text-quizzer-black"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="mt-3 flex flex-wrap gap-2">
                        <button
                          type="button"
                          disabled={approveBusy === app.id}
                          onClick={() => void approve(app.id)}
                          className="rounded-[var(--radius-button)] border-[3px] border-quizzer-black bg-quizzer-yellow px-2 py-1 text-xs font-semibold text-quizzer-black shadow-[var(--shadow-button)] hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[var(--shadow-button-hover)] disabled:opacity-50"
                        >
                          {approveBusy === app.id ? "Approving…" : "Approve"}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setRejectExpanded(app.id);
                            setRejectReason("");
                          }}
                          className="rounded-[var(--radius-button)] border-[3px] border-quizzer-black bg-quizzer-white px-2 py-1 text-xs font-semibold text-quizzer-black shadow-[var(--shadow-button)] hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[var(--shadow-button-hover)]"
                        >
                          Reject
                        </button>
                      </div>
                    )}
                  </div>
                );
              }

              if (item.kind === "claim") {
                const c = item.claim;
                return (
                  <div
                    key={`claim-${c.id}`}
                    className="animate-admin-row rounded-[var(--radius-button)] border-[3px] border-quizzer-black/15 bg-quizzer-cream/40 p-4"
                    style={{ "--admin-row-delay": `${Math.min(rowIdx, 20) * 32}ms` } as CSSProperties}
                  >
                    <span className="inline-block rounded-full border-[3px] border-quizzer-orange bg-quizzer-yellow/20 px-2 py-0.5 text-xs font-semibold uppercase tracking-wide text-quizzer-orange">
                      Claim
                    </span>
                    <p className="mt-2 font-semibold text-quizzer-black">{claimVenueTitle(c)}</p>
                    <p className="mt-1 text-sm text-quizzer-black/80">
                      {c.host_email} · claimed {new Date(c.claimed_at).toLocaleString("en-GB")}
                    </p>
                    <label className="mt-2 block text-xs font-medium text-quizzer-black">
                      Notes
                      <input
                        type="text"
                        value={claimNotesDraft[c.id] ?? ""}
                        onChange={(e) => setClaimNotesDraft((d) => ({ ...d, [c.id]: e.target.value }))}
                        className="mt-1 w-full max-w-md rounded-[var(--radius-button)] border-[3px] border-quizzer-black bg-quizzer-white px-2 py-1 text-sm outline-none focus:ring-2 focus:ring-quizzer-yellow"
                        placeholder="Operator notes"
                      />
                    </label>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        type="button"
                        disabled={claimBusy?.id === c.id}
                        onClick={() => void updateClaim(c.id, "confirmed")}
                        className="inline-flex items-center justify-center gap-2 rounded-[var(--radius-button)] border-[3px] border-quizzer-black bg-quizzer-yellow px-2 py-1 text-xs font-semibold text-quizzer-black shadow-[var(--shadow-button)] hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[var(--shadow-button-hover)] disabled:opacity-50"
                      >
                        {claimBusy?.id === c.id && claimBusy.action === "confirm" ? <BtnSpinner /> : null}
                        Confirm
                      </button>
                      <button
                        type="button"
                        disabled={claimBusy?.id === c.id}
                        onClick={() => void updateClaim(c.id, "rejected")}
                        className="inline-flex items-center justify-center gap-2 rounded-[var(--radius-button)] border-[3px] border-quizzer-black bg-quizzer-red px-2 py-1 text-xs font-semibold text-quizzer-white shadow-[var(--shadow-button)] hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[var(--shadow-button-hover)] disabled:opacity-50"
                      >
                        {claimBusy?.id === c.id && claimBusy.action === "reject" ? <BtnSpinner /> : null}
                        Reject
                      </button>
                    </div>
                  </div>
                );
              }

              if (item.kind === "late_unclaim") {
                const n = item.note;
                const p = item.payload;
                const q = quizLookup[p.quiz_event_id];
                const host = hostLookup[p.host_user_id];
                const hostLabel = host?.display_name ?? "Host";
                const hoursLabel = formatHoursUntil(p.hours_until);
                const dimmed = item.isRead;
                return (
                  <div
                    key={`late-${n.id}`}
                    className={`animate-admin-row rounded-[var(--radius-button)] border-[3px] border-quizzer-black/15 bg-quizzer-cream/40 p-4 ${
                      dimmed ? "opacity-60" : ""
                    }`}
                    style={{ "--admin-row-delay": `${Math.min(rowIdx, 20) * 32}ms` } as CSSProperties}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <span className="inline-block rounded-full border-[3px] border-quizzer-red bg-quizzer-red/10 px-2 py-0.5 text-xs font-semibold uppercase tracking-wide text-quizzer-red">
                        Late unclaim
                      </span>
                      {dimmed ? (
                        <span className="rounded-full border-2 border-quizzer-black/20 bg-quizzer-white px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-quizzer-black/60">
                          Acknowledged
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-2 font-semibold text-quizzer-black">
                      {labelForQuiz(q, p.quiz_event_id)}
                    </p>
                    <p className="mt-1 text-sm text-quizzer-black/80">
                      {formatOccurrenceDate(p.occurrence_date)} · {hoursLabel} until quiz
                    </p>
                    <p className="mt-1 text-sm text-quizzer-black/85">
                      Host: <span className="font-medium text-quizzer-black">{hostLabel}</span>
                      {host?.email ? (
                        <span className="text-quizzer-black/70"> · {host.email}</span>
                      ) : null}
                    </p>
                    <p className="mt-1 text-xs text-quizzer-black/55">
                      {new Date(n.created_at).toLocaleString("en-GB")}
                    </p>
                    {dimmed ? null : (
                      <div className="mt-3 flex flex-wrap gap-2">
                        <button
                          type="button"
                          disabled={notificationAckBusy === n.id}
                          onClick={() => void acknowledgeNotification(n.id)}
                          className="inline-flex items-center justify-center gap-2 rounded-[var(--radius-button)] border-[3px] border-quizzer-black bg-quizzer-white px-2 py-1 text-xs font-semibold text-quizzer-black shadow-[var(--shadow-button)] hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[var(--shadow-button-hover)] disabled:opacity-50"
                        >
                          {notificationAckBusy === n.id ? <BtnSpinner /> : null}
                          Acknowledge
                        </button>
                      </div>
                    )}
                  </div>
                );
              }

              if (item.kind === "occurrence_cancelled") {
                const n = item.note;
                const p = item.payload;
                const q = quizLookup[p.quiz_event_id];
                const dimmed = item.isRead;
                const reason = (p.reason ?? "").trim();
                return (
                  <div
                    key={`cxl-${n.id}`}
                    className={`animate-admin-row rounded-[var(--radius-button)] border-[3px] border-quizzer-black/15 bg-quizzer-cream/40 p-4 ${
                      dimmed ? "opacity-60" : ""
                    }`}
                    style={{ "--admin-row-delay": `${Math.min(rowIdx, 20) * 32}ms` } as CSSProperties}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <span className="inline-block rounded-full border-[3px] border-quizzer-orange bg-quizzer-orange/10 px-2 py-0.5 text-xs font-semibold uppercase tracking-wide text-quizzer-orange">
                        Occurrence cancelled
                      </span>
                      {dimmed ? (
                        <span className="rounded-full border-2 border-quizzer-black/20 bg-quizzer-white px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-quizzer-black/60">
                          Acknowledged
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-2 font-semibold text-quizzer-black">
                      {labelForQuiz(q, p.quiz_event_id)}
                    </p>
                    <p className="mt-1 text-sm text-quizzer-black/80">
                      {formatOccurrenceDate(p.occurrence_date)} · cancelled by{" "}
                      <span className="font-medium text-quizzer-black">
                        {cancelledByLabel(p.cancelled_by)}
                      </span>
                    </p>
                    {reason ? (
                      <p className="mt-1 text-sm text-quizzer-black/85">
                        Reason: <span className="text-quizzer-black">{reason}</span>
                      </p>
                    ) : null}
                    <p className="mt-1 text-xs text-quizzer-black/55">
                      {new Date(n.created_at).toLocaleString("en-GB")}
                    </p>
                    {dimmed ? null : (
                      <div className="mt-3 flex flex-wrap gap-2">
                        <button
                          type="button"
                          disabled={notificationAckBusy === n.id}
                          onClick={() => void acknowledgeNotification(n.id)}
                          className="inline-flex items-center justify-center gap-2 rounded-[var(--radius-button)] border-[3px] border-quizzer-black bg-quizzer-white px-2 py-1 text-xs font-semibold text-quizzer-black shadow-[var(--shadow-button)] hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[var(--shadow-button-hover)] disabled:opacity-50"
                        >
                          {notificationAckBusy === n.id ? <BtnSpinner /> : null}
                          Acknowledge
                        </button>
                      </div>
                    )}
                  </div>
                );
              }

              const row = item.msg;
              const venueName = row.venues?.name ?? "Venue";
              const expanded = msgExpanded === row.id;
              return (
                <div
                  key={`msg-${row.id}`}
                  className="animate-admin-row rounded-[var(--radius-button)] border-[3px] border-quizzer-black/15 bg-quizzer-cream/40"
                  style={{ "--admin-row-delay": `${Math.min(rowIdx, 20) * 32}ms` } as CSSProperties}
                >
                  <div className="flex flex-wrap items-center gap-2 p-4 pb-2">
                    <span className="rounded-full border-[3px] border-quizzer-blue bg-quizzer-blue/10 px-2 py-0.5 text-xs font-semibold uppercase tracking-wide text-quizzer-blue">
                      Message
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => toggleMessage(row)}
                    className="w-full px-4 pb-3 text-left outline-none ring-quizzer-yellow focus-visible:ring-2"
                  >
                    <p className="font-semibold text-quizzer-black">
                      {venueName} · {row.message_type.replace(/_/g, " ")}
                    </p>
                    <p className="mt-1 text-sm text-quizzer-black/85">{snippet(row.body, 140)}</p>
                    <p className="mt-1 text-xs text-quizzer-black/55">{new Date(row.created_at).toLocaleString()}</p>
                  </button>
                  {expanded ? (
                    <div className="animate-admin-fade-in-up border-t-2 border-quizzer-black/10 px-4 pb-4 pt-2">
                      <p className="whitespace-pre-wrap text-sm text-quizzer-black">{row.body}</p>
                      <label className="mt-3 block text-xs font-medium text-quizzer-black">
                        Operator reply
                        <textarea
                          value={replyDraft[row.id] ?? ""}
                          onChange={(e) => setReplyDraft((d) => ({ ...d, [row.id]: e.target.value }))}
                          rows={4}
                          className="mt-1 w-full rounded-[var(--radius-button)] border-[3px] border-quizzer-black bg-quizzer-white px-2 py-1 text-sm outline-none focus:ring-2 focus:ring-quizzer-yellow"
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
                                [row.id]: e.target.value as "open" | "in_progress" | "resolved",
                              }))
                            }
                            className="rounded-[var(--radius-button)] border-[3px] border-quizzer-black bg-quizzer-white px-2 py-1 text-xs"
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
                          className="rounded-[var(--radius-button)] border-[3px] border-quizzer-black bg-quizzer-yellow px-3 py-1 text-xs font-semibold text-quizzer-black shadow-[var(--shadow-button)] hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[var(--shadow-button-hover)] disabled:opacity-50"
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

      {/* Zone 3 — Unhosted quizzes */}
      <section className="rounded-[var(--radius-button)] border-[3px] border-quizzer-black bg-quizzer-white p-4 shadow-[var(--shadow-card)]">
        <h2 className="flex flex-wrap items-center gap-2 font-heading text-sm uppercase tracking-wide text-quizzer-black">
          Quizzes needing a host
          <span className="rounded-full border-[3px] border-quizzer-black bg-quizzer-yellow px-2 py-0.5 text-xs font-semibold normal-case tracking-normal">
            {unhosted.length}
          </span>
        </h2>
        <div className="mt-4 space-y-3">
          {loading && unhosted.length === 0 ? (
            <p className="text-sm text-quizzer-black/60">Loading…</p>
          ) : unhosted.length === 0 ? (
            <p className="text-sm text-quizzer-black/60">Nothing to action.</p>
          ) : (
            unhosted.map((q, rowIdx) => {
              const dowIdx = Number(q.day_of_week);
              const dow =
                dowIdx >= 0 && dowIdx < DAY_NAMES.length ? DAY_NAMES[dowIdx] : `Day ${q.day_of_week}`;
              const next = formatNextOccurrence(String(q.next_occurrence ?? ""));
              const ic =
                typeof q.interest_count === "number" ? q.interest_count : Number(q.interest_count);
              return (
                <div
                  key={q.quiz_event_id}
                  className="animate-admin-row rounded-[var(--radius-button)] border-[3px] border-quizzer-black/15 bg-quizzer-cream/40 p-3"
                  style={{ "--admin-row-delay": `${Math.min(rowIdx, 12) * 42}ms` } as CSSProperties}
                >
                  <p className="font-semibold text-quizzer-black">{q.venue_name}</p>
                  <p className="mt-1 text-sm text-quizzer-black/85">
                    {dow} · {formatTime(q.start_time)}
                  </p>
                  <p className="mt-1 text-xs text-quizzer-black/70">
                    Next: <span className="font-medium text-quizzer-black">{next}</span>
                  </p>
                  <p className="mt-1 text-xs text-quizzer-black/70">
                    RSVP interest: <span className="font-medium text-quizzer-black">{ic}</span>
                  </p>
                </div>
              );
            })
          )}
        </div>
      </section>
    </div>
  );
}
