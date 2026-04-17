"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { createBrowserSupabaseClient } from "@/lib/supabase/browser";
import { Container } from "@/components/ui/Container";

export function PortalSignInForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextPath = searchParams.get("next")?.trim() || "/portal";
  const accessError = searchParams.get("error") === "no-access";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  return (
    <section className="py-16">
      <Container>
        <div className="mx-auto max-w-md border-[var(--border-thick)] border-quizzer-black bg-quizzer-white p-8 shadow-[var(--shadow-card)]">
          <h1 className="font-heading text-2xl uppercase text-quizzer-black">Publican sign in</h1>
          <p className="mt-2 text-sm text-quizzer-black/75">
            Sign in with the email and password for your Quizzer account.
          </p>

          {accessError ? (
            <p className="mt-4 rounded-[var(--radius-button)] border-2 border-quizzer-black bg-amber-50 px-3 py-2 text-sm text-amber-950">
              This account doesn’t have publican portal access. If you were invited, make sure you’re using the same email
              as your invitation, or contact Quizzer support.
            </p>
          ) : null}

          <form
            className="mt-8 space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              setError(null);
              const em = email.trim();
              if (!em || !password) {
                setError("Enter email and password.");
                return;
              }
              setPending(true);
              void (async () => {
                try {
                  const supabase = createBrowserSupabaseClient();
                  const { error: signErr } = await supabase.auth.signInWithPassword({
                    email: em,
                    password,
                  });
                  if (signErr) {
                    setError(signErr.message);
                    setPending(false);
                    return;
                  }
                  router.push(nextPath.startsWith("/") ? nextPath : "/portal");
                  router.refresh();
                } catch {
                  setError("Something went wrong. Try again.");
                  setPending(false);
                }
              })();
            }}
          >
            <div>
              <label htmlFor="portal-email" className="block text-sm font-medium text-quizzer-black">
                Email
              </label>
              <input
                id="portal-email"
                name="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1 w-full rounded-[var(--radius-button)] border-2 border-quizzer-black bg-quizzer-white px-3 py-2 text-quizzer-black outline-none focus:ring-2 focus:ring-quizzer-yellow"
              />
            </div>
            <div>
              <label htmlFor="portal-password" className="block text-sm font-medium text-quizzer-black">
                Password
              </label>
              <input
                id="portal-password"
                name="password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1 w-full rounded-[var(--radius-button)] border-2 border-quizzer-black bg-quizzer-white px-3 py-2 text-quizzer-black outline-none focus:ring-2 focus:ring-quizzer-yellow"
              />
            </div>
            {error ? <p className="text-sm text-quizzer-red">{error}</p> : null}
            <button
              type="submit"
              disabled={pending}
              className="w-full rounded-[var(--radius-button)] border-2 border-quizzer-black bg-quizzer-yellow px-4 py-3 text-sm font-semibold text-quizzer-black shadow-[var(--shadow-button)] transition hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[var(--shadow-button-hover)] disabled:opacity-50"
            >
              {pending ? "Signing in…" : "Sign in"}
            </button>
          </form>

          <p className="mt-8 text-sm text-quizzer-black/75">
            Need portal access?{" "}
            <Link href="/contact-us" className="font-medium text-quizzer-black underline underline-offset-2">
              Contact us
            </Link>
            .
          </p>
        </div>
      </Container>
    </section>
  );
}
