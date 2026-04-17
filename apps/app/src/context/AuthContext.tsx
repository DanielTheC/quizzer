import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";
import { signInWithApple } from "../lib/auth/appleSignIn";
import { signInWithGoogle } from "../lib/auth/googleSignIn";
import { normalizePhoneE164, requestPhoneOtp, verifyPhoneOtp } from "../lib/auth/phoneAuth";
import { clearPackCache } from "../lib/quizPack";

type AuthContextValue = {
  session: Session | null;
  user: User | null;
  initializing: boolean;
  signInWithEmail: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUpWithEmail: (email: string, password: string) => Promise<{ error: Error | null }>;
  signInWithGoogle: () => Promise<{ error: Error | null }>;
  signInWithApple: () => Promise<{ error: Error | null }>;
  /** `phone` can include spaces; normalised to E.164 (UK `0…` → `+44…`). */
  requestPhoneOtp: (phone: string) => Promise<{ error: Error | null }>;
  verifyPhoneOtp: (phone: string, token: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [initializing, setInitializing] = useState(true);

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
    } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
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

  const signOut = useCallback(async () => {
    await clearPackCache();
    await supabase.auth.signOut({ scope: "local" });
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      user: session?.user ?? null,
      initializing,
      signInWithEmail,
      signUpWithEmail,
      signInWithGoogle: signInWithGoogleOAuth,
      signInWithApple: signInWithAppleOAuth,
      requestPhoneOtp: requestPhoneOtpCb,
      verifyPhoneOtp: verifyPhoneOtpCb,
      signOut,
    }),
    [
      session,
      initializing,
      signInWithEmail,
      signUpWithEmail,
      signInWithGoogleOAuth,
      signInWithAppleOAuth,
      requestPhoneOtpCb,
      verifyPhoneOtpCb,
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
