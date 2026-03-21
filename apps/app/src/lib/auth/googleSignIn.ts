import * as Linking from "expo-linking";
import * as WebBrowser from "expo-web-browser";
import { supabase } from "../supabase";

WebBrowser.maybeCompleteAuthSession();

/**
 * Parses access_token / refresh_token from Supabase OAuth redirect URL (hash or query).
 * Also handles PKCE `code` when present.
 */
function parseOAuthRedirectUrl(url: string): {
  access_token?: string;
  refresh_token?: string;
  code?: string;
} {
  const out: { access_token?: string; refresh_token?: string; code?: string } = {};
  try {
    const hash = url.includes("#") ? url.split("#")[1] : "";
    const queryPart = url.includes("?") ? url.split("?")[1]?.split("#")[0] ?? "" : "";
    const params = new URLSearchParams(hash || queryPart);
    out.access_token = params.get("access_token") ?? undefined;
    out.refresh_token = params.get("refresh_token") ?? undefined;
    out.code = params.get("code") ?? undefined;
  } catch {
    /* ignore */
  }
  return out;
}

/**
 * Google sign-in via Supabase OAuth + in-app browser (Expo).
 * Configure Google provider and redirect URLs in the Supabase dashboard (see AUTH_SETUP.md).
 */
export async function signInWithGoogle(): Promise<{ error: Error | null }> {
  try {
    const redirectTo = Linking.createURL("auth/callback");

    const { data, error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo,
        skipBrowserRedirect: true,
      },
    });

    if (oauthError) {
      return { error: new Error(oauthError.message) };
    }
    if (!data?.url) {
      return { error: new Error("No OAuth URL returned from Supabase") };
    }

    const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);

    if (result.type === "cancel" || result.type === "dismiss") {
      return { error: null };
    }
    if (result.type !== "success" || !result.url) {
      return { error: new Error("Sign-in was not completed") };
    }

    const { access_token, refresh_token, code } = parseOAuthRedirectUrl(result.url);

    if (code) {
      const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
      return { error: exchangeError ? new Error(exchangeError.message) : null };
    }

    if (access_token && refresh_token) {
      const { error: sessionError } = await supabase.auth.setSession({
        access_token,
        refresh_token,
      });
      return { error: sessionError ? new Error(sessionError.message) : null };
    }

    return {
      error: new Error(
        "Could not read tokens from sign-in redirect. Check Supabase redirect URL settings."
      ),
    };
  } catch (e) {
    return { error: e instanceof Error ? e : new Error(String(e)) };
  }
}
