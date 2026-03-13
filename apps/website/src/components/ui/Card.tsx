import { type ReactNode } from "react";

interface CardProps {
  children: ReactNode;
  className?: string;
  /** Optional background colour token (e.g. bg-quizzer-cream) */
  accent?: string;
}

export function Card({
  children,
  className = "",
  accent,
}: CardProps) {
  return (
    <div
      className={`rounded-[12px] border-[3px] border-quizzer-black border-solid p-6 shadow-[5px_5px_0_#000] transition-all duration-150 hover:shadow-[3px_3px_0_#000] hover:translate-x-[2px] hover:translate-y-[2px] ${accent ?? "bg-quizzer-white"} ${className}`}
    >
      {children}
    </div>
  );
}
