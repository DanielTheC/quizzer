"use client";

import { createBrowserSupabaseClient } from "@/lib/supabase/browser";
import { captureSupabaseError } from "@/lib/observability/supabaseErrors";
import type { CSSProperties } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";

type EnquiryStatus = "new" | "in_progress" | "converted" | "rejected";

type VenueEnquiryRow = {
  id: string;
  venue_name: string;
  contact_name: string;
  email: string;
  phone: string | null;
  city: string | null;
  frequency: string | null;
  existing: string | null;
  message: string | null;
  status: EnquiryStatus;
  source_ip: string | null;
  created_at: string;
  reviewed_at: string | null;
  operator_notes: string | null;
};

const STATUS_OPTIONS: { value: EnquiryStatus; label: string }[] = [
  { value: "new", label: "New" },
  { value: "in_progress", label: "In progress" },
  { value: "converted", label: "Converted" },
  { value: "rejected", label: "Rejected" },
];

const FREQUENCY_LABEL: Record<string, string> = {
  one_off: "One-off",
  weekly: "Weekly",
  monthly: "Monthly",
  not_sure: "Not sure",
};

const EXISTING_LABEL: Record<string, string> = {
  already_runs: "Already runs a quiz",
  wants_to_start: "Wants to start",
};

function formatIso(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function AdminVenueEnquiriesDashboard() {
  const [rows, setRows] = useState<VenueEnquiryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  /** "all" or specific status */
  const [filter, setFilter] = useState<"all" | EnquiryStatus>("all");

  const [draftStatus, setDraftStatus] = useState<Record<string, EnquiryStatus>>({});
  const [draftNotes, setDraftNotes] = useState<Record<string, string>>({});
  const [savingId, setSavingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setErrorMsg(null);
    setLoading(true);
    try {
      const supabase = createBrowserSupabaseClient();
      let q = supabase
        .from("venue_enquiries")
        .select(
          "id, venue_name, contact_name, email, phone, city, frequency, existing, message, status, source_ip, created_at, reviewed_at, operator_notes",
        )
        .order("created_at", { ascending: false });
      if (filter !== "all") {
        q = q.eq("status", filter);
      }
      const { data, error } = await q;
      if (error) {
        captureSupabaseError("admin.venue_enquiries.list", error);
        setErrorMsg(error.message);
        setRows([]);
        return;
      }
      const list = (data ?? []) as VenueEnquiryRow[];
      setRows(list);
      setDraftStatus((prev) => {
        const next = { ...prev };
        for (const r of list) {
          if (!(r.id in next)) next[r.id] = r.status;
        }
        return next;
      });
      setDraftNotes((prev) => {
        const next = { ...prev };
        for (const r of list) {
          if (!(r.id in next)) next[r.id] = r.operator_notes ?? "";
        }
        return next;
      });
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    void load();
  }, [load]);

  const newCount = useMemo(() => rows.filter((r) => r.status === "new").length, [rows]);

  async function saveRow(id: string) {
    const status = draftStatus[id];
    const notes = draftNotes[id]?.trim() ?? "";
    if (!status) return;
    setSavingId(id);
    setToast(null);
    try {
      const supabase = createBrowserSupabaseClient();
      const { error } = await supabase
        .from("venue_enquiries")
        .update({
          status,
          operator_notes: notes || null,
          reviewed_at: new Date().toISOString(),
        })
        .eq("id", id);
      if (error) {
        captureSupabaseError("admin.venue_enquiries.update", error, { id });
        setErrorMsg(error.message);
        return;
      }
      setToast("Saved.");
      await load();
    } finally {
      setSavingId(null);
    }
  }

  return (
    <section
      className="animate-admin-fade-in-up space-y-6"
      style={{ "--admin-stagger": "60ms" } as CSSProperties}
    >
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-heading text-2xl text-quizzer-black md:text-3xl">Venue enquiries</h1>
          <p className="mt-1 max-w-xl text-sm text-quizzer-black/80">
            Submissions from the host-a-quiz page (website). {newCount > 0 ? `${newCount} new in view.` : ""}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {(
          [
            ["all", "All"],
            ...STATUS_OPTIONS.map((s) => [s.value, s.label] as const),
          ] as const
        ).map(([value, label]) => {
          const active = filter === value;
          return (
            <button
              key={value}
              type="button"
              onClick={() => setFilter(value)}
              className={`rounded-[var(--radius-button)] border-[3px] border-quizzer-black px-3 py-1.5 text-xs font-semibold shadow-[var(--shadow-button)] transition hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[var(--shadow-button-hover)] ${
                active ? "bg-quizzer-yellow text-quizzer-black" : "bg-quizzer-white text-quizzer-black"
              }`}
            >
              {label}
            </button>
          );
        })}
      </div>

      {errorMsg ? (
        <p className="rounded-[var(--radius-button)] border-[3px] border-quizzer-red bg-quizzer-cream px-3 py-2 text-sm text-quizzer-red" role="alert">
          {errorMsg}
        </p>
      ) : null}

      {toast ? (
        <p className="rounded-[var(--radius-button)] border-[3px] border-quizzer-black bg-quizzer-yellow px-3 py-2 text-sm font-medium text-quizzer-black shadow-[var(--shadow-button)]">
          {toast}
        </p>
      ) : null}

      {loading ? (
        <p className="text-sm text-quizzer-black/70">Loading…</p>
      ) : rows.length === 0 ? (
        <div className="rounded-[var(--radius-button)] border-[3px] border-quizzer-black border-dashed bg-quizzer-white p-8 text-center text-quizzer-black/80">
          No enquiries match this filter.
        </div>
      ) : (
        <div className="space-y-4">
          {rows.map((r) => (
            <article
              key={r.id}
              className="rounded-[var(--radius-button)] border-[3px] border-quizzer-black bg-quizzer-white p-4 shadow-[var(--shadow-card)]"
            >
              <div className="flex flex-wrap items-start justify-between gap-3 border-b-[2px] border-quizzer-black/10 pb-3">
                <div>
                  <h2 className="font-heading text-lg text-quizzer-black">{r.venue_name}</h2>
                  <p className="mt-1 text-sm text-quizzer-black/80">
                    {r.contact_name} ·{" "}
                    <a href={`mailto:${encodeURIComponent(r.email)}`} className="underline font-medium">
                      {r.email}
                    </a>
                  </p>
                  {r.phone ? <p className="mt-1 text-xs text-quizzer-black/70">{r.phone}</p> : null}
                  {r.city ? <p className="mt-1 text-xs text-quizzer-black/70">{r.city}</p> : null}
                </div>
                <div className="text-right text-xs text-quizzer-black/60">
                  <div>{formatIso(r.created_at)}</div>
                  {r.source_ip ? <div className="mt-1">IP: {r.source_ip}</div> : null}
                </div>
              </div>

              <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
                <div>
                  <dt className="font-semibold text-quizzer-black">Frequency</dt>
                  <dd className="text-quizzer-black/80">
                    {(r.frequency && FREQUENCY_LABEL[r.frequency]) || r.frequency || "—"}
                  </dd>
                </div>
                <div>
                  <dt className="font-semibold text-quizzer-black">Quiz situation</dt>
                  <dd className="text-quizzer-black/80">
                    {(r.existing && EXISTING_LABEL[r.existing]) || r.existing || "—"}
                  </dd>
                </div>
              </dl>

              {r.message ? (
                <div className="mt-3">
                  <div className="font-semibold text-quizzer-black">Message</div>
                  <p className="mt-1 whitespace-pre-wrap rounded-[var(--radius-button)] border border-quizzer-black/20 bg-quizzer-cream/50 px-3 py-2 text-sm text-quizzer-black/90">
                    {r.message}
                  </p>
                </div>
              ) : null}

              <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-start">
                <label className="block text-xs font-semibold uppercase text-quizzer-black">
                  Status
                  <select
                    className="mt-1 block w-full max-w-[14rem] rounded-[var(--radius-button)] border-[3px] border-quizzer-black bg-quizzer-white px-2 py-2 text-sm"
                    value={draftStatus[r.id] ?? r.status}
                    onChange={(e) =>
                      setDraftStatus((prev) => ({ ...prev, [r.id]: e.target.value as EnquiryStatus }))
                    }
                  >
                    {STATUS_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block min-w-0 flex-1 text-xs font-semibold uppercase text-quizzer-black">
                  Operator notes
                  <textarea
                    className="mt-1 block w-full rounded-[var(--radius-button)] border-[3px] border-quizzer-black bg-quizzer-white px-2 py-2 text-sm outline-none focus:ring-2 focus:ring-quizzer-yellow"
                    rows={3}
                    value={draftNotes[r.id] ?? ""}
                    onChange={(e) => setDraftNotes((prev) => ({ ...prev, [r.id]: e.target.value }))}
                    placeholder="Internal notes (not shown to venues)"
                  />
                </label>
              </div>
              <div className="mt-3 flex items-center gap-3">
                <button
                  type="button"
                  disabled={savingId === r.id}
                  onClick={() => void saveRow(r.id)}
                  className="rounded-[var(--radius-button)] border-[3px] border-quizzer-black bg-quizzer-yellow px-4 py-2 text-sm font-semibold text-quizzer-black shadow-[var(--shadow-button)] hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[var(--shadow-button-hover)] disabled:opacity-50"
                >
                  {savingId === r.id ? "Saving…" : "Save"}
                </button>
                {r.reviewed_at ? (
                  <span className="text-xs text-quizzer-black/50">Reviewed {formatIso(r.reviewed_at)}</span>
                ) : null}
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
