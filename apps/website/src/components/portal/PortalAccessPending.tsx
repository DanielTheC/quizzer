import Link from "next/link";

export function PortalAccessPending() {
  return (
    <div className="flex min-h-full flex-col justify-center px-8 py-12">
      <div className="max-w-lg border-[var(--border-thick)] border-quizzer-black bg-quizzer-white p-8 shadow-[var(--shadow-card)]">
        <h1 className="font-heading text-2xl uppercase text-quizzer-black">Portal access</h1>
        <p className="mt-4 text-base text-quizzer-black/80">
          Your account is signed in, but it isn&apos;t linked to any venues yet. Contact us and we&apos;ll get you set up
          on the publican portal.
        </p>
        <Link
          href="/contact-us"
          className="mt-8 inline-flex rounded-[var(--radius-button)] border-2 border-quizzer-black bg-quizzer-yellow px-5 py-3 text-sm font-semibold text-quizzer-black shadow-[var(--shadow-button)] transition hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[var(--shadow-button-hover)]"
        >
          Contact us
        </Link>
      </div>
    </div>
  );
}
