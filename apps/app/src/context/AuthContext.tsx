import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";
import { signInWithGoogle } from "../lib/auth/googleSignIn";

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
  const [initializing, setInitializing] = useState(true);

  useEffect(() => {
    let mounted = true;

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

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      user: session?.user ?? null,
      initializing,
      signInWithEmail,
      signUpWithEmail,
      signInWithGoogle: signInWithGoogleOAuth,
      signOut,
    }),
    [session, initializing, signInWithEmail, signUpWithEmail, signInWithGoogleOAuth, signOut]
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
