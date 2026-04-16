/** Types for Sanity document responses. Used by the frontend. */

export interface SiteSettings {
  siteTitle?: string | null;
  defaultMetaTitle?: string | null;
  defaultMetaDescription?: string | null;
  contactEmail?: string | null;
  socialLinks?: { label?: string; url?: string }[] | null;
  footerTagline?: string | null;
  footerCopyright?: string | null;
}

export interface HomePage {
  heroTitle?: string | null;
  heroSubtitle?: string | null;
  statItems?: { value?: string; label?: string }[] | null;
  featureCards?: { title?: string; body?: string; accent?: string }[] | null;
  hostSectionTitle?: string | null;
  hostSectionCopy?: string | null;
  finalCtaTitle?: string | null;
  finalCtaCopy?: string | null;
  seoTitle?: string | null;
  seoDescription?: string | null;
}

export interface HostPage {
  heroTitle?: string | null;
  heroIntro?: string | null;
  benefits?: { title?: string; body?: string; accent?: string }[] | null;
  faqIntro?: string | null;
  ctaTitle?: string | null;
  ctaCopy?: string | null;
  contactSectionTitle?: string | null;
  contactSectionCopy?: string | null;
  seoTitle?: string | null;
  seoDescription?: string | null;
}

export interface QuizPageDocument {
  _id?: string;
  quizEventId?: string | null;
  enabled?: boolean | null;
  heroTitle?: string | null;
  heroSubtitle?: string | null;
  body?: unknown;
  seoTitle?: string | null;
  seoDescription?: string | null;
}

export interface CityDocument {
  _id?: string;
  cityName?: string | null;
  slug?: string;
  heroTitle?: string | null;
  heroIntro?: string | null;
  whyUseQuizzerTitle?: string | null;
  whyUseQuizzerCards?: { title?: string; body?: string }[] | null;
  popularQuizNightsIntro?: string | null;
  seoTitle?: string | null;
  seoDescription?: string | null;
}

export interface FaqDocument {
  _id: string;
  question?: string | null;
  answer?: string | null;
  category?: string | null;
}

// ——— Blog (Sanity response shapes) ———

export interface BlogCategoryRef {
  title?: string | null;
  slug?: string | null;
}

export interface BlogAuthorRef {
  name?: string | null;
  slug?: string | null;
  role?: string | null;
  bio?: string | null;
  image?: { _type: "image"; asset?: { _ref?: string } } | null;
}

export interface BlogPostListItem {
  _id: string;
  _updatedAt?: string | null;
  title?: string | null;
  slug?: string | null;
  excerpt?: string | null;
  publishedAt?: string | null;
  featured?: boolean;
  featuredImage?: { _type: "image"; asset?: { _ref?: string }; alt?: string } | null;
  category?: BlogCategoryRef | null;
  author?: BlogAuthorRef | null;
}

export interface BlogPostDocument extends BlogPostListItem {
  body?: unknown; // Portable Text blocks
  seoTitle?: string | null;
  seoDescription?: string | null;
}
