import type { Metadata } from "next";
import Link from "next/link";
import { Container } from "@/components/ui/Container";
import { PageHero } from "@/components/ui/PageHero";
import { Accordion, AccordionItem } from "@/components/ui/Accordion";
import { getAllFaqs, getSiteSettings } from "@/sanity/lib/fetch";
import { buildPageMetadata } from "@/sanity/lib/metadata";
import type { FaqDocument } from "@/sanity/lib/types";

const DEFAULT_PLAYER_FAQS = [
  {
    q: "How do I find a pub quiz near me?",
    a: "Use the Quizzer app or this website to browse quizzes by city. In the app you can filter by distance, day, and more so you see what's on near you.",
  },
  {
    q: "Is the Quizzer app free?",
    a: "Yes. Players can find and play quizzes for free. Some venues charge a small entry fee for the quiz itself.",
  },
  {
    q: "Do I need to use the app to play the quiz?",
    a: "No — quite the opposite. The Quizzer app is for finding quizzes and getting reminders. The quiz itself is the proper old-school version: high-quality colour answer sheets, your team huddled around a table, phones away. Just turn up and grab a sheet.",
  },
  {
    q: "Which cities do you cover?",
    a: "We're live in London, Birmingham, Manchester, Glasgow, and Edinburgh, and adding more. Use the app or Find a Quiz to see what's listed.",
  },
  {
    q: "Can I save my favourite quizzes?",
    a: "Yes. In the app you can save venues and get reminders so you never miss your regular quiz night.",
  },
];

const DEFAULT_VENUE_FAQS = [
  {
    q: "How does the venue hosting service work?",
    a: "We send a trained Quizzer host to your venue who runs the whole night — the quiz, the rounds, the answer sheets, the leaderboard. Your venue gets listed on the Quizzer app for free promotion. Get in touch via our For Venues page.",
  },
  {
    q: "What's included in Quizzer's hosting service?",
    a: "A trained host who runs the night, the quiz itself (written fresh by our team), high-quality colour answer sheets, and a free listing on the Quizzer app so players can find you.",
  },
  {
    q: "How much does it cost for venues?",
    a: "It depends on the size of your venue and whether you want a regular weekly slot or one-off events. Get in touch and we'll send a quote within two working days.",
  },
  {
    q: "Do you do one-off quizzes — birthdays, fundraisers, work events?",
    a: "Yes. Whether it's a private party, a charity night, or a Christmas event, we can put on a one-off quiz tailored to your group.",
  },
  {
    q: "Where in the UK do you operate?",
    a: "We're currently live in London, Birmingham, Manchester, Glasgow, and Edinburgh. If you're outside these cities, get in touch — we add new areas based on demand.",
  },
];

function mapFaqDocs(docs: FaqDocument[]): { q: string; a: string }[] {
  return docs.map((f) => ({
    q: f.question ?? "",
    a: f.answer ?? "",
  }));
}

export async function generateMetadata(): Promise<Metadata> {
  const siteSettings = await getSiteSettings();
  const base = buildPageMetadata({
    title: "FAQ",
    description:
      "Frequently asked questions about finding pub quizzes, using the Quizzer app, and hosting quiz nights.",
    siteSettings,
  });

  return {
    ...base,
    alternates: {
      ...(base.alternates ?? {}),
      canonical: "/faq",
    },
  };
}

export default async function FAQPage() {
  const faqsFromSanity = await getAllFaqs();
  const all = faqsFromSanity ?? [];

  const playerFromSanity = all.filter((f) => f.category === "players");
  const venueFromSanity = all.filter((f) => f.category === "hosts");

  const playerFaqs =
    playerFromSanity.length > 0 ? mapFaqDocs(playerFromSanity) : DEFAULT_PLAYER_FAQS;
  const venueFaqs =
    venueFromSanity.length > 0 ? mapFaqDocs(venueFromSanity) : DEFAULT_VENUE_FAQS;

  return (
    <>
      <PageHero
        title="FAQ"
        description="Answers to common questions about finding and playing pub quizzes, and hosting with Quizzer."
        background="yellow"
      />
      <section className="py-16 bg-quizzer-white">
        <Container>
          <h2 className="font-heading text-2xl text-quizzer-black mb-6">For players</h2>
          <Accordion>
            {playerFaqs.map((item, i) => (
              <AccordionItem key={i} title={item.q}>
                {item.a}
              </AccordionItem>
            ))}
          </Accordion>

          <h2 className="font-heading text-2xl text-quizzer-black mt-12 mb-6">For venues</h2>
          <Accordion>
            {venueFaqs.map((item, i) => (
              <AccordionItem key={`v-${i}`} title={item.q}>
                {item.a}
              </AccordionItem>
            ))}
          </Accordion>

          <p className="mt-8 text-quizzer-black/80">
            Still stuck?{" "}
            <Link href="/contact-us" className="text-quizzer-blue underline">
              Contact us
            </Link>
            .
          </p>
        </Container>
      </section>
    </>
  );
}
