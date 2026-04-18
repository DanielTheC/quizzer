import Link from "next/link";
import { type ReactNode } from "react";

type Variant = "primary" | "secondary" | "outline" | "ghost";
type Size = "sm" | "md" | "lg";

const variantStyles: Record<Variant, string> = {
  primary:
    "bg-quizzer-yellow text-quizzer-black border-quizzer-black shadow-[var(--shadow-button)] hover:shadow-[var(--shadow-button-hover)] hover:translate-x-[1px] hover:translate-y-[1px]",
  secondary:
    "bg-quizzer-pink text-quizzer-white border-quizzer-black shadow-[var(--shadow-button)] hover:shadow-[var(--shadow-button-hover)] hover:translate-x-[1px] hover:translate-y-[1px]",
  outline:
    "bg-transparent text-quizzer-black border-quizzer-black hover:bg-quizzer-black hover:text-quizzer-white shadow-[var(--shadow-button)] hover:shadow-[var(--shadow-button-hover)] hover:translate-x-[1px] hover:translate-y-[1px]",
  ghost:
    "bg-transparent text-quizzer-black border-quizzer-black shadow-[var(--shadow-button)] hover:shadow-[var(--shadow-button-hover)] hover:translate-x-[1px] hover:translate-y-[1px]",
};

const sizeStyles: Record<Size, string> = {
  sm: "px-4 py-2 text-sm",
  md: "px-6 py-3 text-base",
  lg: "px-8 py-4 text-lg font-semibold",
};

interface ButtonBaseProps {
  variant?: Variant;
  size?: Size;
  children: ReactNode;
  className?: string;
}

interface ButtonAsButton extends ButtonBaseProps {
  href?: never;
  type?: "button" | "submit";
  onClick?: () => void;
  disabled?: boolean;
}

interface ButtonAsLink extends ButtonBaseProps {
  href: string;
  type?: never;
  onClick?: never;
}

type ButtonProps = ButtonAsButton | ButtonAsLink;

export function Button({
  variant = "primary",
  size = "md",
  children,
  className = "",
  ...rest
}: ButtonProps) {
  const base =
    "inline-flex items-center justify-center font-semibold border-[3px] border-solid rounded-[var(--radius-button)] transition-all duration-150 disabled:pointer-events-none disabled:opacity-50 " +
    variantStyles[variant] +
    " " +
    sizeStyles[size];

  if ("href" in rest && rest.href) {
    return (
      <Link
        href={rest.href}
        className={`${base} ${className}`}
        style={{ textDecoration: "none" }}
      >
        {children}
      </Link>
    );
  }

  return (
    <button
      type={rest.type ?? "button"}
      onClick={rest.onClick}
      disabled={"disabled" in rest ? rest.disabled : undefined}
      className={`${base} ${className}`}
    >
      {children}
    </button>
  );
}
