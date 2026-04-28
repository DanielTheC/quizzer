import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Container } from "@/components/ui/Container";
import { Section } from "@/components/ui/Section";
import { PageHero } from "@/components/ui/PageHero";
import { StatBadge } from "@/components/ui/StatBadge";
import { FeatureCard } from "@/components/ui/FeatureCard";
import { QuizCard } from "@/components/ui/QuizCard";
import { Accordion, AccordionItem } from "@/components/ui/Accordion";
import { fetchQuizzesFromSupabase } from "@/lib/quizzes";
import { getHomePage, getSiteSettings, getAllFaqs } from "@/sanity/lib/fetch";
import { buildPageMetadata } from "@/sanity/lib/metadata";

const DEFAULT_HERO_TITLE = "Find a Pub Quiz Near You";
const DEFAULT_HERO_SUBTITLE =
  "Discover quiz nights at pubs near you. Play live, climb the leaderboard, and never miss a round. Download the Quizzer app or browse below.";
const DEFAULT_FEATURES = [
  {
    title: "Find quizzes nearby",
    body: "See what's on tonight and filter by distance, day, and prize. One app for all your local quiz nights.",
    accent: "yellow",
  },
  {
    title: "Phones-away pub quiz",
    body: "We're not trying to put the quiz on your phone. Quizzer is the real thing — a host, a room, high-quality colour answer sheets. The way pub quiz should be.",
    accent: "cream",
  },
  {
    title: "Save your regulars",
    body: "Save favourite venues and get reminders so you never miss your local. The app helps you find quiz night — then you put it away.",
    accent: "green",
  },
];
const DEFAULT_HOST_TITLE = "Pub quiz hosting for your venue";
const DEFAULT_HOST_COPY =
  "We run quiz nights at your venue, end to end. Our hosts bring the energy, the questions, and the answer sheets. Our app brings the players. You bring the room and the bar.";
const DEFAULT_FINAL_CTA_TITLE = "Ready to play?";
const DEFAULT_FINAL_CTA_COPY =
  "Find your next quiz night and download the Quizzer app for the best experience.";
const DEFAULT_FAQ_PREVIEW = [
  {
    q: "How do I find a pub quiz near me?",
    a: "Use the Quizzer app or this website to browse quizzes by city. You can filter by day, area, and more. \"Pub quiz near me\" is easy with Quizzer.",
  },
  {
    q: "Is the Quizzer app free?",
    a: "Yes. Players can find and play quizzes for free. Some venues charge a small entry fee for the quiz itself.",
  },
  {
    q: "What does Quizzer's hosting service include?",
    a: "We provide the full package — a Quizzer host runs the night, we write and run the quiz, and your venue gets discovered through the Quizzer app. Get in touch via the For Venues page.",
  },
];

export async function generateMetadata(): Promise<Metadata> {
  const [homePage, siteSettings] = await Promise.all([
    getHomePage(),
    getSiteSettings(),
  ]);
  return buildPageMetadata({
    title: homePage?.seoTitle,
    description: homePage?.seoDescription,
    siteSettings,
    fallbackTitle: DEFAULT_HERO_TITLE,
    fallbackDescription:
      "Find and play pub quizzes near you. Quizzer helps players discover quiz nights and venues run smarter quiz nights.",
  });
}

export default async function HomePage() {
  const [homePage, faqsFromSanity] = await Promise.all([
    getHomePage(),
    getAllFaqs(),
  ]);

  const heroTitle = homePage?.heroTitle?.trim() || DEFAULT_HERO_TITLE;
  const heroSubtitle = homePage?.heroSubtitle?.trim() || DEFAULT_HERO_SUBTITLE;
  const statItems = homePage?.statItems ?? [];
  const featureCards =
    homePage?.featureCards?.length ? homePage.featureCards : DEFAULT_FEATURES;
  const hostSectionTitle =
    homePage?.hostSectionTitle?.trim() || DEFAULT_HOST_TITLE;
  const hostSectionCopy = homePage?.hostSectionCopy?.trim() || DEFAULT_HOST_COPY;
  const finalCtaTitle =
    homePage?.finalCtaTitle?.trim() || DEFAULT_FINAL_CTA_TITLE;
  const finalCtaCopy =
    homePage?.finalCtaCopy?.trim() || DEFAULT_FINAL_CTA_COPY;

  const faqPreview =
    faqsFromSanity && faqsFromSanity.length > 0
      ? faqsFromSanity.slice(0, 3).map((f) => ({
          q: f.question ?? "",
          a: f.answer ?? "",
        }))
      : DEFAULT_FAQ_PREVIEW;

  const ukTodayWeekday = new Intl.DateTimeFormat("en-GB", {
    weekday: "long",
    timeZone: "Europe/London",
  }).format(new Date());
  const allQuizzes = await fetchQuizzesFromSupabase();
  const tonightQuizzes = allQuizzes
    .filter((q) => q.day === ukTodayWeekday)
    .slice(0, 6); // show up to 6 cards in a 3-col grid

  const featureAccent = (accent?: string | null): "yellow" | "cream" | "green" =>
    accent === "cream" || accent === "green" ? accent : "yellow";

  return (
    <>
      <PageHero
        title={heroTitle}
        description={heroSubtitle}
        background="yellow"
      >
        <div className="flex flex-wrap gap-4 mt-6">
          <Button href="/find-a-quiz" size="lg">
            Find a Quiz
          </Button>
          <Button href="/host-a-quiz" variant="outline" size="lg">
            For Venues
          </Button>
        </div>
      </PageHero>

      {statItems.length > 0 && (
        <Section background="white">
          <Container>
            <div className="flex flex-wrap gap-6 justify-center">
              {statItems.map((stat, i) => (
                <StatBadge
                  key={i}
                  value={stat.value ?? ""}
                  label={stat.label ?? ""}
                />
              ))}
            </div>
          </Container>
        </Section>
      )}

      <Section background="cream">
        <Container>
          <h2 className="font-heading text-3xl sm:text-4xl text-quizzer-black mb-10 text-center">
            Why Quizzer?
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {featureCards.map((card, i) => (
              <FeatureCard
                key={i}
                title={card.title ?? ""}
                accent={featureAccent(card.accent)}
              >
                {card.body ?? ""}
              </FeatureCard>
            ))}
          </div>
        </Container>
      </Section>

      <Section background="white">
        <Container>
          <h2 className="font-heading text-3xl sm:text-4xl text-quizzer-black mb-10">
            Tonight&apos;s Quizzes
          </h2>
          {tonightQuizzes.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {tonightQuizzes.map((quiz) => (
                <QuizCard key={quiz.id} quiz={quiz} />
              ))}
            </div>
          ) : (
            <p className="text-quizzer-black/60 text-lg">
              No quizzes listed for tonight — check back soon, or{" "}
              <Link href="/find-a-quiz" className="font-semibold underline text-quizzer-black">
                browse all quiz nights
              </Link>
              .
            </p>
          )}
          <div className="mt-10 text-center">
            <Button href="/find-a-quiz" size="lg">
              View all quizzes
            </Button>
          </div>
        </Container>
      </Section>

      <Section background="yellow">
        <Container>
          <h2 className="font-heading text-3xl sm:text-4xl text-quizzer-black mb-10 text-center">
            How it works
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-4xl mx-auto">
            <div className="text-center">
              <div className="font-heading text-4xl text-quizzer-black mb-2">
                1
              </div>
              <h3 className="font-semibold text-quizzer-black mb-2">
                Find a quiz
              </h3>
              <p className="text-quizzer-black/80 text-sm">
                Browse by city or use the app to see what&apos;s on near you.
              </p>
            </div>
            <div className="text-center">
              <div className="font-heading text-4xl text-quizzer-black mb-2">
                2
              </div>
              <h3 className="font-semibold text-quizzer-black mb-2">
                Turn up & play
              </h3>
              <p className="text-quizzer-black/80 text-sm">
                Grab a table, take your answer sheet, and play the proper way.
                No screens, no apps — just you, your team, and the room.
              </p>
            </div>
            <div className="text-center">
              <div className="font-heading text-4xl text-quizzer-black mb-2">
                3
              </div>
              <h3 className="font-semibold text-quizzer-black mb-2">
                Save your favourites
              </h3>
              <p className="text-quizzer-black/80 text-sm">
                Found a quiz you love? Save it in the app so you never miss
                next week&apos;s round.
              </p>
            </div>
          </div>
        </Container>
      </Section>

      <Section background="cream">
        <Container>
          <h2 className="font-heading text-3xl sm:text-4xl text-quizzer-black mb-10 text-center">
            How venues work with us
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-4xl mx-auto">
            <div className="text-center">
              <div className="font-heading text-4xl text-quizzer-black mb-2">1</div>
              <h3 className="font-semibold text-quizzer-black mb-2">Get in touch</h3>
              <p className="text-quizzer-black/80 text-sm">Tell us about your venue and the kind of night you want to run.</p>
            </div>
            <div className="text-center">
              <div className="font-heading text-4xl text-quizzer-black mb-2">2</div>
              <h3 className="font-semibold text-quizzer-black mb-2">We send a host</h3>
              <p className="text-quizzer-black/80 text-sm">A trained Quizzer host turns up with everything: the quiz, the answer sheets, the energy.</p>
            </div>
            <div className="text-center">
              <div className="font-heading text-4xl text-quizzer-black mb-2">3</div>
              <h3 className="font-semibold text-quizzer-black mb-2">Your venue fills up</h3>
              <p className="text-quizzer-black/80 text-sm">Listed on the Quizzer app, found by players, packed out by 8pm.</p>
            </div>
          </div>
        </Container>
      </Section>

      <Section background="white">
        <Container>
          <h2 className="font-heading text-3xl sm:text-4xl text-quizzer-black mb-6">
            {hostSectionTitle}
          </h2>
          <p className="text-quizzer-black/90 max-w-2xl mb-8">
            {hostSectionCopy}
          </p>
          <Button href="/host-a-quiz" variant="secondary">
            For Venues
          </Button>
        </Container>
      </Section>

      <Section background="cream">
        <Container>
          <h2 className="font-heading text-3xl sm:text-4xl text-quizzer-black mb-10">
            FAQ
          </h2>
          <Accordion>
            {faqPreview.map((item, i) => (
              <AccordionItem key={i} title={item.q}>
                {item.a}
              </AccordionItem>
            ))}
          </Accordion>
          <div className="mt-8">
            <Button href="/faq" variant="outline">
              See all FAQ
            </Button>
          </div>
        </Container>
      </Section>

      <Section background="black">
        <Container className="text-center">
          <h2 className="font-heading text-3xl sm:text-4xl text-quizzer-white mb-4">
            {finalCtaTitle}
          </h2>
          <p className="text-quizzer-white/80 mb-8 max-w-xl mx-auto">
            {finalCtaCopy}
          </p>
          <div className="flex flex-wrap gap-4 justify-center">
            <Button href="/find-a-quiz" variant="primary" size="lg">
              Find a Quiz
            </Button>
            <Button href="/host-a-quiz" variant="secondary" size="lg">
              For Venues
            </Button>
          </div>
        </Container>
      </Section>
    </>
  );
}
