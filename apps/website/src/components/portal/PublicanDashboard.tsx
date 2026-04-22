"use client";

import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import { createBrowserSupabaseClient } from "@/lib/supabase/browser";
import { captureSupabaseError } from "@/lib/observability/supabaseErrors";
import {
  formatTime24 as formatTime,
  formatFeePenceOrDash as formatFeePence,
} from "@/lib/formatters";
import { labelForMessageStatus } from "./publicanMessageLabels";
import { PortalSignOutButton } from "./PortalSignOutButton";

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

const MESSAGE_TYPE_OPTIONS = [
  { value: "general_enquiry", label: "General enquiry" },
  { value: "booking_request", label: "Booking request" },
  { value: "other", label: "Other" },
] as const;

type MessageTypeValue = (typeof MESSAGE_TYPE_OPTIONS)[number]["value"];

export type PublicanDashboardProps = {
  venue: { id: string; name: string; address: string | null; postcode: string | null };
  profile: { first_name: string | null; last_name: string | null; email: string };
  quizEvents: Array<{
    id: string;
    day_of_week: number;
    start_time: string;
    entry_fee_pence: number | null;
    is_active: boolean;
    interest_count: number;
    claim: { status: string; host_email: string } | null;
  }>;
  recentMessages: Array<{
    id: string;
    message_type: string;
    body: string;
    status: string;
    created_at: string;
    operator_reply: string | null;
  }>;
};

function truncateEmail(email: string, max: number): string {
  const e = email.trim();
  if (e.length <= max) return e;
  return `${e.slice(0, Math.max(0, max - 2))}…`;
}

function formatWhen(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function hostStatusPill(claim: { status: string; host_email: string } | null) {
  if (claim?.status === "confirmed") {
    return (
      <span className="inline-block rounded-full border-[3px] border-quizzer-green bg-quizzer-green/10 px-2 py-0.5 text-xs font-semibold uppercase tracking-wide text-quizzer-green">
        ✓ {truncateEmail(claim.host_email, 22)}
      </span>
    );
  }
  if (claim?.status === "pending") {
    return (
      <span className="inline-block rounded-full border-[3px] border-quizzer-orange bg-quizzer-yellow/20 px-2 py-0.5 text-xs font-semibold uppercase tracking-wide text-quizzer-orange">
        ⏳ Pending
      </span>
    );
  }
  return (
    <div className="space-y-1">
      <span className="text-xs text-quizzer-black/40">Unclaimed</span>
      <p className="text-xs font-medium text-quizzer-orange">No host assigned yet</p>
    </div>
  );
}

export function PublicanDashboard({ venue, profile, quizEvents, recentMessages }: PublicanDashboardProps) {
  const router = useRouter();
  const welcomeName = profile.first_name?.trim() || "there";
  const addressLine = [venue.address?.trim(), venue.postcode?.trim()].filter(Boolean).join(" · ") || null;

  const [composeOpen, setComposeOpen] = useState(false);
  const [messageType, setMessageType] = useState<MessageTypeValue>("general_enquiry");
  const [body, setBody] = useState("");
  const [sendBusy, setSendBusy] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [sendOk, setSendOk] = useState(false);

  const submitMessage = useCallback(() => {
    setSendError(null);
    setSendOk(false);
    const trimmed = body.trim();
    if (!trimmed) {
      setSendError("Please enter a message.");
      return;
    }
    setSendBusy(true);
    void (async () => {
      try {
        const supabase = createBrowserSupabaseClient();
        const { error } = await supabase.from("publican_messages").insert({
          venue_id: venue.id,
          message_type: messageType,
          body: trimmed,
          status: "open",
        });
        if (error) {
          captureSupabaseError("portal.message_insert", error, {
            venue_id: venue.id,
            message_type: messageType,
          });
          setSendError(error.message);
          setSendBusy(false);
          return;
        }
        setBody("");
        setMessageType("general_enquiry");
        setComposeOpen(false);
        setSendOk(true);
        router.refresh();
      } catch {
        setSendError("Something went wrong. Try again.");
      } finally {
        setSendBusy(false);
      }
    })();
  }, [body, messageType, venue.id, router]);

  return (
    <div className="px-6 py-8 text-quizzer-black md:px-10">
      <header className="mb-10 flex flex-col gap-4 border-b-[3px] border-quizzer-black pb-6 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="font-heading text-3xl uppercase tracking-wide md:text-4xl">Welcome, {welcomeName}</h1>
          <p className="mt-2 text-sm font-medium text-quizzer-black/80 md:text-base">{venue.name}</p>
          <p className="mt-1 text-xs text-quizzer-black/55">Signed in as {profile.email}</p>
        </div>
        <PortalSignOutButton className="w-full shrink-0 sm:w-auto sm:min-w-[9rem]" />
      </header>

      <section className="mb-10 max-w-3xl rounded-[var(--radius-card)] border-[3px] border-quizzer-black bg-quizzer-white p-6 shadow-[var(--shadow-card)]">
        <h2 className="font-heading text-lg uppercase tracking-wide">Your venue</h2>
        <p className="mt-3 text-base font-semibold text-quizzer-black">{venue.name}</p>
        {addressLine ? <p className="mt-2 text-sm text-quizzer-black/75">{addressLine}</p> : null}
        <p className="mt-4 text-sm text-quizzer-black/65">
          To update your venue details, contact your Quizzer operator.
        </p>
      </section>

      <section className="mb-10">
        <h2 className="font-heading text-lg uppercase tracking-wide">Your quizzes</h2>
        <div className="mt-4 overflow-x-auto rounded-[var(--radius-card)] border-[3px] border-quizzer-black bg-quizzer-white shadow-[var(--shadow-card)]">
          <table className="min-w-[640px] w-full border-collapse text-left text-sm">
            <thead>
              <tr className="border-b-[3px] border-quizzer-black bg-quizzer-cream/50">
                <th className="px-3 py-3 font-heading text-xs uppercase tracking-wide">When</th>
                <th className="px-3 py-3 font-heading text-xs uppercase tracking-wide">Entry</th>
                <th className="px-3 py-3 font-heading text-xs uppercase tracking-wide">Interest</th>
                <th className="px-3 py-3 font-heading text-xs uppercase tracking-wide">Host</th>
              </tr>
            </thead>
            <tbody>
              {quizEvents.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-3 py-6 text-quizzer-black/60">
                    No quiz listings for this venue yet.
                  </td>
                </tr>
              ) : (
                quizEvents.map((row, idx) => {
                  const dow =
                    row.day_of_week >= 0 && row.day_of_week < DAY_NAMES.length
                      ? DAY_NAMES[row.day_of_week]
                      : String(row.day_of_week);
                  return (
                    <tr
                      key={row.id}
                      className={idx % 2 === 0 ? "bg-quizzer-white" : "bg-quizzer-cream/20"}
                    >
                      <td className="px-3 py-3 align-top font-medium">
                        {dow} · {formatTime(row.start_time)}
                        {!row.is_active ? (
                          <span className="mt-1 block text-xs font-semibold text-quizzer-black/50">Inactive</span>
                        ) : null}
                      </td>
                      <td className="px-3 py-3 align-top">{formatFeePence(row.entry_fee_pence)}</td>
                      <td className="px-3 py-3 align-top tabular-nums">{row.interest_count}</td>
                      <td className="px-3 py-3 align-top">{hostStatusPill(row.claim)}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="max-w-3xl">
        <h2 className="font-heading text-lg uppercase tracking-wide">Messages</h2>
        <p className="mt-2 text-sm text-quizzer-black/70">
          Your messages to the Quizzer team. Replies from an operator appear below each note.
        </p>

        {sendOk ? (
          <p className="mt-4 text-sm font-medium text-quizzer-green" aria-live="polite">
            Message sent — we’ll get back to you as soon as we can.
          </p>
        ) : null}

        <button
          type="button"
          onClick={() => {
            setComposeOpen((o) => !o);
            setSendError(null);
          }}
          className="mt-6 rounded-[var(--radius-button)] border-[3px] border-quizzer-black bg-quizzer-yellow px-4 py-2.5 text-sm font-semibold text-quizzer-black shadow-[var(--shadow-button)] transition hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[var(--shadow-button-hover)]"
        >
          {composeOpen ? "Close form" : "Send a message"}
        </button>

        {composeOpen ? (
          <div className="mt-4 space-y-4 rounded-[var(--radius-card)] border-[3px] border-quizzer-black bg-quizzer-white p-5 shadow-[var(--shadow-card)]">
            <div>
              <label htmlFor="pub-msg-type" className="block text-xs font-medium uppercase tracking-wide text-quizzer-black/70">
                Message type
              </label>
              <select
                id="pub-msg-type"
                value={messageType}
                onChange={(e) => setMessageType(e.target.value as MessageTypeValue)}
                className="mt-2 w-full max-w-md rounded-[var(--radius-button)] border-[3px] border-quizzer-black bg-quizzer-white px-3 py-2 text-sm text-quizzer-black outline-none focus:ring-2 focus:ring-quizzer-yellow"
              >
                {MESSAGE_TYPE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="pub-msg-body" className="block text-xs font-medium uppercase tracking-wide text-quizzer-black/70">
                Message
              </label>
              <textarea
                id="pub-msg-body"
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={5}
                className="mt-2 w-full rounded-[var(--radius-button)] border-[3px] border-quizzer-black bg-quizzer-white px-3 py-2 text-sm text-quizzer-black outline-none focus:ring-2 focus:ring-quizzer-yellow"
                placeholder="How can we help?"
              />
            </div>
            {sendError ? <p className="text-sm text-quizzer-red">{sendError}</p> : null}
            <button
              type="button"
              disabled={sendBusy}
              onClick={() => void submitMessage()}
              className="rounded-[var(--radius-button)] border-[3px] border-quizzer-black bg-quizzer-yellow px-4 py-2 text-sm font-semibold text-quizzer-black shadow-[var(--shadow-button)] transition hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[var(--shadow-button-hover)] disabled:opacity-50"
            >
              {sendBusy ? "Sending…" : "Submit"}
            </button>
          </div>
        ) : null}

        <ul className="mt-8 space-y-4">
          {recentMessages.length === 0 ? (
            <li className="rounded-[var(--radius-card)] border-[3px] border-dashed border-quizzer-black/25 bg-quizzer-cream/30 px-4 py-6 text-sm text-quizzer-black/65">
              No messages yet. Use “Send a message” to reach the team.
            </li>
          ) : (
            recentMessages.map((m) => (
              <li
                key={m.id}
                className="rounded-[var(--radius-card)] border-[3px] border-quizzer-black bg-quizzer-white p-4 shadow-[var(--shadow-card)]"
              >
                <div className="flex flex-wrap items-center gap-2 text-xs text-quizzer-black/60">
                  <span className="font-medium capitalize text-quizzer-black/80">
                    {m.message_type.replace(/_/g, " ")}
                  </span>
                  <span>·</span>
                  <span>{labelForMessageStatus(m.status)}</span>
                  <span>·</span>
                  <span>{formatWhen(m.created_at)}</span>
                </div>
                <p className="mt-3 whitespace-pre-wrap text-sm text-quizzer-black">{m.body}</p>
                {m.operator_reply?.trim() ? (
                  <div className="mt-4 border-t-2 border-quizzer-black/10 pt-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-quizzer-black/55">Operator reply</p>
                    <p className="mt-1 whitespace-pre-wrap text-sm text-quizzer-black">{m.operator_reply}</p>
                  </div>
                ) : null}
              </li>
            ))
          )}
        </ul>
      </section>
    </div>
  );
}
