import Link from "next/link";
import { Container } from "@/components/ui/Container";
import type { SiteSettings } from "@/sanity/lib/types";

const footerLinks = {
  "Find & Play": [
    { href: "/find-a-quiz", label: "Find a Quiz" },
    { href: "/find-a-quiz/london", label: "London" },
    { href: "/find-a-quiz/manchester", label: "Manchester" },
  ],
  "For Venues": [
    { href: "/host-a-quiz", label: "Host a Quiz" },
    { href: "/contact-us", label: "Contact" },
  ],
  Legal: [
    { href: "/privacy-policy", label: "Privacy Policy" },
    { href: "/terms-and-conditions", label: "Terms & Conditions" },
  ],
};

interface FooterProps {
  siteSettings?: SiteSettings | null;
}

export function Footer({ siteSettings }: FooterProps) {
  const siteTitle = siteSettings?.siteTitle?.trim() || "Quizzer";
  const tagline = siteSettings?.footerTagline?.trim() || "Find and play pub quizzes near you.";
  const copyright =
    siteSettings?.footerCopyright?.trim() ||
    `© ${new Date().getFullYear()} Quizzer. All rights reserved.`;

  return (
    <footer className="border-t-[3px] border-quizzer-black border-solid bg-quizzer-black text-quizzer-white py-12">
      <Container>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-8">
          <div>
            <p className="font-heading text-xl font-normal mb-4">{siteTitle}</p>
            <p className="text-sm text-quizzer-white/80">{tagline}</p>
          </div>
          {Object.entries(footerLinks).map(([heading, links]) => (
            <div key={heading}>
              <h3 className="font-semibold text-quizzer-white mb-3">{heading}</h3>
              <ul className="list-none m-0 p-0 space-y-2">
                {links.map(({ href, label }) => (
                  <li key={href}>
                    <Link
                      href={href}
                      className="text-quizzer-white/80 hover:text-quizzer-yellow text-sm no-underline"
                    >
                      {label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <p className="mt-8 pt-8 border-t border-quizzer-white/20 text-sm text-quizzer-white/60">
          {copyright}
        </p>
      </Container>
    </footer>
  );
}
