import { type ReactNode } from "react";

type BadgeVariant = "yellow" | "pink" | "green" | "orange" | "blue" | "black";

const variantStyles: Record<BadgeVariant, string> = {
  yellow: "bg-quizzer-yellow text-quizzer-black border-quizzer-black",
  pink: "bg-quizzer-pink text-quizzer-white border-quizzer-black",
  green: "bg-quizzer-green text-quizzer-black border-quizzer-black",
  orange: "bg-quizzer-orange text-quizzer-black border-quizzer-black",
  blue: "bg-quizzer-blue text-quizzer-white border-quizzer-black",
  black: "bg-quizzer-black text-quizzer-white border-quizzer-black",
};

interface BadgeProps {
  children: ReactNode;
  variant?: BadgeVariant;
  className?: string;
}

export function Badge({
  children,
  variant = "yellow",
  className = "",
}: BadgeProps) {
  return (
    <span
      className={`inline-block border-[3px] border-solid rounded-[10px] px-2.5 py-0.5 text-xs font-bold uppercase tracking-wide ${variantStyles[variant]} ${className}`}
    >
      {children}
    </span>
  );
}
