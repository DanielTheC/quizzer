"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { PortalVenueLink } from "./portal-types";

type Props = { venueLinks: PortalVenueLink[] };

export function PortalVenueNav({ venueLinks }: Props) {
  const pathname = usePathname();

  const overviewActive = pathname === "/portal";
  const messagesActive = pathname === "/portal/messages" || pathname.startsWith("/portal/messages/");

  return (
    <ul className="space-y-1">
      <li>
        <Link
          href="/portal"
          className={`block rounded-[var(--radius-button)] border-2 px-3 py-2 text-sm font-medium transition ${
            overviewActive
              ? "border-quizzer-black bg-quizzer-yellow text-quizzer-black"
              : "border-transparent text-quizzer-black hover:border-quizzer-black/25 hover:bg-quizzer-cream"
          }`}
          aria-current={overviewActive ? "page" : undefined}
        >
          Overview
        </Link>
      </li>
      <li>
        <Link
          href="/portal/messages"
          className={`block rounded-[var(--radius-button)] border-2 px-3 py-2 text-sm font-medium transition ${
            messagesActive
              ? "border-quizzer-black bg-quizzer-yellow text-quizzer-black"
              : "border-transparent text-quizzer-black hover:border-quizzer-black/25 hover:bg-quizzer-cream"
          }`}
          aria-current={messagesActive ? "page" : undefined}
        >
          Messages
        </Link>
      </li>
      {venueLinks.map((v) => {
        const href = `/portal/venues/${v.venueId}`;
        const active = pathname === href || pathname.startsWith(`${href}/`);
        return (
          <li key={v.id}>
            <Link
              href={href}
              className={`block rounded-[var(--radius-button)] border-2 px-3 py-2 text-sm font-medium transition ${
                active
                  ? "border-quizzer-black bg-quizzer-yellow text-quizzer-black"
                  : "border-transparent text-quizzer-black hover:border-quizzer-black/25 hover:bg-quizzer-cream"
              }`}
              aria-current={active ? "page" : undefined}
            >
              {v.venueName}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
