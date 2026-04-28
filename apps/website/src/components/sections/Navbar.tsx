"use client";

import Link from "next/link";
import { useState } from "react";
import { usePathname } from "next/navigation";
import { Container } from "@/components/ui/Container";

const navLinks = [
  { href: "/find-a-quiz", label: "Find a Quiz" },
  { href: "/host-a-quiz", label: "For Venues" },
  { href: "/blog", label: "Blog" },
  { href: "/about-us", label: "About" },
  { href: "/faq", label: "FAQ" },
  { href: "/contact-us", label: "Contact" },
];

interface NavbarProps {
  siteTitle?: string | null;
}

function NavbarMobile() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        className="md:hidden inline-flex shrink-0 items-center justify-center p-2 text-2xl leading-none text-quizzer-black bg-transparent border-0 cursor-pointer hover:opacity-80"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label={open ? "Close menu" : "Open menu"}
      >
        {open ? "✕" : "☰"}
      </button>
      <div
        className="md:hidden w-full flex-[1_0_100%] overflow-hidden transition-[max-height] duration-300 ease-in-out"
        style={{ maxHeight: open ? "min(80vh, 480px)" : 0 }}
      >
        <div className="w-screen relative left-1/2 -translate-x-1/2 bg-quizzer-black border-t border-quizzer-white/20">
          {navLinks.map(({ href, label }) => {
            const isPrimaryCta = href === "/find-a-quiz";
            return (
              <Link
                key={href}
                href={href}
                onClick={() => setOpen(false)}
                className={
                  isPrimaryCta
                    ? "block w-full text-center font-semibold text-lg no-underline bg-quizzer-yellow text-quizzer-black rounded-[8px] mx-4 my-2 px-4 py-3 hover:opacity-90"
                    : "block w-full py-4 px-6 border-b-[1px] border-quizzer-white/20 text-quizzer-white font-semibold text-lg no-underline hover:bg-quizzer-white/10"
                }
              >
                {label}
              </Link>
            );
          })}
        </div>
      </div>
    </>
  );
}

export function Navbar({ siteTitle }: NavbarProps) {
  const pathname = usePathname();
  const title = siteTitle?.trim() || "Quizzer";

  return (
    <header className="border-b-[3px] border-quizzer-black border-solid bg-quizzer-white sticky top-0 z-50 overflow-x-hidden">
      <Container className="py-4">
        <nav className="flex flex-wrap items-center justify-between gap-6">
          <Link
            href="/"
            className="font-heading text-2xl font-normal text-quizzer-black no-underline hover:opacity-80"
          >
            {title}
          </Link>
          <ul className="hidden md:flex flex-wrap items-center gap-4 sm:gap-6 list-none m-0 p-0">
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
          <NavbarMobile key={pathname} />
        </nav>
      </Container>
    </header>
  );
}
