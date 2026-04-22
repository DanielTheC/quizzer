"use client";

import { createBrowserSupabaseClient } from "@/lib/supabase/browser";
import { captureSupabaseError } from "@/lib/observability/supabaseErrors";
import { formatTime24 as formatTime } from "@/lib/formatters";
import type { CSSProperties } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";

type Tab = "roster" | "allowlist" | "claims" | "payroll";

type PayrollHostRosterRow = {
  host_user_id: string;
  email: string;
  payout_this_month_pence: number;
  sessions_this_month: number;
};

type PayrollSessionRow = {
  id: string;
  host_user_id: string;
  session_date: string;
  venue_id: string;
  fee_pence: number | null;
  venue_name: string;
};

type AllowlistRow = {
  email: string;
  default_fee_pence: number;
  first_name: string | null;
  last_name: string | null;
};

type ClaimStatus = "pending" | "confirmed" | "rejected" | "cancelled";

type ClaimRow = {
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

type QuizEventRow = {
  id: string;
  day_of_week: number;
  start_time: string;
  entry_fee_pence: number | null;
  host_fee_pence: number | null;
  venue_id: string;
};

const DAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

function dayLabel(d: number): string {
  return DAY_SHORT[d] ?? String(d);
}

function formatDefaultFeePence(pence: number): string {
  const n = Number(pence);
  if (!Number.isFinite(n)) return "£0.00";
  return `£${(n / 100).toFixed(2)}`;
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

function poundsStringToPence(pounds: string): number | null {
  const t = pounds.trim().replace(",", ".");
  if (t === "") return null;
  const n = Number.parseFloat(t);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n * 100);
}

function parseStatus(s: string): ClaimStatus {
  if (s === "pending" || s === "confirmed" || s === "rejected" || s === "cancelled") return s;
  return "cancelled";
}

function allowlistDisplayName(row: Pick<AllowlistRow, "first_name" | "last_name">): string | null {
  const fn = row.first_name?.trim() || "";
  const ln = row.last_name?.trim() || "";
  if (!fn && !ln) return null;
  return [fn, ln].filter(Boolean).join(" ");
}

function BtnSpinner() {
  return (
    <span
      className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-quizzer-black border-t-transparent"
      aria-hidden
    />
  );
}

function normalizeHostRosterRpc(raw: unknown): PayrollHostRosterRow[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((row) => {
      const o = row as Record<string, unknown>;
      const uid = o.host_user_id ?? o.user_id;
      const email = o.email ?? o.host_email;
      return {
        host_user_id: uid != null ? String(uid) : "",
        email: email != null ? String(email) : "",
        payout_this_month_pence: Number(o.payout_this_month_pence ?? 0),
        sessions_this_month: Number(o.sessions_this_month ?? 0),
      };
    })
    .filter((r) => r.host_user_id.length > 0);
}

function venueNameFromSessionEmbed(venues: unknown): string {
  if (!venues) return "—";
  if (Array.isArray(venues)) {
    const n = (venues[0] as { name?: string } | undefined)?.name;
    return n?.trim() || "—";
  }
  if (typeof venues === "object" && venues !== null && "name" in venues) {
    const n = (venues as { name: string | null }).name;
    return n?.trim() || "—";
  }
  return "—";
}

function normalizePayrollSessions(raw: unknown): PayrollSessionRow[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((row) => {
    const o = row as Record<string, unknown>;
    return {
      id: String(o.id ?? ""),
      host_user_id: String(o.host_user_id ?? ""),
      session_date: String(o.session_date ?? ""),
      venue_id: String(o.venue_id ?? ""),
      fee_pence: o.fee_pence == null ? null : Number(o.fee_pence),
      venue_name: venueNameFromSessionEmbed(o.venues),
    };
  });
}

export function AdminHostsDashboard() {
  const [tab, setTab] = useState<Tab>("roster");

  const [allowlist, setAllowlist] = useState<AllowlistRow[]>([]);
  const [rosterLoading, setRosterLoading] = useState(true);
  const [rosterError, setRosterError] = useState<string | null>(null);

  const [selectedRosterEmail, setSelectedRosterEmail] = useState<string | null>(null);

  const [toast, setToast] = useState<string | null>(null);
  const [toastError, setToastError] = useState<string | null>(null);

  const [editingFeeEmail, setEditingFeeEmail] = useState<string | null>(null);
  const [defaultFeeDraft, setDefaultFeeDraft] = useState("");
  const [defaultFeeBusy, setDefaultFeeBusy] = useState<string | null>(null);
  const [editingNameEmail, setEditingNameEmail] = useState<string | null>(null);
  const [firstNameDraft, setFirstNameDraft] = useState("");
  const [lastNameDraft, setLastNameDraft] = useState("");
  const [nameSaveBusy, setNameSaveBusy] = useState<string | null>(null);
  const [removeBusy, setRemoveBusy] = useState<string | null>(null);

  const [claimRows, setClaimRows] = useState<ClaimRow[]>([]);
  const [claimsLoading, setClaimsLoading] = useState(false);
  const [claimsError, setClaimsError] = useState<string | null>(null);
  const [pendingClaimsCount, setPendingClaimsCount] = useState(0);
  const [claimNotesDraft, setClaimNotesDraft] = useState<Record<string, string>>({});
  const [busyMutation, setBusyMutation] = useState<{ id: string; action: "confirm" | "reject" } | null>(null);
  const [showClaimHistory, setShowClaimHistory] = useState(false);

  const [payrollLoaded, setPayrollLoaded] = useState(false);
  const [payrollLoading, setPayrollLoading] = useState(false);
  const [payrollError, setPayrollError] = useState<string | null>(null);
  const [payrollRows, setPayrollRows] = useState<PayrollHostRosterRow[]>([]);
  const [sessionRows, setSessionRows] = useState<PayrollSessionRow[]>([]);
  const [showPayrollSessions, setShowPayrollSessions] = useState(false);

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

  const loadRoster = useCallback(async () => {
    const supabase = createBrowserSupabaseClient();
    const { data, error: listError } = await supabase
      .from("host_allowlisted_emails")
      .select("email, default_fee_pence, first_name, last_name")
      .order("email", { ascending: true });

    if (listError) {
      captureSupabaseError("host_allowlisted_emails list", listError);
      setRosterError(listError.message);
      setAllowlist([]);
      return;
    }

    setRosterError(null);
    const rows: AllowlistRow[] = (data ?? []).map(
      (r: { email: string; default_fee_pence: number | null; first_name: string | null; last_name: string | null }) => ({
        email: r.email,
        default_fee_pence: r.default_fee_pence != null && Number.isFinite(Number(r.default_fee_pence)) ? Number(r.default_fee_pence) : 0,
        first_name: r.first_name?.trim() ? r.first_name : null,
        last_name: r.last_name?.trim() ? r.last_name : null,
      }),
    );
    setAllowlist(rows);
  }, []);

  const loadClaims = useCallback(async () => {
    await Promise.resolve();
    const supabase = createBrowserSupabaseClient();
    setClaimsError(null);
    setClaimsLoading(true);

    const { data: claimsRaw, error: claimsErr } = await supabase
      .from("quiz_claims")
      .select("id, quiz_event_id, host_email, status, claimed_at, reviewed_at, notes")
      .order("claimed_at", { ascending: false });

    if (claimsErr) {
      captureSupabaseError("quiz_claims hosts tab list", claimsErr);
      setClaimsError(claimsErr.message);
      setClaimRows([]);
      setPendingClaimsCount(0);
      setClaimsLoading(false);
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
    const hostEmails = [...new Set(claims.map((c) => c.host_email))];

    const { data: eventsData, error: eventsErr } =
      eventIds.length > 0
        ? await supabase
            .from("quiz_events")
            .select("id, day_of_week, start_time, entry_fee_pence, host_fee_pence, venue_id")
            .in("id", eventIds)
        : { data: [] as QuizEventRow[], error: null };

    if (eventsErr) {
      captureSupabaseError("quiz_events hosts claims join", eventsErr);
      setClaimsError(eventsErr.message);
      setClaimRows([]);
      setPendingClaimsCount(0);
      setClaimsLoading(false);
      return;
    }

    const events = (eventsData ?? []) as QuizEventRow[];
    const venueIds = [...new Set(events.map((e) => e.venue_id))];

    const [venuesRes, allowRes] = await Promise.all([
      venueIds.length > 0
        ? supabase.from("venues").select("id, name").in("id", venueIds)
        : Promise.resolve({ data: [] as { id: string; name: string | null }[], error: null }),
      hostEmails.length > 0
        ? supabase.from("host_allowlisted_emails").select("email, default_fee_pence").in("email", hostEmails)
        : Promise.resolve({ data: [] as { email: string; default_fee_pence: number | null }[], error: null }),
    ]);

    if (venuesRes.error) {
      captureSupabaseError("venues hosts claims join", venuesRes.error);
      setClaimsError(venuesRes.error.message);
      setClaimRows([]);
      setPendingClaimsCount(0);
      setClaimsLoading(false);
      return;
    }
    if (allowRes.error) {
      captureSupabaseError("host_allowlisted_emails hosts claims join", allowRes.error);
      setClaimsError(allowRes.error.message);
      setClaimRows([]);
      setPendingClaimsCount(0);
      setClaimsLoading(false);
      return;
    }

    const eventMap = new Map<string, QuizEventRow>();
    for (const e of events) {
      eventMap.set(e.id, e);
    }

    const venueNameMap = new Map<string, string>();
    for (const v of venuesRes.data ?? []) {
      venueNameMap.set(v.id, v.name?.trim() || "Unknown venue");
    }

    const feeMap = new Map<string, number>();
    for (const r of allowRes.data ?? []) {
      const p = r.default_fee_pence;
      feeMap.set(r.email, p != null && Number.isFinite(Number(p)) ? Number(p) : 0);
    }

    const merged: ClaimRow[] = claims.map((c) => {
      const ev = eventMap.get(c.quiz_event_id);
      const hostDefault = feeMap.get(c.host_email) ?? 0;
      const entryPence = ev?.entry_fee_pence;
      const venueName = ev ? venueNameMap.get(ev.venue_id) ?? "Unknown venue" : "Unknown venue";
      return {
        id: c.id,
        quiz_event_id: c.quiz_event_id,
        host_email: c.host_email,
        status: parseStatus(c.status),
        claimed_at: c.claimed_at,
        reviewed_at: c.reviewed_at,
        notes: c.notes,
        venue_name: venueName,
        day_of_week: ev?.day_of_week ?? 0,
        start_time: ev?.start_time ?? "",
        entry_fee_pence: entryPence != null && Number.isFinite(Number(entryPence)) ? Number(entryPence) : 0,
        host_fee_pence: ev?.host_fee_pence != null && Number.isFinite(Number(ev.host_fee_pence)) ? Number(ev.host_fee_pence) : null,
        host_default_fee_pence: hostDefault,
      };
    });

    setClaimRows(merged);
    setPendingClaimsCount(merged.filter((r) => r.status === "pending").length);
    setClaimNotesDraft((prev) => {
      const next: Record<string, string> = { ...prev };
      for (const r of merged) {
        if (next[r.id] === undefined) next[r.id] = r.notes ?? "";
      }
      for (const id of Object.keys(next)) {
        if (!merged.some((m) => m.id === id)) delete next[id];
      }
      return next;
    });
    setClaimsLoading(false);
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      await Promise.resolve();
      if (cancelled) return;
      setRosterLoading(true);
      await loadRoster();
      if (!cancelled) setRosterLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [loadRoster]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      await Promise.resolve();
      if (cancelled) return;
      await loadClaims();
    })();
    return () => {
      cancelled = true;
    };
  }, [loadClaims]);

  useEffect(() => {
    if (tab !== "claims") return;
    let cancelled = false;
    void (async () => {
      await Promise.resolve();
      if (cancelled) return;
      await loadClaims();
    })();
    return () => {
      cancelled = true;
    };
  }, [tab, loadClaims]);

  const loadPayroll = useCallback(async () => {
    await Promise.resolve();
    const supabase = createBrowserSupabaseClient();
    setPayrollError(null);
    setPayrollLoading(true);
    try {
      const now = new Date();
      const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);

      const [rosterRes, sessRes] = await Promise.all([
        supabase.rpc("operator_host_roster"),
        supabase
          .from("host_quiz_sessions")
          .select("id, host_user_id, session_date, venue_id, fee_pence, venues(name)")
          .gte("session_date", firstDayOfMonth)
          .order("session_date", { ascending: false }),
      ]);

      if (rosterRes.error) {
        captureSupabaseError("operator_host_roster", rosterRes.error);
        setPayrollError(rosterRes.error.message);
        setPayrollRows([]);
        setSessionRows([]);
        return;
      }
      if (sessRes.error) {
        captureSupabaseError("host_quiz_sessions payroll", sessRes.error);
        setPayrollError(sessRes.error.message);
        setPayrollRows([]);
        setSessionRows([]);
        return;
      }

      setPayrollRows(normalizeHostRosterRpc(rosterRes.data));
      setSessionRows(normalizePayrollSessions(sessRes.data));
    } finally {
      setPayrollLoading(false);
    }
  }, []);

  useEffect(() => {
    if (tab !== "payroll" || payrollLoaded) return;
    let cancelled = false;
    void (async () => {
      await Promise.resolve();
      if (cancelled) return;
      try {
        await loadPayroll();
      } finally {
        if (!cancelled) setPayrollLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [tab, payrollLoaded, loadPayroll]);

  const saveDefaultFee = useCallback(
    async (email: string, pounds: string) => {
      const pence = poundsStringToPence(pounds);
      if (pence === null) {
        setToast("Enter a valid fee (0 or more).");
        return;
      }

      setDefaultFeeBusy(email);
      const supabase = createBrowserSupabaseClient();
      const { error: upErr } = await supabase
        .from("host_allowlisted_emails")
        .update({ default_fee_pence: pence })
        .eq("email", email);

      setDefaultFeeBusy(null);

      if (upErr) {
        captureSupabaseError("host_allowlisted_emails update fee", upErr);
        setToastError(upErr.message);
        return;
      }

      setToast("Default fee saved.");
      await loadRoster();
      setEditingFeeEmail(null);
      setDefaultFeeDraft("");
    },
    [loadRoster]
  );

  const saveHostNames = useCallback(
    async (email: string, first: string, last: string) => {
      setNameSaveBusy(email);
      const supabase = createBrowserSupabaseClient();
      const fn = first.trim() || null;
      const ln = last.trim() || null;
      const { error: upErr } = await supabase
        .from("host_allowlisted_emails")
        .update({ first_name: fn, last_name: ln })
        .eq("email", email);

      setNameSaveBusy(null);

      if (upErr) {
        captureSupabaseError("host_allowlisted_emails update names", upErr);
        setToastError(upErr.message);
        return;
      }

      setToast("Name saved.");
      await loadRoster();
      setEditingNameEmail(null);
      setFirstNameDraft("");
      setLastNameDraft("");
    },
    [loadRoster]
  );

  const removeAllowlisted = useCallback(
    async (email: string) => {
      if (!window.confirm(`Remove ${email} from the allowlist?`)) return;

      setRemoveBusy(email);
      const supabase = createBrowserSupabaseClient();
      const { error: delErr } = await supabase.from("host_allowlisted_emails").delete().eq("email", email);
      setRemoveBusy(null);

      if (delErr) {
        captureSupabaseError("host_allowlisted_emails delete", delErr);
        setToastError(delErr.message);
        return;
      }

      setToast("Removed from allowlist.");
      if (selectedRosterEmail === email) setSelectedRosterEmail(null);
      if (editingFeeEmail === email) {
        setEditingFeeEmail(null);
        setDefaultFeeDraft("");
      }
      if (editingNameEmail === email) {
        setEditingNameEmail(null);
        setFirstNameDraft("");
        setLastNameDraft("");
      }
      await loadRoster();
      await loadClaims();
    },
    [loadRoster, loadClaims, selectedRosterEmail, editingFeeEmail, editingNameEmail]
  );

  const hostPayCell = (row: ClaimRow) => {
    const resolved = row.host_fee_pence ?? row.host_default_fee_pence;
    const label = row.host_fee_pence != null ? "event rate" : "default";
    return (
      <div>
        <div className="font-medium">{resolved > 0 ? formatPence(resolved) : "Pay TBC"}</div>
        <div className="text-xs text-quizzer-black/60">{label}</div>
      </div>
    );
  };

  const updateClaim = useCallback(
    async (claim: ClaimRow, status: "confirmed" | "rejected") => {
      const action = status === "confirmed" ? "confirm" : "reject";
      setBusyMutation({ id: claim.id, action });
      const supabase = createBrowserSupabaseClient();
      const notes = claimNotesDraft[claim.id] ?? "";
      const { error } = await supabase
        .from("quiz_claims")
        .update({
          status,
          reviewed_at: new Date().toISOString(),
          notes: notes.trim() || null,
        })
        .eq("id", claim.id);

      setBusyMutation(null);

      if (error) {
        captureSupabaseError("quiz_claims hosts tab update", error);
        setToastError(error.message);
        return;
      }

      setToast(status === "confirmed" ? "Claim confirmed." : "Claim rejected.");
      await loadClaims();
    },
    [claimNotesDraft, loadClaims]
  );

  const pendingClaims = claimRows.filter((r) => r.status === "pending");
  const historyClaims = claimRows.filter(
    (r) => r.status === "confirmed" || r.status === "rejected" || r.status === "cancelled"
  );

  const tableHeadClass = "border-b-[3px] border-quizzer-black bg-quizzer-cream";
  const thClass = "px-3 py-2 font-semibold";
  const tdClass = "px-3 py-2";

  const selectedRosterRow = allowlist.find((r) => r.email === selectedRosterEmail) ?? null;

  const rosterByUserId = useMemo(
    () => new Map(payrollRows.map((r) => [r.host_user_id, r])),
    [payrollRows],
  );

  const sessionsByHost = useMemo(() => {
    const m = new Map<string, PayrollSessionRow[]>();
    for (const s of sessionRows) {
      if (!s.host_user_id) continue;
      const list = m.get(s.host_user_id) ?? [];
      list.push(s);
      m.set(s.host_user_id, list);
    }
    return m;
  }, [sessionRows]);

  const payrollTableRows = useMemo(() => {
    const rows: {
      host_user_id: string;
      email: string;
      sessionCount: number;
      payout_this_month_pence: number;
      missingRates: boolean;
    }[] = [];
    for (const [uid, sessions] of sessionsByHost) {
      if (sessions.length === 0) continue;
      const roster = rosterByUserId.get(uid);
      const email = roster?.email?.trim() || uid;
      const payout = roster?.payout_this_month_pence ?? 0;
      const missingRates = sessions.some((s) => s.fee_pence === 0);
      rows.push({
        host_user_id: uid,
        email,
        sessionCount: sessions.length,
        payout_this_month_pence: payout,
        missingRates,
      });
    }
    rows.sort((a, b) => a.email.localeCompare(b.email));
    return rows;
  }, [sessionsByHost, rosterByUserId]);

  const totalOwedThisMonth = useMemo(
    () =>
      payrollRows.reduce(
        (sum, r) => sum + (Number.isFinite(r.payout_this_month_pence) ? r.payout_this_month_pence : 0),
        0,
      ),
    [payrollRows],
  );

  const hostsWithSessionsCount = useMemo(() => {
    const fromSessions = sessionsByHost.size;
    const fromRoster = payrollRows.filter((r) => r.sessions_this_month > 0).length;
    return Math.max(fromSessions, fromRoster);
  }, [payrollRows, sessionsByHost]);

  const allowlistNoSessionsCount = useMemo(() => {
    let n = 0;
    for (const a of allowlist) {
      const roster = payrollRows.find((r) => r.email.toLowerCase() === a.email.toLowerCase());
      const uid = roster?.host_user_id;
      const count = uid ? (sessionsByHost.get(uid)?.length ?? 0) : 0;
      if (count === 0) n++;
    }
    return n;
  }, [allowlist, payrollRows, sessionsByHost]);

  const sessionRowsSorted = useMemo(() => {
    return [...sessionRows].sort((a, b) => String(b.session_date).localeCompare(String(a.session_date)));
  }, [sessionRows]);

  const markPaidStub = useCallback((email: string) => {
    if (!window.confirm(`Mark payroll as paid for ${email}?`)) return;
    setToast("Marked as paid (manual record — no automatic payment processed).");
  }, []);

  return (
    <div className="space-y-6">
      <h1 className="font-heading text-2xl uppercase tracking-wide text-quizzer-black">Hosts</h1>

      <div className="flex gap-1 border-b-2 border-quizzer-black/10">
        {(["roster", "allowlist", "claims", "payroll"] as Tab[]).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`-mb-[2px] border-b-2 px-4 py-2 text-sm font-semibold capitalize transition-colors ${
              tab === t
                ? "border-quizzer-black text-quizzer-black"
                : "border-transparent text-quizzer-black/50 hover:text-quizzer-black"
            }`}
          >
            {t === "payroll"
              ? "Payroll"
              : t === "claims" && pendingClaimsCount > 0
                ? `Claims (${pendingClaimsCount})`
                : t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      <p className="text-sm text-quizzer-black/80">
        Manage the host roster, allowlist and fees, quiz claims, and monthly payroll.
      </p>

      {toast ? (
        <p
          key={toast}
          className="animate-admin-fade-in-up rounded-[var(--radius-button)] border-[3px] border-quizzer-black bg-quizzer-yellow px-3 py-2 text-sm font-semibold text-quizzer-black shadow-[var(--shadow-card)]"
          role="status"
        >
          {toast}
        </p>
      ) : null}

      {toastError ? (
        <p
          key={toastError}
          className="animate-admin-fade-in-up rounded-[var(--radius-button)] border-[3px] border-quizzer-red bg-quizzer-cream px-3 py-2 text-sm font-semibold text-quizzer-red shadow-[var(--shadow-card)]"
          role="alert"
        >
          {toastError}
        </p>
      ) : null}

      {rosterError ? (
        <p className="rounded-[var(--radius-button)] border-[3px] border-quizzer-red bg-quizzer-cream px-3 py-2 text-sm text-quizzer-red">
          {rosterError}
        </p>
      ) : null}

      {tab === "roster" && (
        <div
          className="rounded-[var(--radius-button)] border-[3px] border-quizzer-black bg-quizzer-white p-4 shadow-[var(--shadow-card)]"
          style={{ "--admin-stagger": "0ms" } as CSSProperties}
        >
          {rosterLoading ? (
            <p className="text-sm text-quizzer-black/70">Loading roster…</p>
          ) : allowlist.length === 0 ? (
            <p className="text-sm text-quizzer-black/70">No hosts on the roster yet.</p>
          ) : (
            <div className="flex flex-col gap-4 lg:flex-row">
              <div className="min-w-0 flex-1 overflow-x-auto">
                <table className="w-full border-collapse text-left text-sm text-quizzer-black">
                  <thead>
                    <tr className={tableHeadClass}>
                      <th className={thClass}>Email</th>
                      <th className={thClass}>Default fee</th>
                    </tr>
                  </thead>
                  <tbody>
                    {allowlist.map((row, rowIdx) => (
                      <tr
                        key={row.email}
                        role="button"
                        tabIndex={0}
                        onClick={() => setSelectedRosterEmail(row.email)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            setSelectedRosterEmail(row.email);
                          }
                        }}
                        className={`animate-admin-row cursor-pointer border-b border-quizzer-black/10 hover:bg-quizzer-cream/40 ${
                          selectedRosterEmail === row.email ? "bg-quizzer-yellow/25" : ""
                        }`}
                        style={{ "--admin-row-delay": `${Math.min(rowIdx, 20) * 24}ms` } as CSSProperties}
                      >
                        <td className={`${tdClass} font-medium`}>
                          {allowlistDisplayName(row) ? (
                            <>
                              <span>{allowlistDisplayName(row)}</span>
                              <span className="text-quizzer-black/70"> · {row.email}</span>
                            </>
                          ) : (
                            row.email
                          )}
                        </td>
                        <td className={tdClass}>{formatDefaultFeePence(row.default_fee_pence)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="lg:w-80 lg:shrink-0">
                {selectedRosterRow ? (
                  <div className="rounded-[var(--radius-button)] border-[3px] border-quizzer-black bg-quizzer-cream/50 p-4">
                    <h3 className="font-heading text-xs uppercase tracking-wide text-quizzer-black">Host detail</h3>
                    <p className="mt-2 font-semibold text-quizzer-black">
                      {allowlistDisplayName(selectedRosterRow) ? (
                        <>
                          {allowlistDisplayName(selectedRosterRow)}
                          <span className="font-normal text-quizzer-black/75"> · {selectedRosterRow.email}</span>
                        </>
                      ) : (
                        selectedRosterRow.email
                      )}
                    </p>
                    <p className="mt-2 text-sm text-quizzer-black/80">
                      Default pay:{" "}
                      <span className="font-semibold text-quizzer-black">
                        {formatDefaultFeePence(selectedRosterRow.default_fee_pence)}
                      </span>
                    </p>
                    <p className="mt-3 text-xs text-quizzer-black/60">
                      Edit fees or remove this host on the Allowlist tab.
                    </p>
                  </div>
                ) : (
                  <p className="text-sm text-quizzer-black/60">Select a row to view details.</p>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {tab === "allowlist" && (
        <div className="space-y-4">
          {rosterLoading ? (
            <p className="text-sm text-quizzer-black/70">Loading allowlist…</p>
          ) : allowlist.length === 0 ? (
            <p className="text-sm text-quizzer-black/70">No allowlisted emails yet.</p>
          ) : (
            <ul className="space-y-3">
              {allowlist.map((row) => (
                <li
                  key={row.email}
                  className="rounded-[var(--radius-button)] border-[3px] border-quizzer-black bg-quizzer-white p-4 shadow-[var(--shadow-card)]"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <p className="font-semibold text-quizzer-black">{row.email}</p>
                    <button
                      type="button"
                      disabled={removeBusy === row.email}
                      onClick={() => void removeAllowlisted(row.email)}
                      className="rounded-[var(--radius-button)] border-[3px] border-quizzer-black bg-quizzer-red px-3 py-1.5 text-xs font-semibold text-quizzer-white shadow-[var(--shadow-button)] hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[var(--shadow-button-hover)] disabled:opacity-50"
                    >
                      {removeBusy === row.email ? "Removing…" : "Remove"}
                    </button>
                  </div>
                  <div className="mt-2 text-sm">
                    <span className="text-quizzer-black/80">Name</span>
                    {editingNameEmail === row.email ? (
                      <div className="mt-1 flex flex-wrap items-center gap-2">
                        <input
                          type="text"
                          value={firstNameDraft}
                          onChange={(e) => setFirstNameDraft(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              void saveHostNames(row.email, firstNameDraft, lastNameDraft);
                            }
                          }}
                          onBlur={() => void saveHostNames(row.email, firstNameDraft, lastNameDraft)}
                          autoFocus
                          placeholder="First"
                          className="min-w-[6rem] rounded-[var(--radius-button)] border-[3px] border-quizzer-black bg-quizzer-white px-2 py-1 text-sm outline-none focus:ring-2 focus:ring-quizzer-yellow"
                          aria-label={`First name for ${row.email}`}
                        />
                        <input
                          type="text"
                          value={lastNameDraft}
                          onChange={(e) => setLastNameDraft(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              void saveHostNames(row.email, firstNameDraft, lastNameDraft);
                            }
                          }}
                          onBlur={() => void saveHostNames(row.email, firstNameDraft, lastNameDraft)}
                          placeholder="Last"
                          className="min-w-[6rem] rounded-[var(--radius-button)] border-[3px] border-quizzer-black bg-quizzer-white px-2 py-1 text-sm outline-none focus:ring-2 focus:ring-quizzer-yellow"
                          aria-label={`Last name for ${row.email}`}
                        />
                        <span className="text-xs text-quizzer-black/60">{nameSaveBusy === row.email ? "Saving…" : ""}</span>
                      </div>
                    ) : (
                      <div className="mt-1">
                        <button
                          type="button"
                          className="border-b-2 border-quizzer-black font-semibold text-quizzer-black underline decoration-2 underline-offset-2 hover:bg-quizzer-cream/50"
                          onClick={() => {
                            setEditingNameEmail(row.email);
                            setFirstNameDraft(row.first_name ?? "");
                            setLastNameDraft(row.last_name ?? "");
                          }}
                        >
                          {allowlistDisplayName(row) ?? (
                            <span className="font-normal text-quizzer-black/40">No name set</span>
                          )}
                        </button>
                      </div>
                    )}
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
                    <span className="text-quizzer-black/80">Default fee</span>
                    {editingFeeEmail === row.email ? (
                      <input
                        type="number"
                        min={0}
                        step={0.01}
                        value={defaultFeeDraft}
                        onChange={(e) => setDefaultFeeDraft(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            void saveDefaultFee(row.email, defaultFeeDraft);
                          }
                        }}
                        onBlur={() => {
                          void saveDefaultFee(row.email, defaultFeeDraft);
                        }}
                        autoFocus
                        className="w-[5.5rem] rounded-[var(--radius-button)] border-[3px] border-quizzer-black bg-quizzer-white px-2 py-1 text-sm outline-none focus:ring-2 focus:ring-quizzer-yellow"
                        aria-label={`Default fee in pounds for ${row.email}`}
                      />
                    ) : (
                      <button
                        type="button"
                        className="border-b-2 border-quizzer-black font-semibold text-quizzer-black underline decoration-2 underline-offset-2 hover:bg-quizzer-cream/50"
                        onClick={() => {
                          setEditingFeeEmail(row.email);
                          setDefaultFeeDraft((row.default_fee_pence / 100).toFixed(2));
                        }}
                      >
                        {formatDefaultFeePence(row.default_fee_pence)}
                      </button>
                    )}
                    <span className="text-xs text-quizzer-black/60">{defaultFeeBusy === row.email ? "Saving…" : ""}</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {tab === "claims" && (
        <div className="space-y-6">
          {claimsError ? (
            <p className="rounded-[var(--radius-button)] border-[3px] border-quizzer-red bg-quizzer-cream px-3 py-2 text-sm text-quizzer-red">
              {claimsError}
            </p>
          ) : null}

          <section
            className="rounded-[var(--radius-button)] border-[3px] border-quizzer-black bg-quizzer-white p-4 shadow-[var(--shadow-card)]"
            style={{ "--admin-stagger": "0ms" } as CSSProperties}
          >
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <h2 className="font-heading text-sm uppercase tracking-wide text-quizzer-black">Pending</h2>
              <span className="rounded-full border-2 border-quizzer-black bg-quizzer-cream px-2 py-0.5 text-xs font-bold text-quizzer-black">
                {pendingClaims.length}
              </span>
            </div>

            {claimsLoading && claimRows.length === 0 ? (
              <p className="text-sm text-quizzer-black/60">Loading claims…</p>
            ) : pendingClaims.length === 0 ? (
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
                      <th className={thClass}>Claimed at</th>
                      <th className={thClass}>Notes</th>
                      <th className={thClass}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pendingClaims.map((row, rowIdx) => (
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
                        <td className={tdClass}>{hostPayCell(row)}</td>
                        <td className={tdClass}>{row.host_email}</td>
                        <td className={tdClass}>{formatDateShort(row.claimed_at)}</td>
                        <td className={tdClass}>
                          <input
                            type="text"
                            value={claimNotesDraft[row.id] ?? ""}
                            onChange={(e) => setClaimNotesDraft((d) => ({ ...d, [row.id]: e.target.value }))}
                            className="w-full min-w-[8rem] rounded-[var(--radius-button)] border-[3px] border-quizzer-black bg-quizzer-white px-2 py-1 text-sm outline-none focus:ring-2 focus:ring-quizzer-yellow"
                            placeholder="Operator notes"
                            aria-label={`Notes for claim ${row.id}`}
                          />
                        </td>
                        <td className={tdClass}>
                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              disabled={busyMutation?.id === row.id}
                              onClick={() => void updateClaim(row, "confirmed")}
                              className="inline-flex items-center justify-center gap-2 rounded-[var(--radius-button)] border-[3px] border-quizzer-black bg-quizzer-yellow px-2 py-1 text-xs font-semibold text-quizzer-black shadow-[var(--shadow-button)] hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[var(--shadow-button-hover)] disabled:opacity-50"
                            >
                              {busyMutation?.id === row.id && busyMutation.action === "confirm" ? <BtnSpinner /> : null}
                              Confirm
                            </button>
                            <button
                              type="button"
                              disabled={busyMutation?.id === row.id}
                              onClick={() => void updateClaim(row, "rejected")}
                              className="inline-flex items-center justify-center gap-2 rounded-[var(--radius-button)] border-[3px] border-quizzer-black bg-quizzer-red px-2 py-1 text-xs font-semibold text-quizzer-white shadow-[var(--shadow-button)] hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[var(--shadow-button-hover)] disabled:opacity-50"
                            >
                              {busyMutation?.id === row.id && busyMutation.action === "reject" ? <BtnSpinner /> : null}
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
            className="rounded-[var(--radius-button)] border-[3px] border-quizzer-black bg-quizzer-white p-4 shadow-[var(--shadow-card)]"
            style={{ "--admin-stagger": "40ms" } as CSSProperties}
          >
            <button
              type="button"
              onClick={() => setShowClaimHistory((v) => !v)}
              className="rounded-[var(--radius-button)] border-[3px] border-quizzer-black bg-quizzer-white px-3 py-2 text-sm font-semibold text-quizzer-black shadow-[var(--shadow-button)] hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[var(--shadow-button-hover)]"
            >
              {showClaimHistory ? "Hide history" : `Show history (${historyClaims.length})`}
            </button>

            {showClaimHistory && historyClaims.length > 0 ? (
              <div className="mt-4 overflow-x-auto">
                <table className="w-full border-collapse text-left text-sm text-quizzer-black">
                  <thead>
                    <tr className={tableHeadClass}>
                      <th className={thClass}>Venue</th>
                      <th className={thClass}>Day · Time</th>
                      <th className={thClass}>Host pay</th>
                      <th className={thClass}>Claimed by</th>
                      <th className={thClass}>Status</th>
                      <th className={thClass}>Reviewed at</th>
                      <th className={thClass}>Notes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {historyClaims.map((row, rowIdx) => (
                      <tr
                        key={row.id}
                        className="animate-admin-row border-b border-quizzer-black/10"
                        style={{ "--admin-row-delay": `${Math.min(rowIdx, 20) * 24}ms` } as CSSProperties}
                      >
                        <td className={`${tdClass} font-medium`}>{row.venue_name}</td>
                        <td className={tdClass}>
                          {dayLabel(row.day_of_week)} · {formatTime(row.start_time)}
                        </td>
                        <td className={tdClass}>{hostPayCell(row)}</td>
                        <td className={tdClass}>{row.host_email}</td>
                        <td className={tdClass}>
                          {row.status === "confirmed" ? (
                            <span className="inline-block rounded-full border-[3px] border-quizzer-black bg-quizzer-green px-2 py-0.5 text-xs font-bold text-quizzer-white">
                              Confirmed
                            </span>
                          ) : row.status === "rejected" ? (
                            <span className="inline-block rounded-full border-[3px] border-quizzer-black bg-quizzer-red px-2 py-0.5 text-xs font-bold text-quizzer-white">
                              Rejected
                            </span>
                          ) : (
                            <span className="inline-block rounded-full border-2 border-quizzer-black bg-quizzer-cream px-2 py-0.5 text-xs font-bold text-quizzer-black/80">
                              Cancelled
                            </span>
                          )}
                        </td>
                        <td className={tdClass}>{formatDateShort(row.reviewed_at)}</td>
                        <td className={`${tdClass} max-w-[12rem] text-quizzer-black/80`}>
                          {row.notes?.trim() ? row.notes : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : showClaimHistory && historyClaims.length === 0 ? (
              <p className="mt-4 text-sm text-quizzer-black/60">No history yet.</p>
            ) : null}
          </section>
        </div>
      )}

      {tab === "payroll" && (
        <div className="space-y-4">
          {payrollError ? (
            <p className="rounded-[var(--radius-button)] border-[3px] border-quizzer-red bg-quizzer-cream px-3 py-2 text-sm text-quizzer-red">
              {payrollError}
            </p>
          ) : null}

          {payrollLoading && !payrollLoaded ? (
            <p className="text-sm text-quizzer-black/70">Loading payroll…</p>
          ) : null}

          {payrollLoaded ? (
            <>
              <div className="flex flex-wrap gap-2">
                <div className="rounded-[var(--radius-button)] border-[3px] border-quizzer-black bg-quizzer-cream px-3 py-2 text-sm shadow-[var(--shadow-card)]">
                  <span className="text-xs font-semibold uppercase tracking-wide text-quizzer-black/80">
                    Total owed this month
                  </span>
                  <p className="font-heading text-xl text-quizzer-black">{formatPence(totalOwedThisMonth)}</p>
                </div>
                <div className="rounded-[var(--radius-button)] border-[3px] border-quizzer-black bg-quizzer-cream px-3 py-2 text-sm shadow-[var(--shadow-card)]">
                  <span className="text-xs font-semibold uppercase tracking-wide text-quizzer-black/80">
                    Hosts with sessions
                  </span>
                  <p className="font-heading text-xl text-quizzer-black">{hostsWithSessionsCount}</p>
                </div>
                <div className="rounded-[var(--radius-button)] border-[3px] border-quizzer-black bg-quizzer-cream px-3 py-2 text-sm shadow-[var(--shadow-card)]">
                  <span className="text-xs font-semibold uppercase tracking-wide text-quizzer-black/80">
                    Sessions recorded
                  </span>
                  <p className="font-heading text-xl text-quizzer-black">{sessionRows.length}</p>
                </div>
              </div>

              <section
                className="rounded-[var(--radius-button)] border-[3px] border-quizzer-black bg-quizzer-white p-4 shadow-[var(--shadow-card)]"
                style={{ "--admin-stagger": "0ms" } as CSSProperties}
              >
                <h2 className="font-heading text-sm uppercase tracking-wide text-quizzer-black">Payroll by host</h2>
                {payrollTableRows.length === 0 ? (
                  <p className="mt-3 text-sm text-quizzer-black/70">No hosts with sessions recorded this month.</p>
                ) : (
                  <div className="mt-4 overflow-x-auto">
                    <table className="w-full border-collapse text-left text-sm text-quizzer-black">
                      <thead>
                        <tr className={tableHeadClass}>
                          <th className={thClass}>Host</th>
                          <th className={thClass}>Sessions</th>
                          <th className={thClass}>Amount owed</th>
                          <th className={thClass}>Missing rates</th>
                          <th className={thClass}>Mark as paid</th>
                        </tr>
                      </thead>
                      <tbody>
                        {payrollTableRows.map((row, rowIdx) => (
                          <tr
                            key={row.host_user_id}
                            className="animate-admin-row border-b border-quizzer-black/10"
                            style={
                              { "--admin-row-delay": `${Math.min(rowIdx, 20) * 24}ms` } as CSSProperties
                            }
                          >
                            <td className={`${tdClass} font-medium`}>{row.email}</td>
                            <td className={tdClass}>{row.sessionCount}</td>
                            <td className={tdClass}>{formatPence(row.payout_this_month_pence)}</td>
                            <td className={tdClass}>
                              {row.missingRates ? (
                                <span className="rounded-full border-[3px] border-quizzer-orange bg-quizzer-yellow/20 px-2 py-0.5 text-xs font-semibold uppercase tracking-wide text-quizzer-orange">
                                  Some sessions have £0 fee
                                </span>
                              ) : (
                                <span className="text-quizzer-black/40">—</span>
                              )}
                            </td>
                            <td className={tdClass}>
                              <button
                                type="button"
                                onClick={() => markPaidStub(row.email)}
                                className="rounded-[var(--radius-button)] border-[3px] border-quizzer-black bg-quizzer-yellow px-2 py-1 text-xs font-semibold text-quizzer-black shadow-[var(--shadow-button)] hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[var(--shadow-button-hover)]"
                              >
                                Mark as paid
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                <p className="mt-4 text-xs text-quizzer-black/70">
                  {allowlistNoSessionsCount} host{allowlistNoSessionsCount === 1 ? "" : "s"} on allowlist with no
                  sessions this month.
                </p>
              </section>

              <section
                className="rounded-[var(--radius-button)] border-[3px] border-quizzer-black bg-quizzer-white p-4 shadow-[var(--shadow-card)]"
                style={{ "--admin-stagger": "40ms" } as CSSProperties}
              >
                <button
                  type="button"
                  onClick={() => setShowPayrollSessions((v) => !v)}
                  className="rounded-[var(--radius-button)] border-[3px] border-quizzer-black bg-quizzer-white px-3 py-2 text-sm font-semibold text-quizzer-black shadow-[var(--shadow-button)] hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[var(--shadow-button-hover)]"
                >
                  {showPayrollSessions ? "Hide sessions" : `Show all sessions (${sessionRows.length})`}
                </button>
                {showPayrollSessions && sessionRowsSorted.length > 0 ? (
                  <div className="mt-4 overflow-x-auto">
                    <table className="w-full border-collapse text-left text-sm text-quizzer-black">
                      <thead>
                        <tr className={tableHeadClass}>
                          <th className={thClass}>Date</th>
                          <th className={thClass}>Host</th>
                          <th className={thClass}>Venue</th>
                          <th className={thClass}>Fee</th>
                        </tr>
                      </thead>
                      <tbody>
                        {sessionRowsSorted.map((s, rowIdx) => {
                          const hostEmail = rosterByUserId.get(s.host_user_id)?.email ?? s.host_user_id;
                          return (
                            <tr
                              key={s.id}
                              className="animate-admin-row border-b border-quizzer-black/10"
                              style={
                                { "--admin-row-delay": `${Math.min(rowIdx, 20) * 24}ms` } as CSSProperties
                              }
                            >
                              <td className={tdClass}>{formatDateShort(s.session_date)}</td>
                              <td className={tdClass}>{hostEmail}</td>
                              <td className={tdClass}>{s.venue_name}</td>
                              <td className={tdClass}>{formatPence(s.fee_pence)}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                ) : showPayrollSessions && sessionRowsSorted.length === 0 ? (
                  <p className="mt-4 text-sm text-quizzer-black/60">No sessions this month.</p>
                ) : null}
              </section>
            </>
          ) : null}
        </div>
      )}
    </div>
  );
}
