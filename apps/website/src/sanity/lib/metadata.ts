import type { Metadata } from "next";
import type { SiteSettings } from "./types";

const DEFAULT_TITLE = "Quizzer – Find a Pub Quiz Near You";
const DEFAULT_DESCRIPTION =
  "Find and play pub quizzes near you. Quizzer helps players discover quiz nights and venues run smarter quiz nights.";

/**
 * Build Next.js metadata from Sanity SEO fields with fallbacks from site settings and defaults.
 */
export function buildMetadata(options: {
  pageTitle?: string | null;
  pageDescription?: string | null;
  siteSettings?: SiteSettings | null;
  template?: string;
}): Metadata {
  const {
    pageTitle,
    pageDescription,
    siteSettings,
    template = "%s | Quizzer",
  } = options;

  const defaultTitle =
    siteSettings?.defaultMetaTitle ?? siteSettings?.siteTitle ?? DEFAULT_TITLE;
  const defaultDescription =
    siteSettings?.defaultMetaDescription ?? DEFAULT_DESCRIPTION;

  const title = pageTitle?.trim() || defaultTitle;
  const description =
    (pageDescription?.trim() || defaultDescription).slice(0, 160);

  return {
    title: { default: defaultTitle, template },
    description: description,
    keywords: ["pub quiz", "quiz night", "pub quiz near me", "trivia"],
    openGraph: { type: "website" },
  };
}

/**
 * For page-level metadata: use the page's SEO title/description if set, otherwise fallbacks.
 */
export function buildPageMetadata(options: {
  title?: string | null;
  description?: string | null;
  siteSettings?: SiteSettings | null;
  fallbackTitle?: string;
  fallbackDescription?: string;
}): Metadata {
  const {
    title,
    description,
    siteSettings,
    fallbackTitle,
    fallbackDescription,
  } = options;

  const defaultTitle =
    siteSettings?.defaultMetaTitle ?? siteSettings?.siteTitle ?? DEFAULT_TITLE;
  const defaultDescription =
    siteSettings?.defaultMetaDescription ?? DEFAULT_DESCRIPTION;

  const resolvedTitle =
    title?.trim() || fallbackTitle || defaultTitle;
  const resolvedDescription = (description?.trim() || fallbackDescription || defaultDescription).slice(0, 160);

  return {
    title: resolvedTitle,
    description: resolvedDescription,
    openGraph: { type: "website" },
  };
}
