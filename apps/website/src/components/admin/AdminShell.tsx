"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { createBrowserSupabaseClient } from "@/lib/supabase/browser";
import { captureSupabaseError } from "@/lib/observability/supabaseErrors";

const NAV = [
  { href: "/admin", label: "Home" },
  { href: "/admin/analytics", label: "Analytics" },
  { href: "/admin/hosts", label: "Hosts" },
  { href: "/admin/messages", label: "Messages" },
  { href: "/admin/quizzes", label: "Quizzes" },
  { href: "/admin/venue-enquiries", label: "Venue enquiries" },
  { href: "/admin/venues", label: "Venues" },
  { href: "/admin/packs", label: "Packs" },
  { href: "/admin/observability", label: "Observability" },
];

export function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [signingOut, setSigningOut] = useState(false);
  const [triageCount, setTriageCount] = useState(0);
  const [messagesCount, setMessagesCount] = useState(0);
  const [claimsCount, setClaimsCount] = useState(0);
  const [venueEnquiriesNewCount, setVenueEnquiriesNewCount] = useState(0);

  useEffect(() => {
    let active = true;
    async function fetchCounts() {
      try {
        const supabase = createBrowserSupabaseClient();
        const [appRes, msgRes, claimsRes, venueEnqRes] = await Promise.all([
          supabase
            .from("host_applications")
            .select("id", { count: "exact", head: true })
            .eq("status", "pending"),
          supabase
            .from("publican_messages")
            .select("id", { count: "exact", head: true })
            .in("status", ["open", "in_progress"]),
          supabase
            .from("quiz_claims")
            .select("id", { count: "exact", head: true })
            .eq("status", "pending"),
          supabase
            .from("venue_enquiries")
            .select("id", { count: "exact", head: true })
            .eq("status", "new"),
        ]);
        if (appRes.error) captureSupabaseError("admin.shell.pending_applications_count", appRes.error);
        if (msgRes.error) captureSupabaseError("admin.shell.open_messages_count", msgRes.error);
        if (claimsRes.error) captureSupabaseError("admin.shell.pending_claims_count", claimsRes.error);
        if (venueEnqRes.error)
          captureSupabaseError("admin.shell.new_venue_enquiries_count", venueEnqRes.error);
        if (active) {
          setTriageCount(appRes.count ?? 0);
          setMessagesCount(msgRes.count ?? 0);
          setClaimsCount(claimsRes.count ?? 0);
          setVenueEnquiriesNewCount(venueEnqRes.count ?? 0);
        }
      } catch {
        // counts are best-effort — silence errors
      }
    }
    void fetchCounts();
    const t = setInterval(() => void fetchCounts(), 60_000);
    return () => {
      active = false;
      clearInterval(t);
    };
  }, []);

  return (
    <div className="flex min-h-screen flex-col bg-quizzer-cream text-quizzer-black">
      <header className="border-b-[3px] border-quizzer-black bg-quizzer-white">
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

              const badge =
                item.href === "/admin" && triageCount > 0
                  ? triageCount
                  : item.href === "/admin/messages" && messagesCount > 0
                    ? messagesCount
                    : item.href === "/admin/hosts" && claimsCount > 0
                      ? claimsCount
                      : item.href === "/admin/venue-enquiries" && venueEnquiriesNewCount > 0
                        ? venueEnquiriesNewCount
                        : null;

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`relative rounded-[var(--radius-button)] border-[3px] px-3 py-2 text-sm font-medium transition hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[var(--shadow-button-hover)] ${
                    active
                      ? "border-quizzer-black bg-quizzer-yellow text-quizzer-black shadow-[var(--shadow-button)]"
                      : "border-quizzer-black bg-quizzer-white text-quizzer-black shadow-[var(--shadow-button)]"
                  }`}
                  aria-current={active ? "page" : undefined}
                >
                  {item.label}
                  {badge ? (
                    <span className="ml-1.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-quizzer-red px-1 text-[10px] font-bold leading-none text-quizzer-white">
                      {badge > 99 ? "99+" : badge}
                    </span>
                  ) : null}
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
            className="rounded-[var(--radius-button)] border-[3px] border-quizzer-black bg-quizzer-white px-3 py-2 text-xs font-semibold shadow-[var(--shadow-button)] hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[var(--shadow-button-hover)] disabled:opacity-50"
          >
            {signingOut ? "Signing out…" : "Sign out"}
          </button>
        </div>
      </header>
      <div className="mx-auto w-full max-w-7xl flex-1 px-4 py-8">{children}</div>
    </div>
  );
}
