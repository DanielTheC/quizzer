import type { Metadata } from "next";
import Link from "next/link";
import { Container } from "@/components/ui/Container";
import { PageHero } from "@/components/ui/PageHero";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description:
    "Quizzer privacy policy for the website and app: what we collect, why, your rights, and how to contact us.",
  alternates: {
    canonical: "/privacy-policy",
  },
};

export default function PrivacyPolicyPage() {
  return (
    <>
      <PageHero
        title="Privacy Policy"
        description="How Quizzer collects and uses personal data when you use our website (quizzerapp.co.uk) and mobile app. Last updated: April 2026."
        background="white"
      />
      <section className="py-16 bg-quizzer-white">
        <Container>
          <div className="max-w-2xl space-y-10 text-quizzer-black/90 text-base leading-relaxed">
            <div className="space-y-4">
              <h2 className="font-heading text-2xl text-quizzer-black">
                1. Who we are
              </h2>
              <p>
                Quizzer (&quot;we&quot;, &quot;us&quot;) is the data controller for
                personal data processed in connection with the Quizzer website and
                the Quizzer mobile application (together, the
                &quot;Services&quot;).
              </p>
              <p>
                For data protection questions, use our{" "}
                <Link href="/contact-us" className="text-quizzer-blue underline">
                  Contact Us
                </Link>{" "}
                page. Our{" "}
                <Link
                  href="/terms-and-conditions"
                  className="text-quizzer-blue underline"
                >
                  Terms and Conditions
                </Link>{" "}
                govern use of the Services.
              </p>
            </div>

            <div className="space-y-4">
              <h2 className="font-heading text-2xl text-quizzer-black">
                2. What this policy covers
              </h2>
              <p>
                This policy describes the types of personal data we may collect,
                how and why we use it, who we share it with, and the rights you
                may have under applicable law (including UK data protection law).
              </p>
            </div>

            <div className="space-y-4">
              <h2 className="font-heading text-2xl text-quizzer-black">
                3. Information we collect
              </h2>
              <p>
                Depending on how you use the Services, we may process the
                following categories of information:
              </p>
              <ul className="list-disc pl-6 space-y-2">
                <li>
                  <strong>Account and authentication.</strong> If you sign in, we
                  process identifiers such as email address and account IDs from
                  our authentication provider, plus any profile details you
                  provide.
                </li>
                <li>
                  <strong>App usage and preferences.</strong> For example,
                  quizzes you save, navigation in the app, and settings such as
                  notification preferences.
                </li>
                <li>
                  <strong>Location.</strong> If you allow it, we may process
                  approximate or precise device location to show distance to venues
                  or filter “nearby” quizzes. You can turn this off in your device
                  settings at any time.
                </li>
                <li>
                  <strong>Device and technical data.</strong> Such as device
                  type, operating system, app version, and diagnostic logs needed
                  to operate and secure the Services.
                </li>
                <li>
                  <strong>Communications.</strong> If you contact us, we keep the
                  correspondence and details you provide.
                </li>
                <li>
                  <strong>Website and cookies.</strong> Our site may use cookies
                  or similar technologies for essential functionality, analytics,
                  or marketing where permitted and according to your choices and
                  applicable law.
                </li>
              </ul>
            </div>

            <div className="space-y-4">
              <h2 className="font-heading text-2xl text-quizzer-black">
                4. How we use your information
              </h2>
              <p>We use personal data to:</p>
              <ul className="list-disc pl-6 space-y-2">
                <li>provide and maintain the Services (including sign-in);</li>
                <li>
                  show relevant quiz listings (including when you use location
                  features);
                </li>
                <li>
                  send optional reminders or updates if you enable notifications;
                </li>
                <li>
                  support hosts and venues who use our tools, where that
                  processing relates to the Services;
                </li>
                <li>
                  improve, secure, and troubleshoot the Services, and detect abuse;
                </li>
                <li>
                  comply with law, respond to lawful requests, and enforce our
                  terms.
                </li>
              </ul>
              <p>
                Where UK GDPR applies, we rely on appropriate legal bases such
                as: performance of a contract with you, legitimate interests
                (for example securing our services and improving the product,
                balanced against your rights), and consent where required (for
                example certain notifications or non-essential cookies).
              </p>
            </div>

            <div className="space-y-4">
              <h2 className="font-heading text-2xl text-quizzer-black">
                5. Notifications
              </h2>
              <p>
                If you opt in to push notifications in the app, we process data
                needed to deliver those messages (for example device push tokens).
                You can withdraw consent at any time via the app or device
                settings.
              </p>
            </div>

            <div className="space-y-4">
              <h2 className="font-heading text-2xl text-quizzer-black">
                6. Who we share data with
              </h2>
              <p>We may share personal data with:</p>
              <ul className="list-disc pl-6 space-y-2">
                <li>
                  <strong>Service providers</strong> that help us run the Services
                  (for example cloud hosting, authentication, databases, analytics,
                  maps, or customer support), under contractual terms that
                  require protection of your data;
                </li>
                <li>
                  <strong>Professional advisers</strong> where required (e.g.
                  lawyers or accountants);
                </li>
                <li>
                  <strong>Authorities</strong> when we believe disclosure is
                  required by law or to protect rights, safety, or security.
                </li>
              </ul>
              <p>We do not sell your personal data.</p>
            </div>

            <div className="space-y-4">
              <h2 className="font-heading text-2xl text-quizzer-black">
                7. International transfers
              </h2>
              <p>
                Some providers may process data outside the UK. Where we do, we
                take steps intended to ensure appropriate safeguards (such as
                standard contractual clauses or adequacy decisions) where
                required by law.
              </p>
            </div>

            <div className="space-y-4">
              <h2 className="font-heading text-2xl text-quizzer-black">
                8. How long we keep data
              </h2>
              <p>
                We retain personal data only as long as needed for the purposes
                above, including legal, accounting, or reporting requirements.
                Retention periods vary by data type; for example account data may
                be kept until you delete your account or we delete inactive
                records according to our internal policies.
              </p>
            </div>

            <div className="space-y-4">
              <h2 className="font-heading text-2xl text-quizzer-black">
                9. Security
              </h2>
              <p>
                We implement appropriate technical and organisational measures to
                protect personal data. No method of transmission or storage is
                perfectly secure; we cannot guarantee absolute security.
              </p>
            </div>

            <div className="space-y-4">
              <h2 className="font-heading text-2xl text-quizzer-black">
                10. Your rights
              </h2>
              <p>
                Depending on where you live, you may have rights to access,
                correct, delete, or restrict processing of your personal data, to
                object to certain processing, to data portability, and to
                withdraw consent where processing is based on consent. You may
                also have the right to lodge a complaint with a supervisory
                authority (in the UK, the ICO).
              </p>
              <p>
                To exercise your rights, contact us via{" "}
                <Link href="/contact-us" className="text-quizzer-blue underline">
                  Contact Us
                </Link>
                . We may need to verify your identity before responding.
              </p>
            </div>

            <div className="space-y-4">
              <h2 className="font-heading text-2xl text-quizzer-black">
                11. Children
              </h2>
              <p>
                The Services are not directed at children under 13 (or the age of
                digital consent in your region). We do not knowingly collect
                personal data from children. If you believe we have, please
                contact us and we will take appropriate steps.
              </p>
            </div>

            <div className="space-y-4">
              <h2 className="font-heading text-2xl text-quizzer-black">
                12. Changes
              </h2>
              <p>
                We may update this policy from time to time. We will post the
                updated version on this page and adjust the “Last updated” date
                where appropriate. Please review this policy periodically.
              </p>
            </div>
          </div>
        </Container>
      </section>
    </>
  );
}
