import * as Sentry from "@sentry/react-native";

/** Call once at app startup (e.g. App.tsx). No-op if EXPO_PUBLIC_SENTRY_DSN is unset. */
export function initSentry(): void {
  const dsn = process.env.EXPO_PUBLIC_SENTRY_DSN?.trim();
  if (!dsn) {
    return;
  }

  Sentry.init({
    dsn,
    enabled: true,
    sendDefaultPii: false,
    tracesSampleRate: __DEV__ ? 0.4 : 0.1,
  });
}

export function isSentryEnabled(): boolean {
  return Boolean(process.env.EXPO_PUBLIC_SENTRY_DSN?.trim());
}

export function captureSupabaseError(
  operation: string,
  error: { message: string; code?: string },
  extras?: Record<string, unknown>,
): void {
  if (!isSentryEnabled()) return;
  const err = new Error(`Supabase ${operation}: ${error.message}`);
  err.name = "SupabaseError";
  Sentry.captureException(err, {
    tags: { supabase: "true", operation },
    extra: { code: error.code, ...extras },
  });
}
