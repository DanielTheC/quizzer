import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";

/**
 * Studio is shown full-viewport so it isn't cramped by the site nav/footer.
 * Access is restricted to authenticated operators.
 */
export default async function StudioLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/admin/sign-in");
  }

  const { data: isOp } = await supabase.rpc("is_operator");
  if (!isOp) {
    redirect("/admin/sign-in");
  }

  return (
    <div className="fixed inset-0 z-50 bg-white" style={{ minHeight: "100dvh" }}>
      {children}
    </div>
  );
}
