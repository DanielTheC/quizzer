import type { Metadata } from "next";
import Link from "next/link";
import { Container } from "@/components/ui/Container";
import { PageHero } from "@/components/ui/PageHero";

export const metadata: Metadata = {
  title: "Terms and Conditions",
  description:
    "Quizzer terms of use for the website and mobile app: accounts, acceptable use, location, hosts, and liability.",
  alternates: {
    canonical: "/terms-and-conditions",
  },
};

export default function TermsAndConditionsPage() {
  return (
    <>
      <PageHero
        title="Terms and Conditions"
        description="These terms apply to the Quizzer website (quizzerapp.co.uk) and the Quizzer mobile app. Last updated: April 2026."
        background="white"
      />
      <section className="py-16 bg-quizzer-white">
        <Container>
          <div className="max-w-2xl space-y-10 text-quizzer-black/90 text-base leading-relaxed">
            <div className="space-y-4">
              <h2 className="font-heading text-2xl text-quizzer-black">
                1. Agreement
              </h2>
              <p>
                Quizzer (&quot;we&quot;, &quot;us&quot;) provides the Quizzer
                website and the Quizzer mobile application (together, the
                &quot;Services&quot;). By accessing or using the Services you
                agree to these Terms and Conditions. If you do not agree, you
                must not use the Services.
              </p>
              <p>
                Our{" "}
                <Link href="/privacy-policy" className="text-quizzer-blue underline">
                  Privacy Policy
                </Link>{" "}
                explains how we handle personal data when you use the Services.
              </p>
            </div>

            <div className="space-y-4">
              <h2 className="font-heading text-2xl text-quizzer-black">
                2. Accounts and the app
              </h2>
              <p>
                Some features require you to create or sign in to an account
                (for example using email or a third-party sign-in provider). You
                must provide accurate information and keep your login details
                secure. You are responsible for activity that occurs under your
                account.
              </p>
              <p>
                We may change, suspend, or discontinue parts of the app or
                website, or restrict access, for maintenance, security, legal, or
                operational reasons.
              </p>
            </div>

            <div className="space-y-4">
              <h2 className="font-heading text-2xl text-quizzer-black">
                3. Using Quizzer to find and play quizzes
              </h2>
              <p>
                The app helps you discover pub quizzes, view venue and event
                details (including where provided), save quizzes, and receive
                reminders where you enable them. Quiz times, fees, prizes, and
                venue rules are set by venues and others: we do not run those
                events ourselves and we do not guarantee that listings are
                complete, current, or error-free.
              </p>
              <p>
                If you choose to share your location, we use it to show
                distance-based or nearby results as described in our Privacy
                Policy. You can control location permissions in your device
                settings.
              </p>
            </div>

            <div className="space-y-4">
              <h2 className="font-heading text-2xl text-quizzer-black">
                4. Host tools and venue content
              </h2>
              <p>
                Host-facing tools are for authorised quiz hosts and venue
                operators. Access to host-specific materials (such as answer
                content used to run a quiz) may be limited to approved accounts.
                You must not attempt to circumvent those restrictions or use
                host materials except when running or supporting an authorised
                event.
              </p>
              <p>
                Information you submit about venues or events must be lawful and
                must not infringe anyone else&apos;s rights.
              </p>
            </div>

            <div className="space-y-4">
              <h2 className="font-heading text-2xl text-quizzer-black">
                5. Acceptable use
              </h2>
              <p>You agree that you will not:</p>
              <ul className="list-disc pl-6 space-y-2">
                <li>
                  use the Services for anything unlawful, harmful, fraudulent,
                  or to harass, abuse, or discriminate against others;
                </li>
                <li>
                  scrape, data-mine, or overload our systems, or reverse
                  engineer the app except where the law allows;
                </li>
                <li>
                  misrepresent your identity or affiliation, or attempt to
                  access data or accounts without permission.
                </li>
              </ul>
              <p>
                We may suspend or terminate access if we reasonably believe
                these terms have been breached.
              </p>
            </div>

            <div className="space-y-4">
              <h2 className="font-heading text-2xl text-quizzer-black">
                6. Intellectual property
              </h2>
              <p>
                The Services, branding, and underlying software are owned by
                Quizzer or our licensors. You receive a limited, revocable
                licence to use the app and website for personal, non-commercial
                use in line with these terms, unless we agree otherwise in
                writing.
              </p>
            </div>

            <div className="space-y-4">
              <h2 className="font-heading text-2xl text-quizzer-black">
                7. Third-party services
              </h2>
              <p>
                The Services may include links, maps, authentication
                providers, or other features operated by third parties. Their
                terms and privacy practices apply to your use of those services.
              </p>
            </div>

            <div className="space-y-4">
              <h2 className="font-heading text-2xl text-quizzer-black">
                8. Disclaimers
              </h2>
              <p>
                The Services are provided &quot;as is&quot;. To the fullest
                extent permitted by law, we disclaim warranties of any kind,
                including as to availability, accuracy of listings, fitness for
                a particular purpose, or that the Services will be uninterrupted
                or error-free. Attending venues or events is at your own risk.
              </p>
            </div>

            <div className="space-y-4">
              <h2 className="font-heading text-2xl text-quizzer-black">
                9. Limitation of liability
              </h2>
              <p>
                Nothing in these terms excludes or limits liability that cannot
                be excluded under applicable law. Subject to that, we are not
                liable for any indirect, consequential, or special losses, or
                for loss of data, profit, or business, arising from your use of
                the Services or reliance on any listing or content.
              </p>
            </div>

            <div className="space-y-4">
              <h2 className="font-heading text-2xl text-quizzer-black">
                10. Changes
              </h2>
              <p>
                We may update these terms from time to time. The &quot;Last
                updated&quot; date at the top will change when we do. Continued
                use of the Services after changes take effect constitutes
                acceptance of the revised terms, where the law allows.
              </p>
            </div>

            <div className="space-y-4">
              <h2 className="font-heading text-2xl text-quizzer-black">
                11. Contact
              </h2>
              <p>
                For questions about these terms, please use our{" "}
                <Link href="/contact-us" className="text-quizzer-blue underline">
                  Contact Us
                </Link>{" "}
                page.
              </p>
            </div>
          </div>
        </Container>
      </section>
    </>
  );
}
