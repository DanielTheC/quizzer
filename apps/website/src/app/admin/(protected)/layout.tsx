import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { AdminAccessDenied } from "@/components/admin/AdminAccessDenied";
import { AdminShell } from "@/components/admin/AdminShell";
import { PortalSupabaseEnvMissing } from "@/components/portal/PortalSupabaseEnvMissing";
import { createServerSupabaseClientSafe } from "@/lib/supabase/server";

async function adminSignInNextPath(): Promise<string> {
  const h = await headers();
  const raw = h.get("x-pathname")?.trim() || "/admin";
  const path = raw.startsWith("/admin") && !raw.startsWith("/admin/sign-in") ? raw : "/admin";
  return `/admin/sign-in?next=${encodeURIComponent(path)}`;
}

export default async function AdminProtectedLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createServerSupabaseClientSafe();
  if (!supabase) {
    return <PortalSupabaseEnvMissing />;
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(await adminSignInNextPath());
  }

  const { data: isOperator, error: rpcError } = await supabase.rpc("is_operator");
  if (rpcError) {
    console.error("is_operator:", rpcError.message);
  }

  if (!isOperator) {
    return <AdminAccessDenied />;
  }

  return <AdminShell>{children}</AdminShell>;
}
