"use client";

import { createBrowserSupabaseClient } from "@/lib/supabase/browser";
import { captureSupabaseError } from "@/lib/observability/supabaseErrors";
import { useCallback, useEffect, useState } from "react";

type AllowlistRow = {
  email: string;
  default_fee_pence: number;
};

function formatDefaultFeePence(pence: number): string {
  const n = Number(pence);
  if (!Number.isFinite(n)) return "£0.00";
  return `£${(n / 100).toFixed(2)}`;
}

function poundsStringToPence(pounds: string): number | null {
  const t = pounds.trim().replace(",", ".");
  if (t === "") return null;
  const n = Number.parseFloat(t);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n * 100);
}

export function AdminHostsDashboard() {
  const [allowlist, setAllowlist] = useState<AllowlistRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const [editingFeeEmail, setEditingFeeEmail] = useState<string | null>(null);
  const [defaultFeeDraft, setDefaultFeeDraft] = useState("");
  const [defaultFeeBusy, setDefaultFeeBusy] = useState<string | null>(null);

  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(id);
  }, [toast]);

  const loadRoster = useCallback(async () => {
    const supabase = createBrowserSupabaseClient();
    const { data, error: listError } = await supabase
      .from("host_allowlisted_emails")
      .select("email, default_fee_pence")
      .order("email", { ascending: true });

    if (listError) {
      captureSupabaseError("host_allowlisted_emails list", listError);
      setError(listError.message);
      setAllowlist([]);
      return;
    }

    setError(null);
    const rows: AllowlistRow[] = (data ?? []).map((r: { email: string; default_fee_pence: number | null }) => ({
      email: r.email,
      default_fee_pence: r.default_fee_pence != null && Number.isFinite(Number(r.default_fee_pence)) ? Number(r.default_fee_pence) : 0,
    }));
    setAllowlist(rows);
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true);
      await loadRoster();
      if (!cancelled) setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [loadRoster]);

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
        setToast(upErr.message);
        return;
      }

      setToast("Default fee saved.");
      await loadRoster();
      setEditingFeeEmail(null);
      setDefaultFeeDraft("");
    },
    [loadRoster]
  );

  return (
    <div className="space-y-6">
      <h1 className="font-heading text-2xl uppercase tracking-wide text-quizzer-black">Hosts</h1>
      <p className="text-sm text-quizzer-black/80">Allowlisted host emails and default pay rates.</p>

      {toast ? (
        <p
          key={toast}
          className="animate-admin-fade-in-up rounded-[var(--radius-button)] border-2 border-quizzer-black bg-quizzer-yellow px-3 py-2 text-sm font-semibold text-quizzer-black shadow-[var(--shadow-card)]"
          role="status"
        >
          {toast}
        </p>
      ) : null}

      {error ? (
        <p className="rounded-[var(--radius-button)] border-2 border-quizzer-red bg-quizzer-white px-3 py-2 text-sm text-quizzer-red">{error}</p>
      ) : null}

      {loading ? (
        <p className="text-sm text-quizzer-black/70">Loading allowlist…</p>
      ) : allowlist.length === 0 ? (
        <p className="text-sm text-quizzer-black/70">No allowlisted emails yet.</p>
      ) : (
        <ul className="space-y-3">
          {allowlist.map((row) => (
            <li
              key={row.email}
              className="rounded-[var(--radius-button)] border-[var(--border-thick)] border-quizzer-black bg-quizzer-white p-4 shadow-[var(--shadow-card)]"
            >
              <p className="font-semibold text-quizzer-black">{row.email}</p>
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
                    className="w-[5.5rem] rounded-[var(--radius-button)] border-2 border-quizzer-black bg-quizzer-white px-2 py-1 text-sm outline-none focus:ring-2 focus:ring-quizzer-yellow"
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
  );
}
