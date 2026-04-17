import { redirect } from "next/navigation";
import { PortalShell } from "@/components/portal/PortalShell";
import { venueLinksFromPublicanProfile } from "@/components/portal/portal-types";
import { PortalSupabaseEnvMissing } from "@/components/portal/PortalSupabaseEnvMissing";
import { createServerSupabaseClientSafe } from "@/lib/supabase/server";

export default async function PortalShellLayout({ children }: { children: React.ReactNode }) {
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

  const { data: profile, error: profileError } = await supabase
    .from("publican_profiles")
    .select("venue_id, venues ( name )")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError) {
    console.error("publican_profiles shell:", profileError.message);
  }

  const venueLinks = venueLinksFromPublicanProfile(profile ?? null);

  return (
    <PortalShell userEmail={user.email} isPublican={Boolean(profile)} venueLinks={venueLinks}>
      {children}
    </PortalShell>
  );
}
