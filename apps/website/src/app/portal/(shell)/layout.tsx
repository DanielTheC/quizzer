import { redirect } from "next/navigation";
import { PortalAccessPending } from "@/components/portal/PortalAccessPending";
import { PortalShell } from "@/components/portal/PortalShell";
import { mapPublicanVenueRows } from "@/components/portal/portal-types";
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

  const { data: isPublicanRaw, error: rpcError } = await supabase.rpc("is_publican");
  if (rpcError) {
    console.error("is_publican:", rpcError.message);
  }
  const isPublican = Boolean(isPublicanRaw);

  let venueRows: unknown = [];
  if (isPublican) {
    const { data, error } = await supabase
      .from("publican_venues")
      .select("id, venue_id, venues ( name )")
      .order("created_at", { ascending: true });
    if (error) {
      console.error("publican_venues:", error.message);
    } else {
      venueRows = data ?? [];
    }
  }

  const venueLinks = mapPublicanVenueRows(venueRows);

  return (
    <PortalShell userEmail={user.email} isPublican={isPublican} venueLinks={venueLinks}>
      {isPublican ? children : <PortalAccessPending />}
    </PortalShell>
  );
}
