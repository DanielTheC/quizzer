"use server";

import { captureSupabaseError } from "@/lib/observability/supabaseErrors";
import { createServerSupabaseClientSafe, createServiceRoleSupabaseClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export async function deleteOwnAccountAction(): Promise<{ ok: false; error: string } | void> {
  const supabase = await createServerSupabaseClientSafe();
  if (!supabase) return { ok: false, error: "Server misconfigured." };

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };

  let adminClient: ReturnType<typeof createServiceRoleSupabaseClient>;
  try {
    adminClient = createServiceRoleSupabaseClient();
  } catch {
    return { ok: false, error: "Service role not configured." };
  }

  const { error: delErr } = await adminClient.auth.admin.deleteUser(user.id);
  if (delErr) {
    captureSupabaseError("web.account.delete", delErr, { user_id: user.id });
    return { ok: false, error: delErr.message };
  }

  await supabase.auth.signOut();

  redirect("/account/delete?status=success");
}
