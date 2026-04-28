"use client";

import { useState, useTransition } from "react";
import { deleteOwnAccountAction } from "./actions";

function isNextRedirect(error: unknown): boolean {
  if (typeof error !== "object" || error === null) return false;
  const digest =
    typeof (error as { digest?: unknown }).digest === "string"
      ? ((error as { digest: string }).digest as string)
      : "";
  return digest.includes("NEXT_REDIRECT");
}

export function DeleteAccountConfirm() {
  const [stage, setStage] = useState<"idle" | "confirm">("idle");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <div className="border-[3px] border-quizzer-red bg-quizzer-cream p-6 shadow-[var(--shadow-card)]">
      {stage === "idle" ? (
        <button
          type="button"
          onClick={() => setStage("confirm")}
          className="w-full rounded-[var(--radius-button)] border-[3px] border-quizzer-black bg-quizzer-red px-4 py-3 text-sm font-semibold text-quizzer-white shadow-[var(--shadow-button)] hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[var(--shadow-button-hover)]"
        >
          Delete my account
        </button>
      ) : (
        <div className="space-y-4">
          <p className="text-quizzer-red font-semibold">Are you absolutely sure? This cannot be undone.</p>
          {error ? (
            <p
              role="alert"
              className="rounded-[var(--radius-button)] border-[3px] border-quizzer-red bg-quizzer-white px-3 py-2 text-sm text-quizzer-red"
            >
              {error}
            </p>
          ) : null}
          <div className="flex gap-3">
            <button
              type="button"
              disabled={pending}
              onClick={() => {
                setError(null);
                setStage("idle");
              }}
              className="flex-1 rounded-[var(--radius-button)] border-[3px] border-quizzer-black bg-quizzer-white px-4 py-3 text-sm font-semibold text-quizzer-black shadow-[var(--shadow-button)] hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[var(--shadow-button-hover)] disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => {
                setError(null);
                startTransition(async () => {
                  try {
                    const result = await deleteOwnAccountAction();
                    if (result?.ok === false) setError(result.error);
                  } catch (e) {
                    if (isNextRedirect(e)) return;
                    setError("Something went wrong. Try again.");
                  }
                });
              }}
              className="flex-1 rounded-[var(--radius-button)] border-[3px] border-quizzer-black bg-quizzer-red px-4 py-3 text-sm font-semibold text-quizzer-white shadow-[var(--shadow-button)] hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[var(--shadow-button-hover)] disabled:opacity-50"
            >
              {pending ? "Deleting…" : "Yes, delete"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
