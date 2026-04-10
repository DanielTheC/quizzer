import Link from "next/link";

export const metadata = {
  title: "Observability",
  robots: { index: false, follow: false },
};

export default function AdminObservabilityPage() {
  const dsn = Boolean(process.env.NEXT_PUBLIC_SENTRY_DSN?.trim());
  const issuesUrl = process.env.NEXT_PUBLIC_SENTRY_ISSUES_URL?.trim();

  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="font-heading text-2xl uppercase text-quizzer-black">Observability</h1>
      <p className="text-sm text-quizzer-black/80">
        Client and server errors from this site are reported to{" "}
        <strong className="text-quizzer-black">Sentry</strong> when{" "}
        <code className="rounded bg-quizzer-cream px-1 py-0.5 text-xs">NEXT_PUBLIC_SENTRY_DSN</code> is set.
        Failed Supabase calls from triage (and other instrumented code) include the tag{" "}
        <code className="rounded bg-quizzer-cream px-1 py-0.5 text-xs">supabase=true</code> so you can
        filter them in Sentry Issues.
      </p>

      <section className="rounded-[var(--radius-button)] border-[var(--border-thick)] border-quizzer-black bg-quizzer-white p-4 shadow-[var(--shadow-card)]">
        <h2 className="font-heading text-sm uppercase text-quizzer-black">Status</h2>
        <ul className="mt-3 list-inside list-disc space-y-1 text-sm text-quizzer-black/85">
          <li>Sentry DSN configured: {dsn ? "yes" : "no"}</li>
          <li>
            Source maps (optional): set <code className="text-xs">SENTRY_ORG</code>,{" "}
            <code className="text-xs">SENTRY_PROJECT</code>, and <code className="text-xs">SENTRY_AUTH_TOKEN</code> in
            CI / Vercel for readable stacks.
          </li>
        </ul>
      </section>

      {issuesUrl ? (
        <p>
          <Link
            href={issuesUrl}
            className="font-semibold text-quizzer-black underline underline-offset-2"
            target="_blank"
            rel="noreferrer"
          >
            Open Sentry issues →
          </Link>
        </p>
      ) : (
        <p className="text-sm text-quizzer-black/70">
          Optional: set <code className="text-xs">NEXT_PUBLIC_SENTRY_ISSUES_URL</code> to your project&apos;s Issues page
          for a one-click link from here.
        </p>
      )}

      <p className="text-xs text-quizzer-black/60">
        Postgres and Auth logs for your project are also available in the Supabase dashboard (Logs &amp; Reports).
        This page only documents the app-side error pipeline.
      </p>
    </div>
  );
}
