import type { Metadata } from "next";
import { Container } from "@/components/ui/Container";
import { PageHero } from "@/components/ui/PageHero";

export const metadata: Metadata = {
  title: "Terms and Conditions",
  description: "Quizzer terms of use. Rules for using our website and app.",
};

export default function TermsAndConditionsPage() {
  return (
    <>
      <PageHero
        title="Terms and Conditions"
        description="Last updated: March 2025. Terms of use for Quizzer."
        background="white"
      />
      <section className="py-16 bg-quizzer-white">
        <Container>
          <div className="max-w-2xl space-y-6 text-quizzer-black/90">
            <h2 className="font-heading text-2xl text-quizzer-black">
              Acceptance
            </h2>
            <p>
              By using the Quizzer website or app you agree to these terms. If
              you do not agree, please do not use our services.
            </p>
            <h2 className="font-heading text-2xl text-quizzer-black">
              Use of the service
            </h2>
            <p>
              You may use Quizzer to find and play pub quizzes and (if a venue)
              to list and run quiz nights. You must not use the service for
              anything illegal or to harass others. We reserve the right to
              suspend or remove access if terms are breached.
            </p>
            <h2 className="font-heading text-2xl text-quizzer-black">
              Content and listings
            </h2>
            <p>
              Quiz and venue information is provided by venues and third
              parties. We do not guarantee accuracy. Use of any venue or quiz is
              at your own risk.
            </p>
            <h2 className="font-heading text-2xl text-quizzer-black">
              Contact
            </h2>
            <p>
              For questions about these terms, see our{" "}
              <a href="/contact-us" className="text-quizzer-blue underline">
                Contact Us
              </a>{" "}
              page.
            </p>
          </div>
        </Container>
      </section>
    </>
  );
}
