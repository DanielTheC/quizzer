"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { captureSupabaseError } from "@/lib/observability/supabaseErrors";
import { createBrowserSupabaseClient } from "@/lib/supabase/browser";

export function WelcomePasswordForm() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  return (
    <form
      className="space-y-4 border-[3px] border-quizzer-black bg-quizzer-white p-6 shadow-[var(--shadow-card)]"
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);

        if (password.length < 10) {
          setError("Password must be at least 10 characters.");
          return;
        }

        if (password !== confirmPassword) {
          setError("Passwords do not match.");
          return;
        }

        setPending(true);
        void (async () => {
          try {
            const supabase = createBrowserSupabaseClient();
            const {
              data: { user },
              error: userError,
            } = await supabase.auth.getUser();

            if (userError || !user) {
              if (userError) captureSupabaseError("portal.welcome.get_user", userError);
              setError("Your session has expired. Sign in again from your invite link.");
              setPending(false);
              return;
            }

            const { error: updateError } = await supabase.auth.updateUser({ password });
            if (updateError) {
              captureSupabaseError("portal.welcome.update_password", updateError, { user_id: user.id });
              setError(updateError.message);
              setPending(false);
              return;
            }

            const { error: markError } = await supabase.rpc("mark_publican_password_set");
            if (markError) {
              captureSupabaseError("portal.welcome.mark_password_set", markError, { user_id: user.id });
              setError(markError.message);
              setPending(false);
              return;
            }

            router.push("/portal");
            router.refresh();
          } catch {
            setError("Something went wrong. Try again.");
            setPending(false);
          }
        })();
      }}
    >
      <div>
        <label htmlFor="welcome-password" className="block text-sm font-medium text-quizzer-black">
          Choose a password
        </label>
        <input
          id="welcome-password"
          name="password"
          type="password"
          required
          minLength={10}
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="mt-1 w-full rounded-[var(--radius-button)] border-[3px] border-quizzer-black bg-quizzer-white px-3 py-2 text-quizzer-black outline-none focus:ring-2 focus:ring-quizzer-yellow"
        />
      </div>
      <div>
        <label htmlFor="welcome-confirm-password" className="block text-sm font-medium text-quizzer-black">
          Confirm password
        </label>
        <input
          id="welcome-confirm-password"
          name="confirmPassword"
          type="password"
          required
          minLength={10}
          autoComplete="new-password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          className="mt-1 w-full rounded-[var(--radius-button)] border-[3px] border-quizzer-black bg-quizzer-white px-3 py-2 text-quizzer-black outline-none focus:ring-2 focus:ring-quizzer-yellow"
        />
      </div>
      {error ? (
        <p
          className="rounded-[var(--radius-button)] border-[3px] border-quizzer-red bg-quizzer-cream px-3 py-2 text-sm text-quizzer-red"
          role="alert"
        >
          {error}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-[var(--radius-button)] border-[3px] border-quizzer-black bg-quizzer-yellow px-4 py-3 text-sm font-semibold text-quizzer-black shadow-[var(--shadow-button)] transition hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[var(--shadow-button-hover)] disabled:opacity-50"
      >
        {pending ? "Saving..." : "Set password"}
      </button>
    </form>
  );
}
