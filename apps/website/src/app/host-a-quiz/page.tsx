import type { Metadata } from "next";
import { HostQuizForm } from "@/components/sections/HostQuizForm";
import { Button } from "@/components/ui/Button";
import { Container } from "@/components/ui/Container";
import { PageHero } from "@/components/ui/PageHero";
import { FeatureCard } from "@/components/ui/FeatureCard";
import { Accordion, AccordionItem } from "@/components/ui/Accordion";
import { getHostPage, getSiteSettings, getAllFaqs } from "@/sanity/lib/fetch";
import { buildPageMetadata } from "@/sanity/lib/metadata";

const DEFAULT_HERO_TITLE = "Pub Quiz Nights, Hosted End-to-End";
const DEFAULT_HERO_INTRO =
  "We bring the host, the questions, and the players. You bring the room. Quizzer is a fully-managed pub quiz service — from booking the night to filling the seats.";
const DEFAULT_BENEFITS = [
  {
    title: "We bring the players",
    body: "Every quiz at your venue is listed on the Quizzer app — where thousands of players search for their next pub quiz night. Built-in marketing, no posters needed.",
    accent: "yellow",
  },
  {
    title: "Hands-off hosting",
    body: "A trained Quizzer host arrives ahead of the night and runs the whole show. You don't lift a finger — your team focus on the bar and the kitchen.",
    accent: "cream",
  },
  {
    title: "Quizzes that don't bore the room",
    body: "We write fresh, entertaining rounds tailored to a pub crowd. Players answer on high-quality colour sheets — phones away, eyes up — and our host reports scores live so the leaderboard tension stays real.",
    accent: "green",
  },
];
const DEFAULT_FAQ_INTRO = "FAQ for hosts";
const DEFAULT_HOST_FAQS = [
  {
    q: "How does pricing work?",
    a: "Pricing depends on whether you want a one-off quiz, a weekly slot, or something in between, and on the size of your venue. Get in touch and we'll send a quote within two working days.",
  },
  {
    q: "What do we need to provide?",
    a: "A space for around 8-15 teams, a working PA system or somewhere our host can be heard, and decent mobile signal so our host can report scores live. Our host brings the answer sheets, pens, and everything else.",
  },
  {
    q: "Can you tailor the quiz to our crowd?",
    a: "Yes — we'll chat about your regulars, your area, and the vibe you want before your first night. Whether your crowd is sport-mad, music-obsessed, or just wants the classics, we'll write to suit.",
  },
];
const DEFAULT_CONTACT_TITLE = "Tell us about your venue";
const DEFAULT_CONTACT_COPY =
  "A few quick details and we'll come back to you within two working days with next steps.";
const DEFAULT_CTA_TITLE = "Want to play instead?";

export async function generateMetadata(): Promise<Metadata> {
  const [hostPage, siteSettings] = await Promise.all([
    getHostPage(),
    getSiteSettings(),
  ]);
  const base = buildPageMetadata({
    title: hostPage?.seoTitle,
    description: hostPage?.seoDescription,
    siteSettings,
    fallbackTitle: "Pub Quiz Nights for Your Venue – Quizzer",
    fallbackDescription:
      "Quizzer runs pub quiz nights at venues across the UK. We provide the host, write the quiz, supply the answer sheets, and list your venue on the Quizzer app for built-in player discovery.",
  });

  return {
    ...base,
    alternates: {
      ...(base.alternates ?? {}),
      canonical: "/host-a-quiz",
    },
  };
}

function accentMap(accent?: string | null): "yellow" | "cream" | "green" {
  if (accent === "cream" || accent === "green") return accent;
  return "yellow";
}

export default async function HostAQuizPage() {
  const [hostPage, faqsFromSanity] = await Promise.all([
    getHostPage(),
    getAllFaqs(),
  ]);

  const heroTitle = hostPage?.heroTitle?.trim() || DEFAULT_HERO_TITLE;
  const heroIntro = hostPage?.heroIntro?.trim() || DEFAULT_HERO_INTRO;
  const benefits =
    hostPage?.benefits?.length ? hostPage.benefits : DEFAULT_BENEFITS;
  const faqIntro = hostPage?.faqIntro?.trim() || DEFAULT_FAQ_INTRO;
  const ctaTitle = hostPage?.ctaTitle?.trim() || DEFAULT_CTA_TITLE;
  const ctaCopy = hostPage?.ctaCopy?.trim() || "Find a Quiz";
  const contactTitle =
    hostPage?.contactSectionTitle?.trim() || DEFAULT_CONTACT_TITLE;
  const contactCopy =
    hostPage?.contactSectionCopy?.trim() || DEFAULT_CONTACT_COPY;

  const hostFaqs =
    faqsFromSanity?.filter((f) => f.category === "hosts") ?? [];
  const faqItems =
    hostFaqs.length > 0
      ? hostFaqs.map((f) => ({ q: f.question ?? "", a: f.answer ?? "" }))
      : DEFAULT_HOST_FAQS;

  return (
    <>
      <PageHero title={heroTitle} description={heroIntro} background="yellow">
        <Button href="#contact" size="lg">
          Get in touch
        </Button>
      </PageHero>

      <section className="py-16 bg-quizzer-white">
        <Container>
          <h2 className="font-heading text-3xl text-quizzer-black mb-8">
            Why venues choose Quizzer
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {benefits.map((b, i) => (
              <FeatureCard
                key={i}
                title={b.title ?? ""}
                accent={accentMap(b.accent)}
              >
                {b.body ?? ""}
              </FeatureCard>
            ))}
          </div>
        </Container>
      </section>

      <section className="py-16 bg-quizzer-cream">
        <Container>
          <h2 className="font-heading text-3xl text-quizzer-black mb-10">
            {faqIntro}
          </h2>
          <Accordion>
            {faqItems.map((item, i) => (
              <AccordionItem key={i} title={item.q}>
                {item.a}
              </AccordionItem>
            ))}
          </Accordion>
        </Container>
      </section>

      <section id="contact" className="py-16 bg-quizzer-white">
        <Container>
          <h2 className="font-heading text-3xl text-quizzer-black mb-6">
            {contactTitle}
          </h2>
          <p className="text-quizzer-black/80 mb-8 max-w-xl">
            {contactCopy}
          </p>
          <div className="mb-10 rounded-[var(--radius-card)] border-[3px] border-quizzer-black border-solid bg-quizzer-yellow/40 p-6 shadow-[var(--shadow-card)]">
            <h3 className="font-heading text-2xl text-quizzer-black mb-6">
              What happens next
            </h3>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <FeatureCard title="We review your enquiry" accent="white">
                Within 2 working days.
              </FeatureCard>
              <FeatureCard title="Quick call" accent="cream">
                We learn about your venue and quiz night.
              </FeatureCard>
              <FeatureCard title="Your first quiz night" accent="green">
                Our host arrives, runs the night, and your venue is live on the Quizzer app.
              </FeatureCard>
            </div>
          </div>
          <HostQuizForm />
        </Container>
      </section>

      <section className="py-16 bg-quizzer-black text-quizzer-white">
        <Container className="text-center">
          <h2 className="font-heading text-3xl text-quizzer-white mb-4">
            {ctaTitle}
          </h2>
          <Button href="/find-a-quiz" variant="primary" size="lg">
            {ctaCopy}
          </Button>
        </Container>
      </section>
    </>
  );
}
