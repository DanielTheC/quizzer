import type { Metadata } from "next";
import Link from "next/link";
import { Container } from "@/components/ui/Container";
import { PageHero } from "@/components/ui/PageHero";
import { createServerSupabaseClientSafe } from "@/lib/supabase/server";
import { DeleteAccountConfirm } from "./DeleteAccountConfirm";

export const metadata: Metadata = {
  title: "Delete your Quizzer account",
  description: "Permanently delete your Quizzer account and all associated data.",
  robots: { index: true, follow: true },
  alternates: { canonical: "/account/delete" },
};

type SearchParams = Promise<{ status?: string }>;

export default async function DeleteAccountPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const justDeleted = params.status === "success";

  let userEmail: string | null = null;
  if (!justDeleted) {
    const supabase = await createServerSupabaseClientSafe();
    if (supabase) {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      userEmail = user?.email ?? null;
    }
  }

  return (
    <>
      <PageHero
        title={justDeleted ? "Account deleted" : "Delete your Quizzer account"}
        description={
          justDeleted
            ? "Your account and all your data have been removed."
            : "Permanently remove your Quizzer account and all associated data."
        }
        background="yellow"
      />
      <section className="py-16 bg-quizzer-white">
        <Container>
          <div className="max-w-xl space-y-6">
            {justDeleted ? (
              <div className="border-[3px] border-quizzer-black bg-quizzer-cream p-6 shadow-[var(--shadow-card)]">
                <p className="text-quizzer-black">
                  Your Quizzer account, saved quizzes, host applications, and any interest you&apos;d marked on quiz
                  nights have all been permanently removed. Sorry to see you go.
                </p>
                <p className="mt-4 text-quizzer-black/80">
                  <Link href="/" className="font-medium underline">
                    Back to Quizzer
                  </Link>
                </p>
              </div>
            ) : userEmail ? (
              <>
                <div className="border-[3px] border-quizzer-black bg-quizzer-white p-6 shadow-[var(--shadow-card)]">
                  <h2 className="font-heading text-xl text-quizzer-black mb-3">
                    Signed in as {userEmail}
                  </h2>
                  <p className="text-quizzer-black/80 mb-4">Deleting your account will permanently remove:</p>
                  <ul className="list-disc pl-6 text-quizzer-black/80 space-y-1">
                    <li>Your sign-in email and password</li>
                    <li>Your saved quizzes and reminders</li>
                    <li>Any host applications you&apos;ve submitted</li>
                    <li>Any interest you&apos;ve marked on upcoming quiz nights</li>
                    <li>Push-notification tokens for your devices</li>
                  </ul>
                  <p className="mt-4 text-sm text-quizzer-black/70">
                    This cannot be undone. If you only want to stop notifications, turn them off in the app instead.
                  </p>
                </div>
                <DeleteAccountConfirm />
              </>
            ) : (
              <div className="border-[3px] border-quizzer-black bg-quizzer-white p-6 shadow-[var(--shadow-card)] space-y-4">
                <h2 className="font-heading text-xl text-quizzer-black">Three ways to delete your account</h2>
                <div>
                  <h3 className="font-medium text-quizzer-black">Option 1 — Use the app</h3>
                  <p className="mt-1 text-quizzer-black/80">
                    Open Quizzer, go to <strong>Settings → Danger zone → Delete account</strong>. This is the fastest
                    way and removes everything immediately.
                  </p>
                </div>
                <div>
                  <h3 className="font-medium text-quizzer-black">Option 2 — Sign in here</h3>
                  <p className="mt-1 text-quizzer-black/80">
                    <Link href="/portal/sign-in?next=/account/delete" className="underline font-medium">
                      Sign in
                    </Link>{" "}
                    and we&apos;ll show you the delete-account button on this page.
                  </p>
                </div>
                <div>
                  <h3 className="font-medium text-quizzer-black">Option 3 — Email us</h3>
                  <p className="mt-1 text-quizzer-black/80">
                    Email{" "}
                    <a href="mailto:support@quizzerapp.co.uk" className="underline font-medium">
                      support@quizzerapp.co.uk
                    </a>{" "}
                    from the address on your Quizzer account. We&apos;ll process the deletion within 7 days and confirm by
                    reply.
                  </p>
                </div>
                <div className="border-t-[3px] border-quizzer-black pt-4 mt-4">
                  <h3 className="font-medium text-quizzer-black">What gets deleted</h3>
                  <p className="mt-1 text-quizzer-black/80">
                    Your sign-in email, password, saved quizzes, host applications, interest marks on quiz nights, and
                    push-notification tokens. This is permanent and cannot be undone.
                  </p>
                </div>
              </div>
            )}
          </div>
        </Container>
      </section>
    </>
  );
}
