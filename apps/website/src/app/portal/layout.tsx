import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createServerSupabaseClientSafe } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function PortalRootLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createServerSupabaseClientSafe();
  if (!supabase) {
    return children;
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return children;
  }

  const { data: profile } = await supabase
    .from("publican_profiles")
    .select("id, password_set_at")
    .eq("id", user.id)
    .maybeSingle();

  const h = await headers();
  const pathname = h.get("x-pathname")?.trim() ?? "";

  if (profile && !profile.password_set_at && pathname !== "/portal/welcome") {
    redirect("/portal/welcome");
  }

  return children;
}
