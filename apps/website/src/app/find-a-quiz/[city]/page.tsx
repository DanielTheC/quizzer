import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Container } from "@/components/ui/Container";
import { PageHero } from "@/components/ui/PageHero";
import { QuizCard } from "@/components/ui/QuizCard";
import { FeatureCard } from "@/components/ui/FeatureCard";
import { getQuizzesForCity, cities as staticCities } from "@/data/quizzes";
import { getCities, getQuizzesByCity } from "@/lib/quizzes";
import { getCityBySlug, getSiteSettings } from "@/sanity/lib/fetch";
import { buildPageMetadata } from "@/sanity/lib/metadata";

type Props = { params: Promise<{ city: string }> };

export async function generateStaticParams() {
  const fromDb = await getCities();
  const slugs = fromDb.length > 0 ? fromDb.map((c) => c.slug) : staticCities.map((c) => c.slug);
  return slugs.map((slug) => ({ city: slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { city: slug } = await params;
  const [cityDoc, siteSettings] = await Promise.all([
    getCityBySlug(slug),
    getSiteSettings(),
  ]);
  const staticCity = staticCities.find((c) => c.slug === slug);
  const cityName = cityDoc?.cityName ?? staticCity?.name ?? slug;
  const base = buildPageMetadata({
    title: cityDoc?.seoTitle,
    description: cityDoc?.seoDescription,
    siteSettings,
    fallbackTitle: `Pub Quiz ${cityName} | Find a Quiz Near You`,
    fallbackDescription: staticCity?.description ?? `Find pub quizzes in ${cityName}.`,
  });

  return {
    ...base,
    alternates: {
      ...(base.alternates ?? {}),
      canonical: `/find-a-quiz/${slug}`,
    },
  };
}

function accentMap(accent?: string | null): "yellow" | "cream" | "green" {
  if (accent === "cream" || accent === "green") return accent;
  return "yellow";
}

export default async function CityPage({ params }: Props) {
  const { city: slug } = await params;
  const citiesFromDb = await getCities();
  const cityFromDb = citiesFromDb.find((c) => c.slug === slug);
  const staticCity = staticCities.find((c) => c.slug === slug);
  const cityNameForFallback = cityFromDb?.name ?? staticCity?.name;
  if (!cityNameForFallback) notFound();

  const [cityDoc, cityQuizzesFromDbOrStatic] = await Promise.all([
    getCityBySlug(slug),
    // Prefer direct Supabase-by-city query; fall back to existing helper which already falls back to static.
    getQuizzesByCity(slug).then((rows) => (rows.length > 0 ? rows : getQuizzesForCity(slug))),
  ]);

  const cityName = cityDoc?.cityName ?? cityFromDb?.name ?? staticCity?.name ?? slug;
  const heroTitle =
    cityDoc?.heroTitle?.trim() ?? `Pub quiz in ${cityName}`;
  const heroIntro =
    cityDoc?.heroIntro?.trim() ?? cityFromDb?.description ?? staticCity?.description ?? `Find pub quizzes in ${cityName}.`;
  const whyTitle =
    cityDoc?.whyUseQuizzerTitle?.trim() ?? `Why use Quizzer in ${cityName}?`;
  const whyCards = cityDoc?.whyUseQuizzerCards ?? [
    {
      title: "See what's on",
      body: `One place to find quiz nights across ${cityName}. No more hunting on social media.`,
    },
    {
      title: "Play on your phone",
      body: "Join the round on the app. Live leaderboard, no paper, no hassle.",
    },
    {
      title: "Never miss a night",
      body: "Save favourite venues and get reminders so you never miss your regular quiz.",
    },
  ];
  const popularIntro =
    cityDoc?.popularQuizNightsIntro?.trim() ??
    `Our most popular venues in ${cityName}. Use the Quizzer app to see what's on tonight and filter by distance.`;

  return (
    <>
      <PageHero
        title={heroTitle}
        description={heroIntro}
        background="yellow"
      />

      <section className="py-16 bg-quizzer-white">
        <Container>
          <h2 className="font-heading text-3xl text-quizzer-black mb-8">
            Quiz nights in {cityName}
          </h2>
          {cityQuizzesFromDbOrStatic.length === 0 ? (
            <p className="text-quizzer-black/80">
              No quizzes listed yet. Check back soon or{" "}
              <Link href="/host-a-quiz" className="text-quizzer-blue underline">
                add your venue
              </Link>
              .
            </p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {cityQuizzesFromDbOrStatic.map((quiz) => (
                <QuizCard key={quiz.id} quiz={quiz} />
              ))}
            </div>
          )}
        </Container>
      </section>

      <section className="py-16 bg-quizzer-cream">
        <Container>
          <h2 className="font-heading text-3xl text-quizzer-black mb-8">
            Popular quiz nights
          </h2>
          <p className="text-quizzer-black/80 max-w-2xl mb-8">
            {popularIntro}
          </p>
          {cityQuizzesFromDbOrStatic.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              {cityQuizzesFromDbOrStatic.slice(0, 2).map((quiz) => (
                <QuizCard key={quiz.id} quiz={quiz} />
              ))}
            </div>
          )}
        </Container>
      </section>

      <section className="py-16 bg-quizzer-white">
        <Container>
          <h2 className="font-heading text-3xl text-quizzer-black mb-8">
            {whyTitle}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {whyCards.slice(0, 3).map((card, i) => (
              <FeatureCard
                key={i}
                title={card.title ?? ""}
                accent={i === 0 ? "yellow" : i === 1 ? "cream" : "green"}
              >
                {card.body ?? ""}
              </FeatureCard>
            ))}
          </div>
        </Container>
      </section>

      <section className="py-16 bg-quizzer-black text-quizzer-white">
        <Container className="text-center">
          <h2 className="font-heading text-3xl text-quizzer-white mb-4">
            Find more quizzes
          </h2>
          <Button href="/find-a-quiz" variant="primary" size="lg">
            Browse all cities
          </Button>
        </Container>
      </section>
    </>
  );
}
