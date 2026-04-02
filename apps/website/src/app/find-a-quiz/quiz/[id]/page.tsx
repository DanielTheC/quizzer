import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BlogBody } from "@/components/blog/BlogBody";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Container } from "@/components/ui/Container";
import { PageHero } from "@/components/ui/PageHero";
import { citySlugToLabel, getQuizById } from "@/lib/quizzes";
import { getQuizPageByEventId, getQuizPageEventIds, getSiteSettings } from "@/sanity/lib/fetch";
import { buildPageMetadata } from "@/sanity/lib/metadata";

type Props = { params: Promise<{ id: string }> };

export async function generateStaticParams() {
  const [{ fetchQuizzesFromSupabase }, staticMod, sanityIds] = await Promise.all([
    import("@/lib/quizzes"),
    import("@/data/quizzes"),
    getQuizPageEventIds(),
  ]);
  const db = await fetchQuizzesFromSupabase();
  const ids = new Set<string>();
  for (const q of db) ids.add(q.id);
  for (const q of staticMod.quizzes) ids.add(q.id);
  for (const id of sanityIds) ids.add(id);
  return Array.from(ids, (id) => ({ id }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const [quiz, quizPage, siteSettings] = await Promise.all([
    getQuizById(id),
    getQuizPageByEventId(id),
    getSiteSettings(),
  ]);
  if (!quiz) {
    return { title: "Quiz not found" };
  }
  const cityLabel = citySlugToLabel(quiz.city);
  const defaultTitle = `${quiz.venueName} — ${quiz.day} ${quiz.time}`;
  const defaultDescription = `Pub quiz at ${quiz.venueName} in ${quiz.area}. ${quiz.day} ${quiz.time}. Entry ${quiz.entryFee}. Prize: ${quiz.prize}.`;
  const base = buildPageMetadata({
    title: quizPage?.seoTitle?.trim() || defaultTitle,
    description: quizPage?.seoDescription?.trim() || defaultDescription,
    siteSettings,
    fallbackTitle: `${quiz.venueName} | Quizzer`,
    fallbackDescription: `Find this pub quiz in ${cityLabel} on Quizzer.`,
  });
  return {
    ...base,
    alternates: {
      ...(base.alternates ?? {}),
      canonical: `/find-a-quiz/quiz/${id}`,
    },
  };
}

const mapsButtonClass =
  "inline-flex items-center justify-center font-semibold border-[3px] border-solid rounded-[12px] transition-all duration-150 " +
  "bg-quizzer-pink text-quizzer-white border-quizzer-black shadow-[4px_4px_0_#000] hover:shadow-[2px_2px_0_#000] hover:translate-x-[2px] hover:translate-y-[2px] " +
  "px-6 py-3 text-base no-underline";

export default async function QuizDetailPage({ params }: Props) {
  const { id } = await params;
  const [quiz, quizPage] = await Promise.all([getQuizById(id), getQuizPageByEventId(id)]);
  if (!quiz) notFound();

  const cityLabel = citySlugToLabel(quiz.city);
  const defaultHeroSubtitle = `${quiz.area} · ${quiz.day} · ${quiz.time}`;
  const heroTitle = quizPage?.heroTitle?.trim() || quiz.venueName;
  const heroDescription = quizPage?.heroSubtitle?.trim() || defaultHeroSubtitle;
  const mapsQuery = [quiz.venueName, quiz.address, quiz.postcode].filter(Boolean).join(", ");
  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(mapsQuery || quiz.venueName)}`;
  const bodyBlocks = Array.isArray(quizPage?.body) ? quizPage.body : null;

  return (
    <>
      <PageHero title={heroTitle} description={heroDescription} background="yellow" />

      <section className="py-12 bg-quizzer-white">
        <Container className="max-w-2xl">
          <nav className="text-sm text-quizzer-black/80 mb-8" aria-label="Breadcrumb">
            <Link href="/find-a-quiz" className="underline hover:text-quizzer-black">
              Find a quiz
            </Link>
            <span className="mx-2" aria-hidden>
              /
            </span>
            <Link
              href={`/find-a-quiz/${quiz.city}`}
              className="underline hover:text-quizzer-black"
            >
              {cityLabel}
            </Link>
            <span className="mx-2" aria-hidden>
              /
            </span>
            <span className="text-quizzer-black font-medium">{quiz.venueName}</span>
          </nav>

          <div className="rounded-[12px] border-[3px] border-quizzer-black bg-quizzer-white p-6 shadow-[5px_5px_0_#000] text-quizzer-black">
            <p className="text-sm text-quizzer-black/80 mb-3">
              {quiz.area}, {quiz.day} · {quiz.time}
            </p>
            <div className="flex flex-wrap gap-2 mb-3">
              <span className="text-sm font-semibold">Entry {quiz.entryFee}</span>
              <span className="text-sm">· Prize: {quiz.prize}</span>
            </div>
            {quiz.tags.length > 0 ? (
              <div className="flex flex-wrap gap-1.5 mb-4">
                {quiz.tags.map((tag) => (
                  <Badge key={tag} variant="yellow">
                    {tag}
                  </Badge>
                ))}
              </div>
            ) : null}
            {(quiz.address || quiz.postcode) && (
              <p className="text-sm text-quizzer-black/80 mb-6">
                {[quiz.address, quiz.postcode].filter(Boolean).join(", ")}
              </p>
            )}
            <div className="flex flex-wrap gap-3">
              <a
                href={mapsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className={mapsButtonClass}
              >
                Open in Maps
              </a>
              <Button href={`/find-a-quiz/${quiz.city}`} variant="primary" size="md">
                More in {quiz.city === "other" ? "this area" : cityLabel}
              </Button>
            </div>
          </div>

          {bodyBlocks && bodyBlocks.length > 0 ? (
            <div className="mt-12 max-w-[720px]">
              <BlogBody value={bodyBlocks} />
            </div>
          ) : null}
        </Container>
      </section>
    </>
  );
}
