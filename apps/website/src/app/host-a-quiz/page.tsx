import type { Metadata } from "next";
import { HostQuizForm } from "@/components/sections/HostQuizForm";
import { Button } from "@/components/ui/Button";
import { Container } from "@/components/ui/Container";
import { PageHero } from "@/components/ui/PageHero";
import { FeatureCard } from "@/components/ui/FeatureCard";
import { Accordion, AccordionItem } from "@/components/ui/Accordion";
import { getHostPage, getSiteSettings, getAllFaqs } from "@/sanity/lib/fetch";
import { buildPageMetadata } from "@/sanity/lib/metadata";

const DEFAULT_HERO_TITLE = "Host a Quiz at Your Venue";
const DEFAULT_HERO_INTRO =
  "Pull in more punters and run quiz nights the easy way. List your quiz, manage rounds on the app, and let players join on their phones.";
const DEFAULT_BENEFITS = [
  {
    title: "Increase footfall",
    body: 'Get your quiz in front of players searching for "pub quiz near me". More visibility, more teams through the door.',
    accent: "yellow",
  },
  {
    title: "Simplify hosting",
    body: "Run rounds and leaderboards through the app. Less admin, more time for your customers.",
    accent: "cream",
  },
  {
    title: "Engage customers",
    body: "Players answer on their phones and see live scores. Keeps the room engaged and coming back.",
    accent: "green",
  },
];
const DEFAULT_FAQ_INTRO = "FAQ for hosts";
const DEFAULT_HOST_FAQS = [
  {
    q: "How much does it cost to list our quiz?",
    a: "We offer different options for venues. Get in touch and we'll outline what works for your size and frequency.",
  },
  {
    q: "Do we need special equipment?",
    a: "Players use their own phones. You can run the quiz from a tablet or laptop. We'll guide you through setup.",
  },
  {
    q: "Can we keep our existing quiz format?",
    a: "Yes. You keep your questions and style. We help with listing, reminders, and optional in-app play and leaderboards.",
  },
];
const DEFAULT_CONTACT_TITLE = "Get in touch";
const DEFAULT_CONTACT_COPY =
  "Tell us about your venue and quiz night. We'll get back to you with next steps.";
const DEFAULT_CTA_TITLE = "Want to play instead?";

export async function generateMetadata(): Promise<Metadata> {
  const [hostPage, siteSettings] = await Promise.all([
    getHostPage(),
    getSiteSettings(),
  ]);
  return buildPageMetadata({
    title: hostPage?.seoTitle,
    description: hostPage?.seoDescription,
    siteSettings,
    fallbackTitle: "Host a Quiz – For Venues",
    fallbackDescription:
      "Run quiz nights at your venue with Quizzer. Increase footfall, simplify hosting, and engage customers. Get in touch.",
  });
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
            Why venues use Quizzer
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
