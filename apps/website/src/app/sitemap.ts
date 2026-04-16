import type { MetadataRoute } from "next";
import { fetchQuizzesFromSupabase, getCities } from "@/lib/quizzes";
import { getBlogPosts } from "@/sanity/lib/fetch";

const SITE_URL = "https://quizzerapp.co.uk";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // ── Static pages ──────────────────────────────────────────────────────────
  const staticPages: MetadataRoute.Sitemap = [
    {
      url: SITE_URL,
      changeFrequency: "daily",
      priority: 1.0,
    },
    {
      url: `${SITE_URL}/find-a-quiz`,
      changeFrequency: "daily",
      priority: 0.9,
    },
    {
      url: `${SITE_URL}/host-a-quiz`,
      changeFrequency: "monthly",
      priority: 0.7,
    },
    {
      url: `${SITE_URL}/blog`,
      changeFrequency: "weekly",
      priority: 0.6,
    },
    {
      url: `${SITE_URL}/about-us`,
      changeFrequency: "monthly",
      priority: 0.5,
    },
    {
      url: `${SITE_URL}/faq`,
      changeFrequency: "monthly",
      priority: 0.5,
    },
    {
      url: `${SITE_URL}/contact-us`,
      changeFrequency: "monthly",
      priority: 0.4,
    },
    {
      url: `${SITE_URL}/terms-and-conditions`,
      changeFrequency: "yearly",
      priority: 0.2,
    },
    {
      url: `${SITE_URL}/privacy-policy`,
      changeFrequency: "yearly",
      priority: 0.2,
    },
  ];

  // ── City pages + quiz detail pages from Supabase ──────────────────────────
  const [quizzes, cities, blogPosts] = await Promise.all([
    fetchQuizzesFromSupabase().catch(() => []),
    getCities().catch(() => []),
    getBlogPosts().catch(() => []),
  ]);

  const cityPages: MetadataRoute.Sitemap = cities.map((city) => ({
    url: `${SITE_URL}/find-a-quiz/${city.slug}`,
    changeFrequency: "daily",
    priority: 0.8,
  }));

  const quizDetailPages: MetadataRoute.Sitemap = quizzes.map((quiz) => ({
    url: `${SITE_URL}/find-a-quiz/quiz/${quiz.id}`,
    changeFrequency: "weekly",
    priority: 0.7,
  }));

  // ── Blog posts from Sanity ────────────────────────────────────────────────
  const blogPostPages: MetadataRoute.Sitemap = blogPosts.map((post) => ({
    url: `${SITE_URL}/blog/${post.slug ?? post._id}`,
    // Sanity documents have _updatedAt — use it if present for accurate recrawl signals
    lastModified: post._updatedAt ? new Date(post._updatedAt) : undefined,
    changeFrequency: "monthly",
    priority: 0.6,
  }));

  return [...staticPages, ...cityPages, ...quizDetailPages, ...blogPostPages];
}
