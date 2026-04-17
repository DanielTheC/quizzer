"use client";

import { createBrowserSupabaseClient } from "@/lib/supabase/browser";
import { captureSupabaseError } from "@/lib/observability/supabaseErrors";
import type { CSSProperties } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";

const REFRESH_MS = 60_000;

const DAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

function dayLabel(d: number): string {
  return DAY_SHORT[d] ?? String(d);
}

function formatTime(t: string): string {
  const s = String(t).trim();
  if (s.length >= 5) return s.slice(0, 5);
  return s;
}

function formatPence(pence: number | null | undefined): string {
  if (pence == null || !Number.isFinite(Number(pence))) return "—";
  return `£${(Number(pence) / 100).toFixed(2)}`;
}

function formatDateShort(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

type ClaimStatus = "pending" | "confirmed" | "rejected" | "cancelled";

export type ClaimRow = {
  id: string;
  quiz_event_id: string;
  host_email: string;
  status: ClaimStatus;
  claimed_at: string;
  reviewed_at: string | null;
  notes: string | null;
  venue_name: string;
  day_of_week: number;
  start_time: string;
  entry_fee_pence: number;
  host_fee_pence: number | null;
  host_default_fee_pence: number;
};

type QuizEventJoin = {
  id: string;
  day_of_week: number;
  start_time: string;
  entry_fee_pence: number | null;
  host_fee_pence: number | null;
  venue_id: string;
  venues: { name: string | null } | { name: string | null }[] | null;
};

function venueNameFromEvent(ev: QuizEventJoin | undefined): string {
  if (!ev) return "Unknown venue";
  const v = ev.venues;
  if (v == null) return "Unknown venue";
  const o = Array.isArray(v) ? v[0] : v;
  return o?.name?.trim() || "Unknown venue";
}

function parseStatus(s: string): ClaimStatus {
  if (s === "pending" || s === "confirmed" || s === "rejected" || s === "cancelled") return s;
  return "cancelled";
}

function BtnSpinner() {
  return (
    <span
      className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-quizzer-black border-t-transparent"
      aria-hidden
    />
  );
}

export function AdminClaimsDashboard() {
  const [rows, setRows] = useState<ClaimRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [toastError, setToastError] = useState<string | null>(null);
  const [notesDraft, setNotesDraft] = useState<Record<string, string>>({});
  const [busyMutationId, setBusyMutationId] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);

  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(id);
  }, [toast]);

  useEffect(() => {
    if (!toastError) return;
    const id = setTimeout(() => setToastError(null), 5000);
    return () => clearTimeout(id);
  }, [toastError]);

  const load = useCallback(async () => {
    const supabase = createBrowserSupabaseClient();
    setLoadError(null);

    const { data: claimsRaw, error: claimsErr } = await supabase
      .from("quiz_claims")
      .select("id, quiz_event_id, host_email, status, claimed_at, reviewed_at, notes")
      .order("claimed_at", { ascending: false });

    if (claimsErr) {
      captureSupabaseError("quiz_claims operator list", claimsErr);
      setLoadError(claimsErr.message);
      setRows([]);
      return;
    }

    const claims = (claimsRaw ?? []) as {
      id: string;
      quiz_event_id: string;
      host_email: string;
      status: string;
      claimed_at: string;
      reviewed_at: string | null;
      notes: string | null;
    }[];

    const eventIds = [...new Set(claims.map((c) => c.quiz_event_id))];
    const emails = [...new Set(claims.map((c) => c.host_email))];

    const [eventsRes, allowRes] = await Promise.all([
      eventIds.length > 0
        ? supabase
            .from("quiz_events")
            .select("id, day_of_week, start_time, entry_fee_pence, host_fee_pence, venue_id, venues(name)")
            .in("id", eventIds)
        : Promise.resolve({ data: [] as QuizEventJoin[], error: null }),
      emails.length > 0
        ? supabase.from("host_allowlisted_emails").select("email, default_fee_pence").in("email", emails)
        : Promise.resolve({ data: [] as { email: string; default_fee_pence: number | null }[], error: null }),
    ]);

    if (eventsRes.error) {
      captureSupabaseError("quiz_events claims join", eventsRes.error);
      setLoadError(eventsRes.error.message);
      setRows([]);
      return;
    }
    if (allowRes.error) {
      captureSupabaseError("host_allowlisted_emails claims join", allowRes.error);
      setLoadError(allowRes.error.message);
      setRows([]);
      return;
    }

    const eventMap = new Map<string, QuizEventJoin>();
    for (const e of eventsRes.data ?? []) {
      eventMap.set(e.id, e as QuizEventJoin);
    }

    const feeMap = new Map<string, number>();
    for (const r of allowRes.data ?? []) {
      const p = r.default_fee_pence;
      feeMap.set(
        r.email,
        p != null && Number.isFinite(Number(p)) ? Number(p) : 0
      );
    }

    const merged: ClaimRow[] = claims.map((c) => {
      const ev = eventMap.get(c.quiz_event_id);
      const hostDefault = feeMap.get(c.host_email) ?? 0;
      const entryPence = ev?.entry_fee_pence;
      return {
        id: c.id,
        quiz_event_id: c.quiz_event_id,
        host_email: c.host_email,
        status: parseStatus(c.status),
        claimed_at: c.claimed_at,
        reviewed_at: c.reviewed_at,
        notes: c.notes,
        venue_name: venueNameFromEvent(ev),
        day_of_week: ev?.day_of_week ?? 0,
        start_time: ev?.start_time ?? "",
        entry_fee_pence: entryPence != null && Number.isFinite(Number(entryPence)) ? Number(entryPence) : 0,
        host_fee_pence: ev?.host_fee_pence != null && Number.isFinite(Number(ev.host_fee_pence)) ? Number(ev.host_fee_pence) : null,
        host_default_fee_pence: hostDefault,
      };
    });

    setRows(merged);
    setNotesDraft((prev) => {
      const next: Record<string, string> = { ...prev };
      for (const r of merged) {
        if (next[r.id] === undefined) next[r.id] = r.notes ?? "";
      }
      for (const id of Object.keys(next)) {
        if (!merged.some((m) => m.id === id)) delete next[id];
      }
      return next;
    });
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true);
      await load();
      if (!cancelled) setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [load]);

  useEffect(() => {
    const t = setInterval(() => void load(), REFRESH_MS);
    return () => clearInterval(t);
  }, [load]);

  const pending = useMemo(() => rows.filter((r) => r.status === "pending"), [rows]);
  const history = useMemo(
    () => rows.filter((r) => r.status === "confirmed" || r.status === "rejected" || r.status === "cancelled"),
    [rows]
  );

  const updateClaim = useCallback(
    async (claim: ClaimRow, status: "confirmed" | "rejected") => {
      setBusyMutationId(claim.id);
      const supabase = createBrowserSupabaseClient();
      const notes = notesDraft[claim.id] ?? "";
      const { error } = await supabase
        .from("quiz_claims")
        .update({
          status,
          reviewed_at: new Date().toISOString(),
          notes: notes.trim() || null,
        })
        .eq("id", claim.id);

      setBusyMutationId(null);

      if (error) {
        captureSupabaseError("quiz_claims operator update", error);
        setToastError(error.message);
        return;
      }

      setToast(status === "confirmed" ? "Claim confirmed." : "Claim rejected.");
      await load();
    },
    [notesDraft, load]
  );

  const hostPayDisplay = (row: ClaimRow) => {
    const resolved = row.host_fee_pence ?? row.host_default_fee_pence;
    const label = row.host_fee_pence != null ? "event rate" : "default";
    return (
      <div>
        <div className="font-medium">{resolved > 0 ? formatPence(resolved) : "Pay TBC"}</div>
        <div className="text-xs text-quizzer-black/60">{label}</div>
      </div>
    );
  };

  const tableHeadClass = "border-b border-quizzer-black/20 bg-quizzer-cream";
  const thClass = "px-3 py-2 font-semibold";
  const tdClass = "px-3 py-2";

  return (
    <div className="space-y-6">
      <h1 className="font-heading text-2xl uppercase tracking-wide text-quizzer-black">Claims</h1>
      <p className="text-sm text-quizzer-black/80">Review host quiz claims. Pending items refresh every minute.</p>

      {toast ? (
        <p
          key={toast}
          className="animate-admin-fade-in-up rounded-[var(--radius-button)] border-2 border-quizzer-black bg-quizzer-yellow px-3 py-2 text-sm font-semibold text-quizzer-black shadow-[var(--shadow-card)]"
          role="status"
        >
          {toast}
        </p>
      ) : null}

      {toastError ? (
        <p
          key={toastError}
          className="animate-admin-fade-in-up rounded-[var(--radius-button)] border-2 border-quizzer-red bg-quizzer-white px-3 py-2 text-sm font-semibold text-quizzer-red shadow-[var(--shadow-card)]"
          role="alert"
        >
          {toastError}
        </p>
      ) : null}

      {loadError ? (
        <p className="rounded-[var(--radius-button)] border-2 border-quizzer-red bg-quizzer-white px-3 py-2 text-sm text-quizzer-red">
          {loadError}
        </p>
      ) : null}

      <section
        className="rounded-[var(--radius-button)] border-[var(--border-thick)] border-quizzer-black bg-quizzer-white p-4 shadow-[var(--shadow-card)]"
        style={{ "--admin-stagger": "0ms" } as CSSProperties}
      >
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <h2 className="font-heading text-sm uppercase tracking-wide text-quizzer-black">Pending claims</h2>
          <span className="rounded-full border-2 border-quizzer-black bg-quizzer-cream px-2 py-0.5 text-xs font-bold text-quizzer-black">
            {pending.length}
          </span>
        </div>

        {loading && rows.length === 0 ? (
          <p className="text-sm text-quizzer-black/60">Loading…</p>
        ) : pending.length === 0 ? (
          <p className="text-sm text-quizzer-black/70">No pending claims.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-sm text-quizzer-black">
              <thead>
                <tr className={tableHeadClass}>
                  <th className={thClass}>Venue</th>
                  <th className={thClass}>Day · Time</th>
                  <th className={thClass}>Entry fee</th>
                  <th className={thClass}>Host pay</th>
                  <th className={thClass}>Claimed by</th>
                  <th className={thClass}>Claimed</th>
                  <th className={thClass}>Notes</th>
                  <th className={thClass}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {pending.map((row, rowIdx) => (
                  <tr
                    key={row.id}
                    className="animate-admin-row border-b border-quizzer-black/10"
                    style={{ "--admin-row-delay": `${Math.min(rowIdx, 20) * 24}ms` } as CSSProperties}
                  >
                    <td className={`${tdClass} font-medium`}>{row.venue_name}</td>
                    <td className={tdClass}>
                      {dayLabel(row.day_of_week)} · {formatTime(row.start_time)}
                    </td>
                    <td className={tdClass}>{formatPence(row.entry_fee_pence)}</td>
                    <td className={tdClass}>{hostPayDisplay(row)}</td>
                    <td className={tdClass}>{row.host_email}</td>
                    <td className={tdClass}>{formatDateShort(row.claimed_at)}</td>
                    <td className={tdClass}>
                      <input
                        type="text"
                        value={notesDraft[row.id] ?? ""}
                        onChange={(e) => setNotesDraft((d) => ({ ...d, [row.id]: e.target.value }))}
                        className="w-full min-w-[8rem] rounded-[var(--radius-button)] border-2 border-quizzer-black bg-quizzer-white px-2 py-1 text-sm outline-none focus:ring-2 focus:ring-quizzer-yellow"
                        placeholder="Operator notes"
                        aria-label={`Notes for claim ${row.id}`}
                      />
                    </td>
                    <td className={tdClass}>
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          disabled={busyMutationId === row.id}
                          onClick={() => void updateClaim(row, "confirmed")}
                          className="inline-flex items-center justify-center gap-2 rounded-[var(--radius-button)] border-2 border-quizzer-black bg-quizzer-yellow px-2 py-1 text-xs font-semibold text-quizzer-black shadow-[var(--shadow-button)] hover:translate-x-[1px] hover:translate-y-[1px] disabled:opacity-50"
                        >
                          {busyMutationId === row.id ? <BtnSpinner /> : null}
                          Confirm
                        </button>
                        <button
                          type="button"
                          disabled={busyMutationId === row.id}
                          onClick={() => void updateClaim(row, "rejected")}
                          className="inline-flex items-center justify-center gap-2 rounded-[var(--radius-button)] border-2 border-quizzer-black bg-red-600 px-2 py-1 text-xs font-semibold text-white shadow-[var(--shadow-button)] hover:translate-x-[1px] hover:translate-y-[1px] hover:bg-red-700 disabled:opacity-50"
                        >
                          {busyMutationId === row.id ? <BtnSpinner /> : null}
                          Reject
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section
        className="rounded-[var(--radius-button)] border-[var(--border-thick)] border-quizzer-black bg-quizzer-white p-4 shadow-[var(--shadow-card)]"
        style={{ "--admin-stagger": "40ms" } as CSSProperties}
      >
        <button
          type="button"
          onClick={() => setShowHistory((v) => !v)}
          className="rounded-[var(--radius-button)] border-2 border-quizzer-black bg-quizzer-white px-3 py-2 text-sm font-semibold text-quizzer-black shadow-[var(--shadow-button)] hover:translate-x-[1px] hover:translate-y-[1px]"
        >
          {showHistory ? "Hide history" : `Show history (${history.length})`}
        </button>

        {showHistory && history.length > 0 ? (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full border-collapse text-left text-sm text-quizzer-black">
              <thead>
                <tr className={tableHeadClass}>
                  <th className={thClass}>Venue</th>
                  <th className={thClass}>Day · Time</th>
                  <th className={thClass}>Entry fee</th>
                  <th className={thClass}>Host pay</th>
                  <th className={thClass}>Claimed by</th>
                  <th className={thClass}>Claimed</th>
                  <th className={thClass}>Notes</th>
                  <th className={thClass}>Status</th>
                  <th className={thClass}>Reviewed</th>
                </tr>
              </thead>
              <tbody>
                {history.map((row, rowIdx) => (
                  <tr
                    key={row.id}
                    className="animate-admin-row border-b border-quizzer-black/10"
                    style={{ "--admin-row-delay": `${Math.min(rowIdx, 20) * 24}ms` } as CSSProperties}
                  >
                    <td className={`${tdClass} font-medium`}>{row.venue_name}</td>
                    <td className={tdClass}>
                      {dayLabel(row.day_of_week)} · {formatTime(row.start_time)}
                    </td>
                    <td className={tdClass}>{formatPence(row.entry_fee_pence)}</td>
                    <td className={tdClass}>{hostPayDisplay(row)}</td>
                    <td className={tdClass}>{row.host_email}</td>
                    <td className={tdClass}>{formatDateShort(row.claimed_at)}</td>
                    <td className={`${tdClass} max-w-[12rem] text-quizzer-black/80`}>
                      {row.notes?.trim() ? row.notes : "—"}
                    </td>
                    <td className={tdClass}>
                      {row.status === "confirmed" ? (
                        <span className="inline-block rounded-full border-2 border-quizzer-black bg-green-600 px-2 py-0.5 text-xs font-bold text-white">
                          Confirmed
                        </span>
                      ) : row.status === "rejected" ? (
                        <span className="inline-block rounded-full border-2 border-quizzer-black bg-red-600 px-2 py-0.5 text-xs font-bold text-white">
                          Rejected
                        </span>
                      ) : (
                        <span className="inline-block rounded-full border-2 border-quizzer-black bg-quizzer-cream px-2 py-0.5 text-xs font-bold text-quizzer-black/80">
                          Cancelled
                        </span>
                      )}
                    </td>
                    <td className={tdClass}>{formatDateShort(row.reviewed_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : showHistory && history.length === 0 ? (
          <p className="mt-4 text-sm text-quizzer-black/60">No history yet.</p>
        ) : null}
      </section>
    </div>
  );
}
