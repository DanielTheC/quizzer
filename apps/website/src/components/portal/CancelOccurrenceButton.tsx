"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowserSupabaseClient } from "@/lib/supabase/browser";
import { captureSupabaseError } from "@/lib/observability/supabaseErrors";

type Props = {
  quizEventId: string;
  occurrenceDate: string;
  dateLabel: string;
  venueLabel?: string;
};

type CancelRpcResponse = {
  ok: boolean;
  code?: string;
};

const REASON_MIN = 8;

export function CancelOccurrenceButton({
  quizEventId,
  occurrenceDate,
  dateLabel,
  venueLabel,
}: Props) {
  const router = useRouter();
  const formId = useId();
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const trimmed = reason.trim();
  const canSubmit = trimmed.length >= REASON_MIN && !pending;

  const closeModal = useCallback(() => {
    setOpen(false);
    window.setTimeout(() => triggerRef.current?.focus(), 0);
  }, []);

  const reset = useCallback(() => {
    setReason("");
    setError(null);
    closeModal();
  }, [closeModal]);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !pending) reset();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, pending, reset]);

  const submit = useCallback(() => {
    setError(null);
    if (trimmed.length < REASON_MIN) {
      setError(`Please enter at least ${REASON_MIN} characters.`);
      return;
    }
    setPending(true);
    void (async () => {
      try {
        const supabase = createBrowserSupabaseClient();
        const { data, error: rpcError } = await supabase.rpc("publican_cancel_occurrence", {
          p_quiz_event_id: quizEventId,
          p_occurrence_date: occurrenceDate,
          p_reason: trimmed,
        });
        if (rpcError) {
          captureSupabaseError("portal.publican_cancel_occurrence_rpc", rpcError, {
            quiz_event_id: quizEventId,
            occurrence_date: occurrenceDate,
          });
          setError(rpcError.message);
          setPending(false);
          return;
        }
        const payload = (data ?? {}) as CancelRpcResponse;
        if (!payload.ok) {
          const code = payload.code ?? "unknown";
          if (code === "not_publican_for_venue") {
            setToast("You don't have access to cancel this venue's nights.");
            reset();
          } else if (code === "already_cancelled_or_missing") {
            setToast("That night was already cancelled.");
            router.refresh();
            reset();
          } else {
            setError(`Could not cancel this night (${code}).`);
          }
          setPending(false);
          return;
        }
        setToast(`${dateLabel} cancelled. Host claim released and operator notified.`);
        reset();
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not cancel this night.");
      } finally {
        setPending(false);
      }
    })();
  }, [trimmed, quizEventId, occurrenceDate, dateLabel, router, reset]);

  return (
    <div className="relative">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => {
          setToast(null);
          setOpen(true);
        }}
        className="rounded-[var(--radius-button)] border-2 border-quizzer-black bg-quizzer-white px-3 py-1.5 text-xs font-semibold text-quizzer-black shadow-[var(--shadow-button)] transition hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[var(--shadow-button-hover)]"
      >
        Cancel this night
      </button>
      {toast ? (
        <p
          role="status"
          className="mt-2 rounded-[var(--radius-button)] border-2 border-quizzer-black bg-quizzer-yellow px-2 py-1 text-xs font-semibold text-quizzer-black"
        >
          {toast}
        </p>
      ) : null}
      {open ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby={`${formId}-title`}
          className="fixed inset-0 z-50 flex items-center justify-center bg-quizzer-black/40 p-4"
          onClick={() => {
            if (!pending) reset();
          }}
        >
          <div
            className="w-full max-w-md rounded-[var(--radius-card)] border-[3px] border-quizzer-black bg-quizzer-white p-4 shadow-[var(--shadow-card)]"
            onClick={(event) => event.stopPropagation()}
          >
            <p
              id={`${formId}-title`}
              className="text-xs font-semibold uppercase tracking-wide text-quizzer-black"
            >
              Cancel {dateLabel}
              {venueLabel ? <span className="text-quizzer-black/70"> · {venueLabel}</span> : null}
            </p>
            <label htmlFor={`${formId}-reason`} className="sr-only">
              Reason for cancelling
            </label>
            <textarea
              id={`${formId}-reason`}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              disabled={pending}
              rows={3}
              placeholder="Why is this night being cancelled? (min 8 characters)"
              className="mt-2 w-full resize-y rounded-[var(--radius-button)] border-2 border-quizzer-black bg-quizzer-white px-3 py-2 text-sm text-quizzer-black placeholder:text-quizzer-black/40"
            />
            <p className="mt-1 text-[11px] text-quizzer-black/60">
              {trimmed.length}/{REASON_MIN} minimum characters. The host claim (if any) will be auto-released
              and the operator will be notified.
            </p>
            {error ? <p className="mt-2 text-sm text-quizzer-red">{error}</p> : null}
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={submit}
                disabled={!canSubmit}
                className="rounded-[var(--radius-button)] border-2 border-quizzer-black bg-quizzer-red px-3 py-1.5 text-xs font-semibold text-quizzer-white shadow-[var(--shadow-button)] transition hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[var(--shadow-button-hover)] disabled:opacity-50"
              >
                {pending ? "Cancelling…" : "Confirm cancel"}
              </button>
              <button
                type="button"
                onClick={reset}
                disabled={pending}
                className="rounded-[var(--radius-button)] border-2 border-quizzer-black/30 bg-quizzer-white px-3 py-1.5 text-xs font-semibold text-quizzer-black disabled:opacity-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
