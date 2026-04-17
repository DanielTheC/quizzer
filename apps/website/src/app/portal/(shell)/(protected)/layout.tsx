import { redirect } from "next/navigation";
import { PortalSupabaseEnvMissing } from "@/components/portal/PortalSupabaseEnvMissing";
import { createServerSupabaseClientSafe } from "@/lib/supabase/server";

export default async function PortalProtectedLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createServerSupabaseClientSafe();
  if (!supabase) {
    return <PortalSupabaseEnvMissing />;
  }
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/portal/sign-in?next=/portal");
  }

  const { data: profile } = await supabase
    .from("publican_profiles")
    .select("id, venue_id, first_name, last_name, email")
    .eq("id", user.id)
    .maybeSingle();
  if (!profile) {
    redirect("/portal/sign-in?error=no-access");
  }

  return <>{children}</>;
}
