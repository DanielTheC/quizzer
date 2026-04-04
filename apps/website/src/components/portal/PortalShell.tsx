import Link from "next/link";
import type { PortalVenueLink } from "./portal-types";
import { PortalSignOutButton } from "./PortalSignOutButton";
import { PortalVenueNav } from "./PortalVenueNav";

type Props = {
  userEmail: string | undefined;
  isPublican: boolean;
  venueLinks: PortalVenueLink[];
  children: React.ReactNode;
};

/**
 * Full-viewport portal chrome (matches the dedicated-studio pattern): sidebar + main.
 */
export function PortalShell({ userEmail, isPublican, venueLinks, children }: Props) {
  return (
    <div
      className="fixed inset-0 z-40 flex bg-[var(--color-quizzer-cream)] text-[var(--color-quizzer-black)]"
      style={{ minHeight: "100dvh" }}
    >
      <aside
        className="flex w-64 shrink-0 flex-col border-r-[var(--border-thick)] border-quizzer-black bg-quizzer-white"
        aria-label="Venues you manage"
      >
        <div className="border-b-[var(--border-thick)] border-quizzer-black px-4 py-4">
          <Link
            href="/"
            className="font-heading text-lg uppercase tracking-wide text-quizzer-black hover:opacity-80"
          >
            Quizzer
          </Link>
          <p className="mt-2 text-xs text-quizzer-black/70">Publican portal</p>
        </div>
        <nav className="flex-1 overflow-y-auto px-2 py-3">
          {isPublican && venueLinks.length > 0 ? (
            <PortalVenueNav venueLinks={venueLinks} />
          ) : (
            <p className="px-3 text-sm text-quizzer-black/60">
              {isPublican ? "No venues linked yet." : "Venue list appears once you have access."}
            </p>
          )}
        </nav>
        <div className="border-t-[var(--border-thick)] border-quizzer-black p-3 text-xs text-quizzer-black/70">
          {userEmail ? <p className="truncate px-1">{userEmail}</p> : null}
          <PortalSignOutButton className="mt-2" />
        </div>
      </aside>
      <main className="min-w-0 flex-1 overflow-y-auto">{children}</main>
    </div>
  );
}
