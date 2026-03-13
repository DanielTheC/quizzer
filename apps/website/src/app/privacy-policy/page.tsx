import type { Metadata } from "next";
import { Container } from "@/components/ui/Container";
import { PageHero } from "@/components/ui/PageHero";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "Quizzer privacy policy. How we collect, use, and protect your data.",
};

export default function PrivacyPolicyPage() {
  return (
    <>
      <PageHero
        title="Privacy Policy"
        description="Last updated: March 2025. How we handle your information."
        background="white"
      />
      <section className="py-16 bg-quizzer-white">
        <Container>
          <div className="max-w-2xl prose prose-quizzer-black space-y-6 text-quizzer-black/90">
            <h2 className="font-heading text-2xl text-quizzer-black">
              Overview
            </h2>
            <p>
              Quizzer (&quot;we&quot;) respects your privacy. This policy
              describes what data we collect when you use our website and app,
              and how we use it.
            </p>
            <h2 className="font-heading text-2xl text-quizzer-black">
              Data we collect
            </h2>
            <p>
              When you use our services we may collect: account information (e.g.
              email if you sign up), usage data (e.g. which quizzes you view),
              and device/location data where needed to show quizzes near you.
            </p>
            <h2 className="font-heading text-2xl text-quizzer-black">
              How we use it
            </h2>
            <p>
              We use this data to provide and improve our service, personalise
              content (e.g. nearby quizzes), and communicate with you. We do not
              sell your personal data to third parties.
            </p>
            <h2 className="font-heading text-2xl text-quizzer-black">
              Contact
            </h2>
            <p>
              For privacy-related questions, contact us at{" "}
              <a href="/contact-us" className="text-quizzer-blue underline">
                Contact Us
              </a>
              .
            </p>
          </div>
        </Container>
      </section>
    </>
  );
}
