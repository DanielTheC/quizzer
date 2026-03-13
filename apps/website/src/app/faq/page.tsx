import type { Metadata } from "next";
import Link from "next/link";
import { Container } from "@/components/ui/Container";
import { PageHero } from "@/components/ui/PageHero";
import { Accordion, AccordionItem } from "@/components/ui/Accordion";
import { getAllFaqs, getSiteSettings } from "@/sanity/lib/fetch";
import { buildPageMetadata } from "@/sanity/lib/metadata";

const DEFAULT_FAQS = [
  {
    q: "How do I find a pub quiz near me?",
    a: "Use the Quizzer app or this website to browse quizzes by city. In the app you can filter by distance, day, and more so you see what's on near you.",
  },
  {
    q: "Is the Quizzer app free?",
    a: "Yes. Players can find and play quizzes for free. Some venues charge a small entry fee for the quiz itself.",
  },
  {
    q: "How do venues host a quiz with Quizzer?",
    a: "Venues can sign up to list their quiz and use our tools to run rounds and leaderboards. Visit the Host a Quiz page and get in touch.",
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

export async function generateMetadata(): Promise<Metadata> {
  const siteSettings = await getSiteSettings();
  return buildPageMetadata({
    title: "FAQ",
    description:
      "Frequently asked questions about finding pub quizzes, using the Quizzer app, and hosting quiz nights.",
    siteSettings,
  });
}

export default async function FAQPage() {
  const faqsFromSanity = await getAllFaqs();
  const faqs =
    faqsFromSanity && faqsFromSanity.length > 0
      ? faqsFromSanity.map((f) => ({ q: f.question ?? "", a: f.answer ?? "" }))
      : DEFAULT_FAQS;

  return (
    <>
      <PageHero
        title="FAQ"
        description="Answers to common questions about finding and playing pub quizzes, and hosting with Quizzer."
        background="yellow"
      />
      <section className="py-16 bg-quizzer-white">
        <Container>
          <Accordion>
            {faqs.map((item, i) => (
              <AccordionItem key={i} title={item.q}>
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
