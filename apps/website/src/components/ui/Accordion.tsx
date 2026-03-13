"use client";

import { useState, type ReactNode } from "react";

interface AccordionItemProps {
  title: string;
  children: ReactNode;
  defaultOpen?: boolean;
}

export function AccordionItem({
  title,
  children,
  defaultOpen = false,
}: AccordionItemProps) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border-b-[3px] border-quizzer-black border-solid last:border-b-0">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between gap-4 py-4 text-left font-heading text-lg text-quizzer-black hover:bg-quizzer-cream/50 transition-colors rounded-[10px] px-2 -mx-2"
      >
        {title}
        <span
          className={`text-2xl leading-none transition-transform ${open ? "rotate-45" : ""}`}
          aria-hidden
        >
          +
        </span>
      </button>
      {open && (
        <div className="pb-4 text-quizzer-black/90">{children}</div>
      )}
    </div>
  );
}

interface AccordionProps {
  children: ReactNode;
  className?: string;
}

export function Accordion({ children, className = "" }: AccordionProps) {
  return (
    <div
      className={`rounded-[12px] border-[3px] border-quizzer-black border-solid bg-quizzer-white divide-y-0 ${className}`}
    >
      {children}
    </div>
  );
}
