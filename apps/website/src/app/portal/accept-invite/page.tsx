import { AcceptInviteButton } from "@/components/portal/AcceptInviteButton";
import { Container } from "@/components/ui/Container";

export const metadata = { title: "Accept your invite", robots: { index: false } };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function firstParam(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

function safeNextPath(raw: string): string {
  const t = raw.trim();
  if (t.startsWith("/portal") && !t.startsWith("//")) return t;
  return "/portal/welcome";
}

export default async function AcceptInvitePage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const tokenHash = firstParam(params.token_hash).trim();
  const next = safeNextPath(firstParam(params.next) || "/portal/welcome");

  if (!tokenHash) {
    return (
      <Container className="max-w-md py-16">
        <div className="border-[3px] border-quizzer-red bg-quizzer-cream p-6 text-quizzer-red shadow-[var(--shadow-card)]">
          <p className="font-semibold">
            This invite link is incomplete. Ask Quizzer support to resend your invite.
          </p>
        </div>
      </Container>
    );
  }

  return (
    <Container className="max-w-md py-16">
      <h1 className="font-heading text-3xl text-quizzer-black mb-2">Welcome to Quizzer</h1>
      <p className="text-quizzer-black/80 mb-8">
        You&apos;ve been invited to manage your venue in the publican portal. Click below to confirm your email and set your
        password.
      </p>
      <AcceptInviteButton tokenHash={tokenHash} next={next} />
    </Container>
  );
}
