"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { captureSupabaseError } from "@/lib/observability/supabaseErrors";
import { createBrowserSupabaseClient } from "@/lib/supabase/browser";

type Props = {
  tokenHash: string;
  next: string;
};

export function AcceptInviteButton({ tokenHash, next }: Props) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const expiredOrInvalid = error ? /expired|invalid/i.test(error) : false;

  return (
    <div className="space-y-4 border-[3px] border-quizzer-black bg-quizzer-white p-6 shadow-[var(--shadow-card)]">
      {error ? (
        <div
          className="rounded-[var(--radius-button)] border-[3px] border-quizzer-red bg-quizzer-cream px-3 py-2 text-sm text-quizzer-red"
          role="alert"
        >
          <p>{error}</p>
          {expiredOrInvalid ? <p className="mt-2">Ask Quizzer support to resend your invite.</p> : null}
        </div>
      ) : null}
      <button
        type="button"
        disabled={pending}
        className="w-full rounded-[var(--radius-button)] border-[3px] border-quizzer-black bg-quizzer-yellow px-4 py-3 text-sm font-semibold text-quizzer-black shadow-[var(--shadow-button)] transition hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[var(--shadow-button-hover)] disabled:opacity-50"
        onClick={() => {
          setError(null);
          setPending(true);
          void (async () => {
            try {
              const supabase = createBrowserSupabaseClient();
              const params = {
                type: "invite" as const,
                token_hash: tokenHash,
              };
              const { error: verifyError } = await supabase.auth.verifyOtp(params);

              if (verifyError) {
                captureSupabaseError("portal.accept_invite.verify", verifyError);
                setError(verifyError.message);
                setPending(false);
                return;
              }

              router.push(next);
              router.refresh();
            } catch {
              setError("Something went wrong. Try again.");
              setPending(false);
            }
          })();
        }}
      >
        {pending ? "Confirming…" : "Confirm and continue"}
      </button>
    </div>
  );
}
