import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";
import { signInWithGoogle } from "../lib/auth/googleSignIn";
import { clearPackCache } from "../lib/quizPack";
import { createDevBypassSession, isDevAuthBypassEnabled } from "../lib/devAuthBypass";

type AuthContextValue = {
  session: Session | null;
  user: User | null;
  initializing: boolean;
  signInWithEmail: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUpWithEmail: (email: string, password: string) => Promise<{ error: Error | null }>;
  signInWithGoogle: () => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [bypassSuspended, setBypassSuspended] = useState(false);
  const devBypassActive = isDevAuthBypassEnabled() && !bypassSuspended;
  const [initializing, setInitializing] = useState(() => !isDevAuthBypassEnabled());

  const devSession = useMemo(() => createDevBypassSession(), []);

  useEffect(() => {
    if (devBypassActive) {
      setInitializing(false);
      return;
    }

    let mounted = true;
    setInitializing(true);

    supabase.auth.getSession().then(({ data: { session: s } }) => {
      if (mounted) {
        setSession(s);
        setInitializing(false);
      }
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
  }, [devBypassActive]);

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

  const signOut = useCallback(async () => {
    if (isDevAuthBypassEnabled() && !bypassSuspended) {
      setBypassSuspended(true);
      return;
    }
    await clearPackCache();
    await supabase.auth.signOut();
  }, [bypassSuspended]);

  const value = useMemo<AuthContextValue>(
    () => ({
      session: devBypassActive ? devSession : session,
      user: devBypassActive ? devSession.user : session?.user ?? null,
      initializing,
      signInWithEmail,
      signUpWithEmail,
      signInWithGoogle: signInWithGoogleOAuth,
      signOut,
    }),
    [
      devBypassActive,
      devSession,
      session,
      initializing,
      signInWithEmail,
      signUpWithEmail,
      signInWithGoogleOAuth,
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
