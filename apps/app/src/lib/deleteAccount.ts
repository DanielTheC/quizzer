import { supabase } from "./supabase";

export async function deleteAccount(): Promise<{ ok: true } | { ok: false; error: string }> {
  const baseUrl = (process.env.EXPO_PUBLIC_WEBSITE_URL ?? "").trim();
  if (!baseUrl) return { ok: false, error: "App misconfigured. Contact support." };

  const {
    data: { session },
  } = await supabase.auth.getSession();
  const token = session?.access_token;
  if (!token) return { ok: false, error: "Not signed in." };

  try {
    const res = await fetch(`${baseUrl.replace(/\/$/, "")}/api/account/delete`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      return { ok: false, error: body?.error ?? `Delete failed (${res.status})` };
    }
    return { ok: true };
  } catch {
    return { ok: false, error: "Network error. Try again." };
  }
}
