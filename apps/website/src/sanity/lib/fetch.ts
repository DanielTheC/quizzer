import { sanityClient, isSanityConfigured } from "./client";
import {
  SITE_SETTINGS_QUERY,
  HOME_PAGE_QUERY,
  HOST_PAGE_QUERY,
  QUIZ_PAGE_BY_EVENT_ID_QUERY,
  QUIZ_PAGE_EVENT_IDS_QUERY,
  CITY_BY_SLUG_QUERY,
  ALL_FAQS_QUERY,
  ALL_BLOG_POSTS_QUERY,
  FEATURED_BLOG_POSTS_QUERY,
  BLOG_POST_BY_SLUG_QUERY,
  BLOG_POST_SLUGS_QUERY,
} from "./queries";
import type {
  SiteSettings,
  HomePage,
  HostPage,
  QuizPageDocument,
  CityDocument,
  FaqDocument,
  BlogPostListItem,
  BlogPostDocument,
} from "./types";

export async function getSiteSettings(): Promise<SiteSettings | null> {
  if (!isSanityConfigured()) return null;
  try {
    return await sanityClient.fetch<SiteSettings | null>(SITE_SETTINGS_QUERY, {}, { next: { revalidate: 60 } });
  } catch {
    return null;
  }
}

export async function getHomePage(): Promise<HomePage | null> {
  if (!isSanityConfigured()) return null;
  try {
    return await sanityClient.fetch<HomePage | null>(HOME_PAGE_QUERY, {}, { next: { revalidate: 60 } });
  } catch {
    return null;
  }
}

export async function getHostPage(): Promise<HostPage | null> {
  if (!isSanityConfigured()) return null;
  try {
    return await sanityClient.fetch<HostPage | null>(HOST_PAGE_QUERY, {}, { next: { revalidate: 60 } });
  } catch {
    return null;
  }
}

export async function getQuizPageByEventId(quizEventId: string): Promise<QuizPageDocument | null> {
  if (!isSanityConfigured()) return null;
  try {
    return await sanityClient.fetch<QuizPageDocument | null>(
      QUIZ_PAGE_BY_EVENT_ID_QUERY,
      { quizEventId },
      { next: { revalidate: 60 } }
    );
  } catch {
    return null;
  }
}

/** Event IDs that have an enabled Sanity quiz page (for static generation). */
export async function getQuizPageEventIds(): Promise<string[]> {
  if (!isSanityConfigured()) return [];
  try {
    const ids = await sanityClient.fetch<string[] | null>(
      QUIZ_PAGE_EVENT_IDS_QUERY,
      {},
      { next: { revalidate: 60 } }
    );
    return (ids ?? []).filter((id): id is string => typeof id === "string" && id.length > 0);
  } catch {
    return [];
  }
}

export async function getCityBySlug(slug: string): Promise<CityDocument | null> {
  if (!isSanityConfigured()) return null;
  try {
    return await sanityClient.fetch<CityDocument | null>(CITY_BY_SLUG_QUERY, { slug }, { next: { revalidate: 60 } });
  } catch {
    return null;
  }
}

export async function getAllFaqs(): Promise<FaqDocument[] | null> {
  if (!isSanityConfigured()) return null;
  try {
    return await sanityClient.fetch<FaqDocument[] | null>(ALL_FAQS_QUERY, {}, { next: { revalidate: 60 } });
  } catch {
    return null;
  }
}

// ——— Blog ———

export async function getBlogPosts(): Promise<BlogPostListItem[]> {
  if (!isSanityConfigured()) return [];
  try {
    const data = await sanityClient.fetch<BlogPostListItem[] | null>(
      ALL_BLOG_POSTS_QUERY,
      {},
      { next: { revalidate: 60 } }
    );
    return data ?? [];
  } catch {
    return [];
  }
}

export async function getFeaturedBlogPosts(): Promise<BlogPostListItem[]> {
  if (!isSanityConfigured()) return [];
  try {
    const data = await sanityClient.fetch<BlogPostListItem[] | null>(
      FEATURED_BLOG_POSTS_QUERY,
      {},
      { next: { revalidate: 60 } }
    );
    return data ?? [];
  } catch {
    return [];
  }
}

export async function getBlogPostBySlug(slug: string): Promise<BlogPostDocument | null> {
  if (!isSanityConfigured()) return null;
  try {
    return await sanityClient.fetch<BlogPostDocument | null>(
      BLOG_POST_BY_SLUG_QUERY,
      { slug },
      { next: { revalidate: 60 } }
    );
  } catch {
    return null;
  }
}

export async function getBlogPostSlugs(): Promise<string[]> {
  if (!isSanityConfigured()) return [];
  try {
    const slugs = await sanityClient.fetch<string[] | null>(
      BLOG_POST_SLUGS_QUERY,
      {},
      { next: { revalidate: 60 } }
    );
    return slugs ?? [];
  } catch {
    return [];
  }
}
