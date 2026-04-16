import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Container } from "@/components/ui/Container";
import { PageHero } from "@/components/ui/PageHero";
import { Card } from "@/components/ui/Card";
import { QuizFilterAndList } from "@/components/quiz/QuizFilterAndList";
import { getQuizzesAndCitiesForFindAQuiz } from "@/lib/quizzes";

export const metadata: Metadata = {
  title: "Find a Pub Quiz Near You",
  description:
    "Browse pub quizzes by city. Find quiz nights in London, Manchester, Birmingham, Glasgow, Edinburgh and more.",
  keywords: ["pub quiz near me", "pub quiz London", "quiz night", "find a quiz"],
  alternates: {
    canonical: "/find-a-quiz",
  },
};

const SHOW_DATA_SOURCE_BANNER = process.env.NEXT_PUBLIC_DEBUG_QUIZZES === "true";

export default async function FindAQuizPage() {
  const { quizzes, cities, quizSource, citySource } =
    await getQuizzesAndCitiesForFindAQuiz();

  return (
    <>
      {SHOW_DATA_SOURCE_BANNER && (
        <div
          className="bg-quizzer-black text-quizzer-yellow text-center py-2 px-4 text-sm font-semibold border-b-2 border-quizzer-yellow"
          role="status"
        >
          Data: quizzes from {quizSource} ({quizzes.length}), cities from{" "}
          {citySource} ({cities.length}). Set NEXT_PUBLIC_DEBUG_QUIZZES=false to
          hide.
        </div>
      )}
      <PageHero
        title="Find a Pub Quiz Near You"
        description="Browse quiz nights by city. Pick a location below or use the Quizzer app to find quizzes near you with filters and maps."
        background="yellow"
      >
        <Button href="/find-a-quiz/london" size="lg">
          Browse by city
        </Button>
      </PageHero>

      <section className="py-16 bg-quizzer-white">
        <Container>
          <h2 className="font-heading text-3xl text-quizzer-black mb-8">
            Cities
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {cities.map((city) => {
              const count = quizzes.filter((q) => q.city === city.slug).length;
              return (
                <Link
                  key={city.slug}
                  href={`/find-a-quiz/${city.slug}`}
                  className="block no-underline text-quizzer-black"
                >
                  <Card accent="bg-quizzer-cream" className="h-full hover:shadow-[3px_3px_0_#000] hover:translate-x-[2px] hover:translate-y-[2px]">
                    <h3 className="font-heading text-xl font-normal">
                      {city.name}
                    </h3>
                    <p className="text-sm text-quizzer-black/80 mt-1">
                      {count} quiz{count !== 1 ? "zes" : ""} listed
                    </p>
                  </Card>
                </Link>
              );
            })}
          </div>
        </Container>
      </section>

      <section className="py-16 bg-quizzer-cream">
        <Container>
          <h2 className="font-heading text-3xl text-quizzer-black mb-8">
            All quizzes
          </h2>
          <p className="text-quizzer-black/80 mb-6">
            Filter by day below. When you allow location access, quizzes are sorted by distance automatically.
          </p>
          <QuizFilterAndList quizzes={quizzes} />
        </Container>
      </section>

      <section className="py-16 bg-quizzer-black text-quizzer-white">
        <Container className="text-center">
          <h2 className="font-heading text-3xl text-quizzer-white mb-4">
            Run a quiz at your venue?
          </h2>
          <p className="text-quizzer-white/80 mb-6">
            List your quiz and let players find you. We help with rounds and
            leaderboards.
          </p>
          <Button href="/host-a-quiz" variant="primary" size="lg">
            Host a Quiz
          </Button>
        </Container>
      </section>
    </>
  );
}
