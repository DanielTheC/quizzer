"use client";

import { PortableText, type PortableTextComponents } from "@portabletext/react";
import type { PortableTextBlock } from "@portabletext/types";
import Image from "next/image";
import { urlFor } from "@/sanity/lib/image";

interface BlogBodyProps {
  /** Portable Text block array from Sanity */
  value: PortableTextBlock[] | unknown;
}

const components: PortableTextComponents = {
  block: {
    h2: ({ children }) => (
      <h2 className="font-heading text-2xl sm:text-3xl text-quizzer-black mt-10 mb-4 font-normal">
        {children}
      </h2>
    ),
    h3: ({ children }) => (
      <h3 className="font-heading text-xl sm:text-2xl text-quizzer-black mt-8 mb-3 font-normal">
        {children}
      </h3>
    ),
    normal: ({ children }) => (
      <p className="text-quizzer-black/90 leading-relaxed mb-4">{children}</p>
    ),
    blockquote: ({ children }) => (
      <blockquote className="border-l-4 border-quizzer-black pl-4 py-2 my-4 bg-quizzer-cream rounded-r-[8px] italic text-quizzer-black/90">
        {children}
      </blockquote>
    ),
  },
  list: {
    bullet: ({ children }) => (
      <ul className="list-disc pl-6 mb-4 space-y-1 text-quizzer-black/90">{children}</ul>
    ),
    number: ({ children }) => (
      <ol className="list-decimal pl-6 mb-4 space-y-1 text-quizzer-black/90">{children}</ol>
    ),
  },
  listItem: {
    bullet: ({ children }) => <li className="leading-relaxed">{children}</li>,
    number: ({ children }) => <li className="leading-relaxed">{children}</li>,
  },
  marks: {
    strong: ({ children }) => <strong className="font-semibold text-quizzer-black">{children}</strong>,
    em: ({ children }) => <em className="italic">{children}</em>,
    link: ({ children, value }) => (
      <a
        href={value?.href ?? "#"}
        target="_blank"
        rel="noopener noreferrer"
        className="text-quizzer-blue underline hover:text-quizzer-black"
      >
        {children}
      </a>
    ),
  },
  types: {
    image: ({ value }) => {
      const src = value?.asset ? urlFor(value)?.width(800).height(450).url() : null;
      const alt = (value?.alt as string) ?? "";
      const caption = value?.caption as string | undefined;
      if (!src) return null;
      return (
        <figure className="my-8">
          <div className="relative w-full aspect-video rounded-[12px] overflow-hidden border-[3px] border-quizzer-black shadow-[5px_5px_0_#000]">
            <Image
              src={src}
              alt={alt}
              fill
              className="object-cover"
              sizes="(max-width: 800px) 100vw, 800px"
            />
          </div>
          {caption && (
            <figcaption className="mt-2 text-sm text-quizzer-black/70 text-center">
              {caption}
            </figcaption>
          )}
        </figure>
      );
    },
  },
};

export function BlogBody({ value }: BlogBodyProps) {
  const blocks = Array.isArray(value) ? value : null;
  if (!blocks || blocks.length === 0) return null;
  return (
    <div className="blog-body">
      <PortableText value={blocks} components={components} />
    </div>
  );
}
