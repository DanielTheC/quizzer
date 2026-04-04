"use client";

import { useCallback, useState } from "react";
import { createBrowserSupabaseClient } from "@/lib/supabase/browser";

type InvokeOk = {
  ok: true;
  interestedCount: number;
  pushSent: number;
  pushSkipped: number;
};

type InvokeErr = {
  ok?: false;
  error?: string;
  code?: string;
};

async function readInvokeError(err: Error & { context?: Response }): Promise<string> {
  try {
    const r = err.context;
    if (r) {
      const j = (await r.clone().json()) as InvokeErr;
      if (typeof j?.error === "string" && j.error) return j.error;
    }
  } catch {
    /* ignore */
  }
  return err.message || "Request failed";
}

type Props = {
  venueName: string;
  quizEventId: string;
  interestedCount: number;
};

export function PublicanNotifyAttendeesPanel({ venueName, quizEventId, interestedCount }: Props) {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const close = useCallback(() => {
    setOpen(false);
    setError(null);
    setSuccess(null);
  }, []);

  const send = useCallback(() => {
    setError(null);
    setSuccess(null);
    const trimmed = message.trim();
    if (!trimmed) {
      setError("Enter a message.");
      return;
    }
    setPending(true);
    void (async () => {
      try {
        const supabase = createBrowserSupabaseClient();
        const { data, error: fnErr } = await supabase.functions.invoke<
          InvokeOk | (InvokeErr & { ok: false })
        >("notify-quiz-attendees", {
          body: { quiz_event_id: quizEventId, message: trimmed },
        });

        if (fnErr) {
          setError(await readInvokeError(fnErr as Error & { context?: Response }));
          setPending(false);
          return;
        }

        const payload = data as InvokeOk | InvokeErr | null;
        if (payload && typeof payload === "object" && "ok" in payload && payload.ok === false) {
          setError((payload as InvokeErr).error ?? "Could not send update.");
          setPending(false);
          return;
        }

        const ok = payload as InvokeOk | null;
        if (!ok?.ok) {
          setError("Unexpected response");
          setPending(false);
          return;
        }

        const n = ok.pushSent ?? 0;
        const hint =
          ok.interestedCount > n && n === 0
            ? ` No devices registered yet (${ok.interestedCount} interested — add Expo tokens to push_tokens from the app).`
            : ok.interestedCount > n
              ? ` (${ok.interestedCount} interested; ${ok.pushSkipped} had no push token.)`
              : "";

        setSuccess(`Update sent to ${n} players.${hint}`);
        setMessage("");
        setPending(false);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong.");
        setPending(false);
      }
    })();
  }, [message, quizEventId]);

  const disabled = interestedCount <= 0;

  return (
    <>
      <div className="mt-3">
        <button
          type="button"
          disabled={disabled}
          onClick={() => {
            setOpen(true);
            setError(null);
            setSuccess(null);
          }}
          className="rounded-[var(--radius-button)] border-2 border-quizzer-black bg-quizzer-white px-3 py-2 text-sm font-semibold text-quizzer-black shadow-[var(--shadow-button)] transition hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[var(--shadow-button-hover)] disabled:cursor-not-allowed disabled:opacity-45"
        >
          Send update to attendees
        </button>
        {disabled ? (
          <p className="mt-1 text-xs text-quizzer-black/55">No interested players for this quiz yet.</p>
        ) : null}
      </div>

      {open ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/35 sm:items-center"
          role="dialog"
          aria-modal="true"
          aria-labelledby="notify-attendees-title"
        >
          <button
            type="button"
            className="absolute inset-0 cursor-default"
            aria-label="Close"
            onClick={close}
          />
          <div className="relative z-10 w-full max-w-lg rounded-t-[var(--radius-card)] border-[var(--border-thick)] border-quizzer-black bg-quizzer-white p-6 shadow-[var(--shadow-card)] sm:rounded-[var(--radius-card)]">
            <h2 id="notify-attendees-title" className="font-heading text-lg uppercase text-quizzer-black">
              Message attendees
            </h2>
            <p className="mt-1 text-sm text-quizzer-black/70">
              {venueName} · push to {interestedCount} interested player{interestedCount === 1 ? "" : "s"}
            </p>
            <label htmlFor="notify-attendees-body" className="mt-4 block text-xs font-semibold uppercase text-quizzer-black/60">
              Message
            </label>
            <textarea
              id="notify-attendees-body"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              disabled={pending}
              rows={5}
              className="mt-2 w-full rounded-[var(--radius-button)] border-2 border-quizzer-black bg-quizzer-white px-3 py-2 text-sm text-quizzer-black"
              placeholder="e.g. Quiz starts 30 minutes late tonight."
            />
            {error ? <p className="mt-2 text-sm text-quizzer-red">{error}</p> : null}
            {success ? <p className="mt-2 text-sm font-medium text-quizzer-green">{success}</p> : null}
            <div className="mt-6 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={close}
                disabled={pending}
                className="rounded-[var(--radius-button)] border-2 border-quizzer-black bg-quizzer-cream px-4 py-2 text-sm font-semibold text-quizzer-black disabled:opacity-50"
              >
                Close
              </button>
              <button
                type="button"
                onClick={send}
                disabled={pending}
                className="rounded-[var(--radius-button)] border-2 border-quizzer-black bg-quizzer-yellow px-4 py-2 text-sm font-semibold text-quizzer-black shadow-[var(--shadow-button)] disabled:opacity-50"
              >
                {pending ? "Sending…" : "Send"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
