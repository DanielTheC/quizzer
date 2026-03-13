import Link from "next/link";
import { Container } from "@/components/ui/Container";

const navLinks = [
  { href: "/find-a-quiz", label: "Find a Quiz" },
  { href: "/host-a-quiz", label: "Host a Quiz" },
  { href: "/blog", label: "Blog" },
  { href: "/about-us", label: "About" },
  { href: "/faq", label: "FAQ" },
  { href: "/contact-us", label: "Contact" },
];

interface NavbarProps {
  siteTitle?: string | null;
}

export function Navbar({ siteTitle }: NavbarProps) {
  const title = siteTitle?.trim() || "Quizzer";
  return (
    <header className="border-b-[3px] border-quizzer-black border-solid bg-quizzer-white sticky top-0 z-50">
      <Container className="py-4">
        <nav className="flex items-center justify-between gap-6">
          <Link
            href="/"
            className="font-heading text-2xl font-normal text-quizzer-black no-underline hover:opacity-80"
          >
            {title}
          </Link>
          <ul className="flex flex-wrap items-center gap-4 sm:gap-6 list-none m-0 p-0">
            {navLinks.map(({ href, label }) => (
              <li key={href}>
                <Link
                  href={href}
                  className="font-semibold text-quizzer-black no-underline hover:underline"
                >
                  {label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </Container>
    </header>
  );
}
