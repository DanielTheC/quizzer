"use client";

import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import { createBrowserSupabaseClient } from "@/lib/supabase/browser";
import { captureSupabaseError } from "@/lib/observability/supabaseErrors";
import {
  PUBLICAN_MESSAGE_TYPE_OPTIONS,
  type PublicanMessageTypeValue,
} from "./publicanMessageLabels";

type Props = {
  /** When `venuePicker` has multiple entries, the first is used as initial selection. */
  venueId: string | null;
  /** If set with 2+ venues, shows a venue selector (e.g. on Messages overview). */
  venuePicker?: { id: string; name: string }[];
  /** When null, message is venue-level only. */
  quizEventId: string | null;
  /** Shown above the form (e.g. day · time or venue name). */
  contextLabel: string;
  /** Smaller padding when nested in a dense card. */
  compact?: boolean;
};

export function PublicanNewMessageForm({
  venueId,
  venuePicker,
  quizEventId,
  contextLabel,
  compact,
}: Props) {
  const router = useRouter();
  const pickList = venuePicker && venuePicker.length > 0 ? venuePicker : null;
  const initialVenue =
    pickList && pickList.length > 0 ? pickList[0]!.id : venueId ?? "";
  const [selectedVenueId, setSelectedVenueId] = useState(initialVenue);
  const [messageType, setMessageType] = useState<PublicanMessageTypeValue>("general");
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [pending, setPending] = useState(false);

  const submit = useCallback(() => {
    setError(null);
    setSuccess(false);
    const trimmed = body.trim();
    if (!trimmed) {
      setError("Please enter a message.");
      return;
    }
    const effectiveVenueId = pickList ? selectedVenueId : venueId ?? "";
    if (!effectiveVenueId) {
      setError("Choose a venue.");
      return;
    }
    setPending(true);
    void (async () => {
      try {
        const supabase = createBrowserSupabaseClient();
        const row: {
          venue_id: string;
          quiz_event_id: string | null;
          message_type: PublicanMessageTypeValue;
          body: string;
        } = {
          venue_id: effectiveVenueId,
          quiz_event_id: quizEventId,
          message_type: messageType,
          body: trimmed,
        };
        const { error: insertError } = await supabase.from("publican_messages").insert(row);
        if (insertError) {
          captureSupabaseError("portal.message_insert", insertError, {
            venue_id: effectiveVenueId,
            quiz_event_id: quizEventId,
            message_type: messageType,
          });
          setError(insertError.message);
          setPending(false);
          return;
        }
        setBody("");
        setMessageType("general");
        setSuccess(true);
        router.refresh();
      } catch {
        setError("Something went wrong. Try again.");
      } finally {
        setPending(false);
      }
    })();
  }, [body, messageType, quizEventId, venueId, pickList, selectedVenueId, router]);

  const box = compact ? "mt-3 border-t-2 border-quizzer-black/10 pt-3" : "mt-4 border-t-2 border-quizzer-black/10 pt-4";

  return (
    <div className={box}>
      <p className="text-xs font-medium uppercase tracking-wide text-quizzer-black/55">Contact operator</p>
      <p className="mt-1 text-sm text-quizzer-black/70">{contextLabel}</p>

      <div className="mt-3 space-y-3">
        {pickList && pickList.length > 1 ? (
          <div>
            <label htmlFor={`msg-venue-pick-${quizEventId ?? "venue"}`} className="mb-1 block text-xs font-medium text-quizzer-black/70">
              Venue
            </label>
            <select
              id={`msg-venue-pick-${quizEventId ?? "venue"}`}
              value={selectedVenueId}
              onChange={(e) => setSelectedVenueId(e.target.value)}
              disabled={pending}
              className="w-full max-w-md rounded-[var(--radius-button)] border-2 border-quizzer-black bg-quizzer-white px-3 py-2 text-sm text-quizzer-black"
            >
              {pickList.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name}
                </option>
              ))}
            </select>
          </div>
        ) : null}
        <div>
          <label htmlFor={`msg-type-${venueId ?? selectedVenueId}-${quizEventId ?? "venue"}`} className="sr-only">
            Message type
          </label>
          <select
            id={`msg-type-${venueId ?? selectedVenueId}-${quizEventId ?? "venue"}`}
            value={messageType}
            onChange={(e) => setMessageType(e.target.value as PublicanMessageTypeValue)}
            disabled={pending}
            className="w-full max-w-md rounded-[var(--radius-button)] border-2 border-quizzer-black bg-quizzer-white px-3 py-2 text-sm text-quizzer-black"
          >
            {PUBLICAN_MESSAGE_TYPE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor={`msg-body-${venueId ?? selectedVenueId}-${quizEventId ?? "venue"}`} className="sr-only">
            Message
          </label>
          <textarea
            id={`msg-body-${venueId ?? selectedVenueId}-${quizEventId ?? "venue"}`}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            disabled={pending}
            rows={compact ? 3 : 4}
            placeholder="Type your message…"
            className="w-full resize-y rounded-[var(--radius-button)] border-2 border-quizzer-black bg-quizzer-white px-3 py-2 text-sm text-quizzer-black placeholder:text-quizzer-black/40"
          />
        </div>
        {error ? <p className="text-sm text-quizzer-red">{error}</p> : null}
        {success ? <p className="text-sm font-medium text-quizzer-green">Message sent.</p> : null}
        <button
          type="button"
          onClick={submit}
          disabled={pending}
          className="rounded-[var(--radius-button)] border-2 border-quizzer-black bg-quizzer-yellow px-4 py-2 text-sm font-semibold text-quizzer-black shadow-[var(--shadow-button)] transition hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[var(--shadow-button-hover)] disabled:opacity-50"
        >
          {pending ? "Sending…" : "Send message"}
        </button>
      </div>
    </div>
  );
}
