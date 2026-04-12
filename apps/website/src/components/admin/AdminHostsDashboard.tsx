"use client";

import { createBrowserSupabaseClient } from "@/lib/supabase/browser";
import { captureSupabaseError } from "@/lib/observability/supabaseErrors";
import type { CSSProperties } from "react";
import { useCallback, useEffect, useRef, useState } from "react";

const REFRESH_MS = 60_000;
const USER_ACTIVITY_REFETCH_GAP_MS = 900;

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

export function AdminHostsDashboard() {
  const [allowlist, setAllowlist] = useState<AllowlistRow[]>([]);
  const [approved, setApproved] = useState<ApprovedHostRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [newEmail, setNewEmail] = useState("");
  const [addBusy, setAddBusy] = useState(false);
  const [removeBusy, setRemoveBusy] = useState<string | null>(null);

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
      const [al, ap] = await Promise.all([
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

      if (al.error) {
        captureSupabaseError("admin.host_allowlisted_emails_list", al.error);
        throw new Error(al.error.message);
      }
      if (ap.error) {
        captureSupabaseError("admin.host_applications_approved_list", ap.error);
        throw new Error(ap.error.message);
      }

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
    const timer = window.setTimeout(() => setToast(null), 3200);
    return () => window.clearTimeout(timer);
  }, [toast]);

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
      void load();
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
      void load();
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
      <h1 className="font-heading animate-admin-fade-in-up text-2xl uppercase text-quizzer-black">
        Hosts
      </h1>
      {error ? (
        <p className="animate-admin-fade-in-up rounded-[var(--radius-button)] border-2 border-quizzer-red bg-quizzer-white px-3 py-2 text-sm text-quizzer-red">
          {error}
        </p>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-2">
        <section
          className="animate-admin-fade-in-up flex min-h-[320px] flex-col rounded-[var(--radius-button)] border-[var(--border-thick)] border-quizzer-black bg-quizzer-white p-4 shadow-[var(--shadow-card)]"
          style={{ "--admin-stagger": "0ms" } as CSSProperties}
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
          className="animate-admin-fade-in-up flex min-h-[320px] flex-col rounded-[var(--radius-button)] border-[var(--border-thick)] border-quizzer-black bg-quizzer-white p-4 shadow-[var(--shadow-card)]"
          style={{ "--admin-stagger": "70ms" } as CSSProperties}
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
                      <span className="text-quizzer-black/80">Linked to quiz ✓</span>
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
    </div>
  );
}
