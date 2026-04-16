import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BlogBody } from "@/components/blog/BlogBody";
import { Button } from "@/components/ui/Button";
import { Container } from "@/components/ui/Container";
import { PageHero } from "@/components/ui/PageHero";
import { ShareButton } from "@/components/ui/ShareButton";
import {
  citySlugToLabel,
  fetchQuizDetailById,
  getQuizById,
  venueImageUrl,
} from "@/lib/quizzes";
import { buildBreadcrumbJsonLd, buildQuizEventJsonLd } from "@/lib/structured-data";
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

const DEFAULT_WHAT_TO_EXPECT = [
  "8 rounds, 5 questions each, plus a picture round.",
  "Answers on paper; host enters totals halfway and at the end.",
  "Bonus round (double points) for one round only.",
];

export default async function QuizDetailPage({ params }: Props) {
  const { id } = await params;
  const [quiz, quizPage] = await Promise.all([fetchQuizDetailById(id), getQuizPageByEventId(id)]);
  if (!quiz) notFound();

  const cityLabel = citySlugToLabel(quiz.city);
  const defaultHeroSubtitle = `${quiz.area} · ${quiz.day} · ${quiz.time}`;
  const heroTitle = quizPage?.heroTitle?.trim() || quiz.venueName;
  const heroDescription = quizPage?.heroSubtitle?.trim() || defaultHeroSubtitle;
  const mapsQuery = [quiz.venueName, quiz.address, quiz.postcode].filter(Boolean).join(", ");
  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(mapsQuery || quiz.venueName)}`;
  const bodyBlocks = Array.isArray(quizPage?.body) ? quizPage.body : null;

  const turnUp = quiz.turnUpGuidance ? quiz.turnUpGuidance : "Arrive 10–15 minutes early to bag a table.";
  const venueLines = quiz.whatToExpect
    ? quiz.whatToExpect
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter(Boolean)
    : DEFAULT_WHAT_TO_EXPECT;
  const whatToExpectLines = [turnUp, ...venueLines];

  const isCancelled = !!quiz.hostCancelledAt;
  const feeBasis = quiz.feeBasis === "per_team" ? " per team" : " per person";
  const venueImages = quiz.venueImages;

  const shareText = [
    "Pub quiz near you on Quizzer:",
    "",
    quiz.venueName,
    quiz.address ? `📍 ${quiz.address}${quiz.postcode ? `, ${quiz.postcode}` : ""}` : "",
    `${quiz.day} · ${quiz.time}`,
    `Entry: ${quiz.entryFee}${feeBasis} • Prize: ${quiz.prize}`,
  ]
    .filter(Boolean)
    .join("\n");

  const shareUrl = `https://quizzer.co.uk/find-a-quiz/quiz/${quiz.id}`;

  const SITE_URL = "https://quizzer.co.uk";

  const eventJsonLd = buildQuizEventJsonLd(quiz, id);

  const breadcrumbJsonLd = buildBreadcrumbJsonLd([
    { name: "Find a Quiz", url: `${SITE_URL}/find-a-quiz` },
    { name: cityLabel, url: `${SITE_URL}/find-a-quiz/${quiz.city}` },
    { name: quiz.venueName, url: `${SITE_URL}/find-a-quiz/quiz/${id}` },
  ]);

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(eventJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />
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

          {isCancelled && (
            <div className="mb-6 flex items-start gap-3 rounded-[10px] border-[3px] border-red-500 bg-red-50 p-4">
              <span className="text-red-600 text-xl mt-0.5">⚠</span>
              <p className="text-sm font-semibold text-red-700">
                This week&apos;s quiz is cancelled. Check with the venue before you travel.
              </p>
            </div>
          )}

          <div className="rounded-[12px] border-[3px] border-quizzer-black bg-quizzer-white shadow-[5px_5px_0_#000] overflow-hidden mb-8">
            <div className="h-2 bg-quizzer-yellow border-b-[3px] border-quizzer-black" />
            <div className="p-6">
              <div className="flex items-start justify-between gap-4 mb-4">
                <div className="flex-1 min-w-0">
                  <h2 className="font-heading text-2xl font-normal text-quizzer-black leading-tight">
                    {quiz.venueName}
                  </h2>
                  {quiz.postcode && (
                    <p className="text-sm font-semibold text-quizzer-black/60 mt-0.5">{quiz.postcode}</p>
                  )}
                </div>
                <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                  <span className="px-3 py-1 text-xs font-black bg-quizzer-yellow border-2 border-quizzer-black rounded-full">
                    {quiz.time}
                  </span>
                  <span className="px-3 py-1 text-xs font-black bg-quizzer-black text-quizzer-yellow border-2 border-quizzer-black rounded-full text-center min-w-[52px]">
                    {quiz.day.slice(0, 3).toUpperCase()}
                  </span>
                </div>
              </div>

              <div className="border-t-[2px] border-quizzer-black/10 mb-4" />

              <div className="space-y-2 mb-4">
                <p className="text-sm font-semibold text-quizzer-black">
                  💰 Entry · {quiz.entryFee}
                  {feeBasis}
                </p>
                <p className="text-sm font-semibold text-quizzer-black">🏆 Prize · {quiz.prize}</p>
              </div>

              {(quiz.address || quiz.postcode) && (
                <div className="border-t-[1px] border-quizzer-black/10 pt-4 mb-4">
                  <p className="text-sm text-quizzer-black/70">
                    {[quiz.address, quiz.postcode].filter(Boolean).join(", ")}
                  </p>
                </div>
              )}

              <div className="border-t-[1px] border-quizzer-black/10 pt-4 mb-4">
                <p className="text-xs font-black uppercase tracking-widest text-quizzer-black mb-3">
                  What to expect
                </p>
                <ul className="space-y-2">
                  {whatToExpectLines.map((line, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-quizzer-black/80">
                      <span className="mt-1.5 w-1.5 h-1.5 rounded-sm bg-quizzer-black flex-shrink-0" />
                      {line}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="border-t-[1px] border-quizzer-black/10 pt-4 space-y-2">
                <div className="flex gap-2">
                  <ShareButton title={`Quiz: ${quiz.venueName}`} text={shareText} url={shareUrl} />
                  <a
                    href={mapsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 inline-flex items-center justify-center gap-2 font-bold text-sm border-[3px] border-solid border-quizzer-black rounded-[12px] px-4 py-3 bg-quizzer-pink text-quizzer-white shadow-[3px_3px_0_#000] hover:shadow-[1px_1px_0_#000] hover:translate-x-[2px] hover:translate-y-[2px] transition-all duration-150 no-underline"
                  >
                    Maps
                  </a>
                </div>
              </div>
            </div>
          </div>

          {venueImages.length > 0 && (
            <div className="mb-8">
              <p className="text-xs font-black uppercase tracking-widest text-quizzer-black mb-3">
                Photos
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {venueImages.map((img) => (
                  <div
                    key={img.id}
                    className="aspect-[4/3] rounded-[10px] border-[3px] border-quizzer-black overflow-hidden bg-quizzer-cream"
                  >
                    <img
                      src={venueImageUrl(img.storagePath)}
                      alt={img.altText ?? quiz.venueName}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          <Button href={`/find-a-quiz/${quiz.city}`} variant="primary" size="md">
            More quizzes in {quiz.city === "other" ? "this area" : cityLabel}
          </Button>

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
