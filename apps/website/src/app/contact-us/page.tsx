import type { Metadata } from "next";
import { Container } from "@/components/ui/Container";
import { PageHero } from "@/components/ui/PageHero";
import { getSiteSettings } from "@/sanity/lib/fetch";
import { buildPageMetadata } from "@/sanity/lib/metadata";

export async function generateMetadata(): Promise<Metadata> {
  const siteSettings = await getSiteSettings();
  return buildPageMetadata({
    title: "Contact Us",
    description:
      "Get in touch with Quizzer. Questions, feedback, or venue enquiries.",
    siteSettings,
  });
}

export default async function ContactUsPage() {
  const siteSettings = await getSiteSettings();
  const contactEmail =
    siteSettings?.contactEmail?.trim() || "hello@quizzer.app";

  return (
    <>
      <PageHero
        title="Contact Us"
        description="Have a question or want to list your quiz? We’d love to hear from you."
        background="yellow"
      />
      <section className="py-16 bg-quizzer-white">
        <Container>
          <div className="max-w-xl space-y-6">
            <div>
              <h2 className="font-heading text-xl text-quizzer-black mb-2">
                General enquiries
              </h2>
              <p className="text-quizzer-black/80">
                For players: check the{" "}
                <a href="/faq" className="text-quizzer-blue underline">
                  FAQ
                </a>
                . For anything else, email us at{" "}
                <a
                  href={`mailto:${contactEmail}`}
                  className="text-quizzer-blue underline"
                >
                  {contactEmail}
                </a>
                .
              </p>
            </div>
            <div>
              <h2 className="font-heading text-xl text-quizzer-black mb-2">
                Venues / Host a quiz
              </h2>
              <p className="text-quizzer-black/80">
                Use our{" "}
                <a href="/host-a-quiz#contact" className="text-quizzer-blue underline">
                  Host a Quiz form
                </a>{" "}
                to get in touch about listing your venue.
              </p>
            </div>
          </div>
        </Container>
      </section>
    </>
  );
}
