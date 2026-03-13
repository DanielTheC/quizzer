import { type ReactNode } from "react";

const MAX_WIDTH = 1200;

interface ContainerProps {
  children: ReactNode;
  className?: string;
}

export function Container({ children, className = "" }: ContainerProps) {
  return (
    <div
      className={`mx-auto w-full max-w-[${MAX_WIDTH}px] px-4 sm:px-6 lg:px-8 ${className}`}
      style={{ maxWidth: MAX_WIDTH }}
    >
      {children}
    </div>
  );
}
