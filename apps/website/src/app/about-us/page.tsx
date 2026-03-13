import type { Metadata } from "next";
import { Container } from "@/components/ui/Container";
import { PageHero } from "@/components/ui/PageHero";
import { Section } from "@/components/ui/Section";

export const metadata: Metadata = {
  title: "About Us",
  description:
    "Quizzer helps people find pub quizzes and venues run smarter quiz nights. Learn more about us.",
};

export default function AboutUsPage() {
  return (
    <>
      <PageHero
        title="About Quizzer"
        description="We’re on a mission to make every quiz night easy to find and fun to play."
        background="yellow"
      />
      <Section background="white">
        <Container>
          <h2 className="font-heading text-3xl text-quizzer-black mb-6">
            Our story
          </h2>
          <p className="text-quizzer-black/90 max-w-2xl mb-6">
            Quizzer started from a simple problem: finding a good pub quiz was
            harder than it should be. We built an app so players can discover
            quiz nights near them and venues can list and run quizzes without the
            fuss.
          </p>
          <p className="text-quizzer-black/90 max-w-2xl">
            Today we help thousands of teams find their next quiz and hundreds of
            pubs run nights that pull in the crowds. Whether you’re a player or
            a host, we’re here to make quiz night better.
          </p>
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
