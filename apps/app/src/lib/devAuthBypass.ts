import type { Session, User } from "@supabase/supabase-js";

/**
 * When true (only possible in __DEV__), AuthContext exposes a fake session so you can skip login.
 * Enable with EXPO_PUBLIC_DEV_SKIP_AUTH=1 in .env. Never set this for release builds.
 */
export function isDevAuthBypassEnabled(): boolean {
  if (!__DEV__) return false;
  const v = String(process.env.EXPO_PUBLIC_DEV_SKIP_AUTH ?? "")
    .trim()
    .toLowerCase();
  return v === "1" || v === "true" || v === "yes";
}

/** Minimal session for UI that expects user / session; not valid for Supabase JWT calls. */
/** True when the current session is the dev fake session (not valid for Supabase writes). */
export function isDevBypassSession(session: Session | null | undefined): boolean {
  return (
    isDevAuthBypassEnabled() &&
    session?.access_token === "dev-bypass-access-token"
  );
}

export function createDevBypassSession(): Session {
  const now = Math.floor(Date.now() / 1000);
  const user: User = {
    id: "00000000-0000-0000-0000-0000000d3v1",
    aud: "authenticated",
    role: "authenticated",
    email: "dev-bypass@local.invalid",
    email_confirmed_at: new Date().toISOString(),
    phone: "",
    confirmed_at: new Date().toISOString(),
    last_sign_in_at: new Date().toISOString(),
    app_metadata: {},
    user_metadata: {},
    identities: [],
    factors: [],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    is_anonymous: false,
  };
  return {
    access_token: "dev-bypass-access-token",
    refresh_token: "dev-bypass-refresh-token",
    expires_in: 3600,
    expires_at: now + 3600,
    token_type: "bearer",
    provider_token: null,
    provider_refresh_token: null,
    user,
  };
}
