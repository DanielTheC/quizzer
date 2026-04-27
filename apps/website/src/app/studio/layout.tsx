import { redirect } from "next/navigation";
import { createServerSupabaseClientSafe } from "@/lib/supabase/server";

/**
 * Studio is shown full-viewport so it isn't cramped by the site nav/footer.
 * Access is restricted to authenticated operators.
 */
export default async function StudioLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createServerSupabaseClientSafe();
  if (!supabase) {
    redirect("/admin/sign-in?next=/studio");
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/admin/sign-in?next=/studio");
  }

  const { data: isOp, error } = await supabase.rpc("is_operator");
  if (error || !isOp) {
    redirect("/admin/sign-in?next=/studio");
  }

  return (
    <div className="fixed inset-0 z-50 bg-white" style={{ minHeight: "100dvh" }}>
      {children}
    </div>
  );
}
