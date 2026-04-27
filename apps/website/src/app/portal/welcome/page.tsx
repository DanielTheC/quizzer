import { redirect } from "next/navigation";
import { WelcomePasswordForm } from "@/components/portal/WelcomePasswordForm";
import { Container } from "@/components/ui/Container";
import { createServerSupabaseClientSafe } from "@/lib/supabase/server";

export const metadata = { title: "Welcome to Quizzer", robots: { index: false } };

export default async function PortalWelcomePage() {
  const supabase = await createServerSupabaseClientSafe();
  if (!supabase) redirect("/portal/sign-in");

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/portal/sign-in");

  const { data: profile } = await supabase
    .from("publican_profiles")
    .select("id, first_name, password_set_at")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile) redirect("/portal/sign-in");

  if (profile.password_set_at) redirect("/portal");

  return (
    <Container className="max-w-md py-16">
      <h1 className="font-heading text-3xl text-quizzer-black mb-2">
        Welcome{profile.first_name ? `, ${profile.first_name}` : ""}.
      </h1>
      <p className="text-quizzer-black/80 mb-8">
        Choose a password to finish setting up your venue account.
      </p>
      <WelcomePasswordForm />
    </Container>
  );
}
