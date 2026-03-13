import { type ReactNode } from "react";

interface PageHeroProps {
  title: string;
  description?: string;
  children?: ReactNode;
  /** Background colour */
  background?: "yellow" | "white" | "cream" | "black";
}

const bgMap = {
  yellow: "bg-quizzer-yellow",
  white: "bg-quizzer-white",
  cream: "bg-quizzer-cream",
  black: "bg-quizzer-black",
};

export function PageHero({
  title,
  description,
  children,
  background = "yellow",
}: PageHeroProps) {
  const isDark = background === "black";
  return (
    <div
      className={`${bgMap[background]} py-16 sm:py-24 ${isDark ? "text-quizzer-white" : "text-quizzer-black"}`}
    >
      <div className="mx-auto max-w-[1200px] px-4 sm:px-6 lg:px-8">
        <h1 className="font-heading text-4xl sm:text-5xl md:text-6xl font-normal mb-4">
          {title}
        </h1>
        {description && (
          <p className="text-lg sm:text-xl max-w-2xl mb-8 opacity-90">
            {description}
          </p>
        )}
        {children}
      </div>
    </div>
  );
}
