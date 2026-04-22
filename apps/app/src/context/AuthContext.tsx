import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import * as Linking from "expo-linking";
import { supabase } from "../lib/supabase";
import { signInWithApple } from "../lib/auth/appleSignIn";
import { signInWithGoogle } from "../lib/auth/googleSignIn";
import { normalizePhoneE164, requestPhoneOtp, verifyPhoneOtp } from "../lib/auth/phoneAuth";
import { clearPackCache } from "../lib/quizPack";

type AuthContextValue = {
  session: Session | null;
  user: User | null;
  initializing: boolean;
  recoveryMode: boolean;
  signInWithEmail: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUpWithEmail: (email: string, password: string) => Promise<{ error: Error | null }>;
  signInWithGoogle: () => Promise<{ error: Error | null }>;
  signInWithApple: () => Promise<{ error: Error | null }>;
  /** `phone` can include spaces; normalised to E.164 (UK `0…` → `+44…`). */
  requestPhoneOtp: (phone: string) => Promise<{ error: Error | null }>;
  verifyPhoneOtp: (phone: string, token: string) => Promise<{ error: Error | null }>;
  requestPasswordReset: (email: string) => Promise<{ error: Error | null }>;
  updatePassword: (newPassword: string) => Promise<{ error: Error | null }>;
  clearRecoveryMode: () => void;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

/**
 * Parse a `quizzer://reset-password#access_token=…&refresh_token=…&type=recovery` URL.
 * Supabase's `detectSessionInUrl` is disabled on the native client so we do this by hand
 * when the OS hands us the deep link.
 */
function parseRecoveryUrl(url: string): {
  access_token?: string;
  refresh_token?: string;
  type?: string;
} {
  const out: { access_token?: string; refresh_token?: string; type?: string } = {};
  try {
    const hash = url.includes("#") ? url.split("#")[1] ?? "" : "";
    const queryPart = url.includes("?") ? url.split("?")[1]?.split("#")[0] ?? "" : "";
    const params = new URLSearchParams(hash || queryPart);
    out.access_token = params.get("access_token") ?? undefined;
    out.refresh_token = params.get("refresh_token") ?? undefined;
    out.type = params.get("type") ?? undefined;
  } catch {
    /* ignore */
  }
  return out;
}

function isResetPasswordUrl(url: string): boolean {
  try {
    const parsed = Linking.parse(url);
    return parsed.hostname === "reset-password" || parsed.path === "reset-password";
  } catch {
    return false;
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [initializing, setInitializing] = useState(true);
  const [recoveryMode, setRecoveryMode] = useState(false);

  useEffect(() => {
    let mounted = true;
    setInitializing(true);

    void supabase.auth
      .getSession()
      .then(({ data: { session: s } }) => {
        if (mounted) setSession(s);
      })
      .catch((e) => {
        if (__DEV__) console.warn("auth getSession:", e);
        if (mounted) setSession(null);
      })
      .finally(() => {
        if (mounted) setInitializing(false);
      });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, s) => {
      setSession(s);
      if (event === "PASSWORD_RECOVERY") {
        setRecoveryMode(true);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function handleUrl(url: string | null) {
      if (!url || cancelled) return;
      if (!isResetPasswordUrl(url)) return;
      const { access_token, refresh_token, type } = parseRecoveryUrl(url);
      if (!access_token || !refresh_token) return;
      const { error } = await supabase.auth.setSession({
        access_token,
        refresh_token,
      });
      if (cancelled) return;
      if (error) {
        if (__DEV__) console.warn("recovery setSession failed:", error.message);
        return;
      }
      if (type === "recovery") {
        setRecoveryMode(true);
      }
    }

    void Linking.getInitialURL().then((url) => handleUrl(url));
    const sub = Linking.addEventListener("url", ({ url }) => {
      void handleUrl(url);
    });

    return () => {
      cancelled = true;
      sub.remove();
    };
  }, []);

  const signInWithEmail = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    return { error: error ? new Error(error.message) : null };
  }, []);

  const signUpWithEmail = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
    });
    return { error: error ? new Error(error.message) : null };
  }, []);

  const signInWithGoogleOAuth = useCallback(async () => {
    return signInWithGoogle();
  }, []);

  const signInWithAppleOAuth = useCallback(async () => {
    return signInWithApple();
  }, []);

  const requestPhoneOtpCb = useCallback(async (phone: string) => {
    const e164 = normalizePhoneE164(phone);
    if (!e164 || e164.length < 10) {
      return { error: new Error("Enter a valid mobile number (include country code or start with 0 for UK).") };
    }
    return requestPhoneOtp(e164);
  }, []);

  const verifyPhoneOtpCb = useCallback(async (phone: string, token: string) => {
    const e164 = normalizePhoneE164(phone);
    if (!e164) {
      return { error: new Error("Missing phone number.") };
    }
    return verifyPhoneOtp(e164, token);
  }, []);

  const requestPasswordReset = useCallback(async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: "quizzer://reset-password",
    });
    return { error: error ? new Error(error.message) : null };
  }, []);

  const updatePassword = useCallback(async (newPassword: string) => {
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    return { error: error ? new Error(error.message) : null };
  }, []);

  const clearRecoveryMode = useCallback(() => {
    setRecoveryMode(false);
  }, []);

  const signOut = useCallback(async () => {
    await clearPackCache();
    await supabase.auth.signOut();
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      user: session?.user ?? null,
      initializing,
      recoveryMode,
      signInWithEmail,
      signUpWithEmail,
      signInWithGoogle: signInWithGoogleOAuth,
      signInWithApple: signInWithAppleOAuth,
      requestPhoneOtp: requestPhoneOtpCb,
      verifyPhoneOtp: verifyPhoneOtpCb,
      requestPasswordReset,
      updatePassword,
      clearRecoveryMode,
      signOut,
    }),
    [
      session,
      initializing,
      recoveryMode,
      signInWithEmail,
      signUpWithEmail,
      signInWithGoogleOAuth,
      signInWithAppleOAuth,
      requestPhoneOtpCb,
      verifyPhoneOtpCb,
      requestPasswordReset,
      updatePassword,
      clearRecoveryMode,
      signOut,
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (ctx == null) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return ctx;
}
