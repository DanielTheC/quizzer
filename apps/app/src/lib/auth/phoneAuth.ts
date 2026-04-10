import { supabase } from "../supabase";

/**
 * Normalise phone for Supabase SMS (E.164). If there is no `+`, UK-style numbers
 * starting with `0` become `+44...`.
 */
export function normalizePhoneE164(raw: string): string {
  const t = raw.trim().replace(/[\s-]/g, "");
  if (!t) return "";
  if (t.startsWith("+")) return t;
  if (t.startsWith("0")) return `+44${t.slice(1)}`;
  return `+${t}`;
}

export async function requestPhoneOtp(e164Phone: string): Promise<{ error: Error | null }> {
  const { error } = await supabase.auth.signInWithOtp({
    phone: e164Phone,
    options: { channel: "sms" },
  });
  return { error: error ? new Error(error.message) : null };
}

export async function verifyPhoneOtp(
  e164Phone: string,
  token: string
): Promise<{ error: Error | null }> {
  const { error } = await supabase.auth.verifyOtp({
    phone: e164Phone,
    token: token.trim().replace(/\s/g, ""),
    type: "sms",
  });
  return { error: error ? new Error(error.message) : null };
}
