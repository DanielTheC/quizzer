import type { Session } from "@supabase/supabase-js";
import { supabase } from "./supabase";

const ALLOWLIST_CACHE_TTL_MS = 45_000;
let allowlistCache: { userId: string; value: boolean; at: number } | null = null;

/** Call after operator approves host so the next `fetchIsAllowlistedHost` hits the server. */
export function invalidateHostAllowlistCache(): void {
  allowlistCache = null;
}

/** Canonical email for RLS (matches migration checks). */
export function authEmailForHost(session: Session | null | undefined): string | null {
  const direct = session?.user?.email?.trim();
  if (direct) return direct.toLowerCase();
  const meta = session?.user?.user_metadata?.email;
  if (typeof meta === "string" && meta.trim()) return meta.trim().toLowerCase();
  return null;
}

/**
 * True if JWT is allowlisted for host tools. Null if RPC failed (network/JWT).
 */
export async function fetchIsAllowlistedHost(session: Session | null): Promise<boolean | null> {
  const uid = session?.user?.id;
  const now = Date.now();
  if (
    uid &&
    allowlistCache &&
    allowlistCache.userId === uid &&
    now - allowlistCache.at < ALLOWLIST_CACHE_TTL_MS
  ) {
    return allowlistCache.value;
  }
  const { data, error } = await supabase.rpc("is_allowlisted_host");
  if (error) {
    console.warn("is_allowlisted_host:", error.message);
    return null;
  }
  const value = data === true;
  if (uid) allowlistCache = { userId: uid, value, at: now };
  return value;
}

export type HostApplicationRow = {
  id: string;
  email: string;
  full_name: string;
  phone: string;
  experience_notes: string;
  status: "pending" | "approved" | "rejected";
  created_at: string;
  reviewed_at: string | null;
  rejection_reason: string | null;
};

/** Most recent host application for this account (any status), keyed by email. */
export async function fetchLatestHostApplication(emailLower: string): Promise<HostApplicationRow | null> {
  const { data, error } = await supabase
    .from("host_applications")
    .select("id, email, full_name, phone, experience_notes, status, created_at, reviewed_at, rejection_reason")
    .eq("email", emailLower)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.warn("host_applications latest fetch:", error.message);
    return null;
  }
  if (!data) return null;
  return data as HostApplicationRow;
}

/** Latest pending application for this account, if any. */
export async function fetchPendingHostApplication(
  emailLower: string
): Promise<HostApplicationRow | null> {
  const latest = await fetchLatestHostApplication(emailLower);
  if (latest?.status === "pending") return latest;
  return null;
}
