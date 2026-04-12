"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { createBrowserSupabaseClient } from "@/lib/supabase/browser";

const NAV = [
  { href: "/admin", label: "Triage" },
  { href: "/admin/analytics", label: "Analytics" },
  { href: "/admin/hosts", label: "Hosts" },
  { href: "/admin/messages", label: "Messages" },
  { href: "/admin/quizzes", label: "Quizzes" },
  { href: "/admin/observability", label: "Observability" },
] as const;

export function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [signingOut, setSigningOut] = useState(false);

  return (
    <div className="flex min-h-screen flex-col bg-[var(--color-quizzer-cream)] text-[var(--color-quizzer-black)]">
      <header className="border-b-[var(--border-thick)] border-quizzer-black bg-quizzer-white">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <Link href="/admin" className="font-heading text-lg uppercase tracking-wide text-quizzer-black">
            Quizzer admin
          </Link>
          <nav className="flex flex-wrap items-center gap-1" aria-label="Admin sections">
            {NAV.map((item) => {
              const active =
                item.href === "/admin"
                  ? pathname === "/admin" || pathname === "/admin/"
                  : pathname === item.href || pathname.startsWith(`${item.href}/`);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`rounded-[var(--radius-button)] border-2 px-3 py-2 text-sm font-medium transition ${
                    active
                      ? "border-quizzer-black bg-quizzer-yellow text-quizzer-black"
                      : "border-transparent text-quizzer-black hover:border-quizzer-black/25 hover:bg-quizzer-cream"
                  }`}
                  aria-current={active ? "page" : undefined}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
          <button
            type="button"
            disabled={signingOut}
            onClick={() => {
              setSigningOut(true);
              void (async () => {
                const supabase = createBrowserSupabaseClient();
                await supabase.auth.signOut();
                router.push("/admin/sign-in");
                router.refresh();
              })();
            }}
            className="rounded-[var(--radius-button)] border-2 border-quizzer-black bg-quizzer-white px-3 py-2 text-xs font-semibold shadow-[var(--shadow-button)] hover:translate-x-[1px] hover:translate-y-[1px] disabled:opacity-50"
          >
            {signingOut ? "Signing out…" : "Sign out"}
          </button>
        </div>
      </header>
      <div className="mx-auto w-full max-w-7xl flex-1 px-4 py-8">{children}</div>
    </div>
  );
}
