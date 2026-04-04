import type { Session } from "@supabase/supabase-js";
import { supabase } from "./supabase";
import { isDevBypassSession } from "./devAuthBypass";

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
 * Dev auth bypass is treated as allowlisted so local host flows keep working.
 */
export async function fetchIsAllowlistedHost(session: Session | null): Promise<boolean | null> {
  if (isDevBypassSession(session)) return true;
  const { data, error } = await supabase.rpc("is_allowlisted_host");
  if (error) {
    console.warn("is_allowlisted_host:", error.message);
    return null;
  }
  return data === true;
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
};

/** Latest pending application for this account, if any. */
export async function fetchPendingHostApplication(
  emailLower: string
): Promise<HostApplicationRow | null> {
  const { data, error } = await supabase
    .from("host_applications")
    .select("id, email, full_name, phone, experience_notes, status, created_at, reviewed_at")
    .eq("email", emailLower)
    .eq("status", "pending")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.warn("host_applications pending fetch:", error.message);
    return null;
  }
  return data as HostApplicationRow | null;
}
