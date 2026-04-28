import type { Metadata } from "next";
import { Container } from "@/components/ui/Container";
import { PageHero } from "@/components/ui/PageHero";
import { Section } from "@/components/ui/Section";

export const metadata: Metadata = {
  title: "About Us",
  description:
    "Quizzer runs pub quiz nights for venues across the UK. Trained hosts, fresh quizzes, paper answer sheets, and an app that helps players discover their next great quiz night.",
  alternates: {
    canonical: "/about-us",
  },
};

export default function AboutUsPage() {
  return (
    <>
      <PageHero
        title="About Quizzer"
        description="We run proper pub quiz nights — paper, pens, a great host, a room full of people. Across London and beyond."
        background="yellow"
      />
      <Section background="white">
        <Container>
          <h2 className="font-heading text-3xl text-quizzer-black mb-6">
            Our story
          </h2>
          <p className="text-quizzer-black/90 max-w-2xl mb-6">
            Quizzer started from a simple problem: most pub quizzes are forgettable.
            The questions feel recycled, the host is reading off a clipboard, and the
            whole night fizzles by 9:30. We thought venues — and their punters —
            deserved better.
          </p>
          <p className="text-quizzer-black/90 max-w-2xl">
            So we built Quizzer: a hosting service that brings entertaining quizzes,
            properly trained hosts, and high-quality colour answer sheets to pubs
            across the UK. The app helps players find their next great quiz night —
            and then they put it away for the duration. Phones down, pints up.
          </p>
        </Container>
      </Section>
      <Section background="white">
        <Container>
          <h2 className="font-heading text-3xl text-quizzer-black mb-6">
            What we do
          </h2>
          <p className="text-quizzer-black/90 max-w-2xl mb-8">
            Four things, all under one roof:
          </p>
          <ol className="space-y-6 max-w-2xl list-none">
            <li>
              <h3 className="font-semibold text-quizzer-black">1. The hosts.</h3>
              <p className="text-quizzer-black/90">
                We hire and train Quizzer hosts who actually want to be there
                — not bored students reading from a sheet. They run the night,
                work the room, and bring the energy.
              </p>
            </li>
            <li>
              <h3 className="font-semibold text-quizzer-black">2. The quizzes.</h3>
              <p className="text-quizzer-black/90">
                Our team writes fresh rounds every week. No recycled questions,
                no obvious googles, no awkward silences. Tailored to a pub crowd
                and printed on high-quality colour answer sheets.
              </p>
            </li>
            <li>
              <h3 className="font-semibold text-quizzer-black">3. The discovery.</h3>
              <p className="text-quizzer-black/90">
                Every Quizzer night is listed on the Quizzer app, so thousands
                of players in your city know where to find you. Built-in
                marketing for your venue.
              </p>
            </li>
            <li>
              <h3 className="font-semibold text-quizzer-black">4. The right kind of pub quiz.</h3>
              <p className="text-quizzer-black/90">
                No app gimmicks during the round, no cheating from screens under
                the table, no team staring at six different phones. Pen, paper,
                and proper conversation. The way it should be.
              </p>
            </li>
          </ol>
        </Container>
      </Section>
      <Section background="cream">
        <Container>
          <h2 className="font-heading text-3xl text-quizzer-black mb-6">
            Get in touch
          </h2>
          <p className="text-quizzer-black/90 max-w-xl">
            Questions or feedback? Head to our{" "}
            <a href="/contact-us" className="text-quizzer-blue underline">
              contact page
            </a>{" "}
            or email us.
          </p>
        </Container>
      </Section>
    </>
  );
}
