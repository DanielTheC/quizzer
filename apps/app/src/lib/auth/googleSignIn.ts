import { signInWithOAuthProvider } from "./oauthPkceFlow";

/** Google sign-in via Supabase OAuth + in-app browser (Expo). */
export async function signInWithGoogle(): Promise<{ error: Error | null }> {
  return signInWithOAuthProvider("google");
}
