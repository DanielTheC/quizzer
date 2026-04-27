"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { createBrowserSupabaseClient } from "@/lib/supabase/browser";
import { Container } from "@/components/ui/Container";

function safeNextPath(raw: string | null): string {
  const t = raw?.trim() ?? "";
  if (t.startsWith("/admin") && !t.startsWith("//")) return t;
  if (t.startsWith("/studio") && !t.startsWith("//")) return t;
  return "/admin";
}

export function AdminSignInForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextPath = safeNextPath(searchParams.get("next"));

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  return (
    <section className="py-16">
      <Container>
        <div className="mx-auto max-w-md border-[var(--border-thick)] border-quizzer-black bg-quizzer-white p-8 shadow-[var(--shadow-card)]">
          <h1 className="font-heading text-2xl uppercase text-quizzer-black">Sign in</h1>
          <p className="mt-2 text-sm text-quizzer-black/75">Use your Quizzer account credentials.</p>

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
                  router.push(nextPath);
                  router.refresh();
                } catch {
                  setError("Something went wrong. Try again.");
                  setPending(false);
                }
              })();
            }}
          >
            <div>
              <label htmlFor="admin-email" className="block text-sm font-medium text-quizzer-black">
                Email
              </label>
              <input
                id="admin-email"
                name="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1 w-full rounded-[var(--radius-button)] border-2 border-quizzer-black bg-quizzer-white px-3 py-2 text-quizzer-black outline-none focus:ring-2 focus:ring-quizzer-yellow"
              />
            </div>
            <div>
              <label htmlFor="admin-password" className="block text-sm font-medium text-quizzer-black">
                Password
              </label>
              <input
                id="admin-password"
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
        </div>
      </Container>
    </section>
  );
}
