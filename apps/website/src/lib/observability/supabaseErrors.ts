import * as Sentry from "@sentry/nextjs";

/** PostgrestError shape from @supabase/supabase-js (and compatible API errors). */
export type SupabaseReportableError = {
  message: string;
  code?: string;
  details?: string;
  hint?: string;
};

export function isSentryConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SENTRY_DSN?.trim());
}

/**
 * Send a failed Supabase call to Sentry as an exception (filter in UI: tag `supabase` = true).
 * Safe to call from Client or Server components when `@sentry/nextjs` is installed.
 */
export function captureSupabaseError(
  operation: string,
  error: SupabaseReportableError,
  extras?: Record<string, unknown>,
) {
  if (!isSentryConfigured()) return;

  const err = new Error(`Supabase ${operation}: ${error.message}`);
  err.name = "SupabaseError";

  Sentry.captureException(err, {
    tags: { supabase: "true", operation },
    extra: {
      code: error.code,
      details: error.details,
      hint: error.hint,
      ...extras,
    },
  });
}
