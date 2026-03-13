import { type ReactNode } from "react";

interface FeatureCardProps {
  title: string;
  children: ReactNode;
  accent?: "yellow" | "cream" | "pink" | "green" | "white";
  className?: string;
}

const accentBg: Record<string, string> = {
  yellow: "bg-quizzer-yellow",
  cream: "bg-quizzer-cream",
  pink: "bg-quizzer-pink",
  green: "bg-quizzer-green",
  white: "bg-quizzer-white",
};

export function FeatureCard({
  title,
  children,
  accent = "white",
  className = "",
}: FeatureCardProps) {
  return (
    <div
      className={`rounded-[12px] border-[3px] border-quizzer-black border-solid p-6 shadow-[5px_5px_0_#000] transition-all duration-150 hover:shadow-[3px_3px_0_#000] hover:translate-x-[2px] hover:translate-y-[2px] ${accentBg[accent]} ${className}`}
    >
      <h3 className="font-heading text-xl font-normal text-quizzer-black mb-3">
        {title}
      </h3>
      <div className="text-quizzer-black/90">{children}</div>
    </div>
  );
}
