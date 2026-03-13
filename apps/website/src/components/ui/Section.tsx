import { type ReactNode } from "react";

interface SectionProps {
  children: ReactNode;
  className?: string;
  /** Background: yellow | white | cream | black | white */
  background?: "yellow" | "white" | "cream" | "black";
}

const bgMap = {
  yellow: "bg-quizzer-yellow",
  white: "bg-quizzer-white",
  cream: "bg-quizzer-cream",
  black: "bg-quizzer-black",
};

export function Section({
  children,
  className = "",
  background = "white",
}: SectionProps) {
  const isDark = background === "black";
  return (
    <section
      className={`py-16 sm:py-24 ${bgMap[background]} ${isDark ? "text-quizzer-white" : "text-quizzer-black"} ${className}`}
    >
      {children}
    </section>
  );
}
