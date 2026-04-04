import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { AdminSignInForm } from "./AdminSignInForm";
import { PortalSupabaseEnvMissing } from "@/components/portal/PortalSupabaseEnvMissing";
import { createServerSupabaseClientSafe } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Sign in",
  description: "Sign in.",
  robots: { index: false, follow: false },
};

function SignInFallback() {
  return (
    <section className="py-16">
      <div className="mx-auto max-w-md px-4 text-center text-sm text-quizzer-black/70">Loading…</div>
    </section>
  );
}

export default async function AdminSignInPage() {
  const supabase = await createServerSupabaseClientSafe();
  if (!supabase) {
    return <PortalSupabaseEnvMissing />;
  }
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) {
    redirect("/admin");
  }

  return (
    <Suspense fallback={<SignInFallback />}>
      <AdminSignInForm />
    </Suspense>
  );
}
