import { Container } from "@/components/ui/Container";

export function PortalSupabaseEnvMissing() {
  return (
    <section className="py-16">
      <Container>
        <div className="mx-auto max-w-lg rounded-[var(--radius-card)] border-[var(--border-thick)] border-quizzer-black bg-quizzer-cream p-8">
          <h1 className="font-heading text-xl uppercase text-quizzer-black">Portal unavailable</h1>
          <p className="mt-3 text-sm text-quizzer-black/80">
            This preview build does not have Supabase environment variables. Set{" "}
            <code className="rounded bg-quizzer-white px-1 py-0.5 text-xs">NEXT_PUBLIC_SUPABASE_URL</code> and{" "}
            <code className="rounded bg-quizzer-white px-1 py-0.5 text-xs">NEXT_PUBLIC_SUPABASE_ANON_KEY</code> to use
            the publican portal.
          </p>
        </div>
      </Container>
    </section>
  );
}
