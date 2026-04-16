/** GROQ queries for Quizzer marketing content. Quiz/venue data stays in Supabase. */

export const SITE_SETTINGS_QUERY = `*[_type == "siteSettings"][0] {
  siteTitle,
  defaultMetaTitle,
  defaultMetaDescription,
  contactEmail,
  socialLinks,
  footerTagline,
  footerCopyright
}`;

export const HOME_PAGE_QUERY = `*[_type == "homePage"][0] {
  heroTitle,
  heroSubtitle,
  statItems,
  featureCards,
  hostSectionTitle,
  hostSectionCopy,
  finalCtaTitle,
  finalCtaCopy,
  seoTitle,
  seoDescription
}`;

export const HOST_PAGE_QUERY = `*[_type == "hostPage"][0] {
  heroTitle,
  heroIntro,
  benefits,
  faqIntro,
  ctaTitle,
  ctaCopy,
  contactSectionTitle,
  contactSectionCopy,
  seoTitle,
  seoDescription
}`;

/** Editorial overlay for /find-a-quiz/quiz/[id] (linked by Supabase quiz_events.id). */
export const QUIZ_PAGE_BY_EVENT_ID_QUERY = `*[_type == "quizPage" && quizEventId == $quizEventId && (!defined(enabled) || enabled == true)][0] {
  _id,
  quizEventId,
  enabled,
  heroTitle,
  heroSubtitle,
  body,
  seoTitle,
  seoDescription
}`;

export const QUIZ_PAGE_EVENT_IDS_QUERY = `*[_type == "quizPage" && defined(quizEventId) && (!defined(enabled) || enabled == true)].quizEventId`;

export const CITY_BY_SLUG_QUERY = `*[_type == "city" && slug.current == $slug][0] {
  _id,
  cityName,
  "slug": slug.current,
  heroTitle,
  heroIntro,
  whyUseQuizzerTitle,
  whyUseQuizzerCards,
  popularQuizNightsIntro,
  seoTitle,
  seoDescription
}`;

export const ALL_FAQS_QUERY = `*[_type == "faq"] | order(order asc) {
  _id,
  question,
  answer,
  category
}`;

export const FAQS_BY_CATEGORY_QUERY = `*[_type == "faq" && category == $category] | order(order asc) {
  _id,
  question,
  answer,
  category
}`;

// ——— Blog ———

export const ALL_BLOG_POSTS_QUERY = `*[_type == "blogPost"] | order(publishedAt desc) {
  _id,
  _updatedAt,
  title,
  "slug": slug.current,
  excerpt,
  publishedAt,
  featured,
  featuredImage,
  "category": category->{ title, "slug": slug.current },
  "author": author->{ name, "slug": slug.current, role, image }
}`;

export const FEATURED_BLOG_POSTS_QUERY = `*[_type == "blogPost" && featured == true] | order(publishedAt desc) [0...3] {
  _id,
  title,
  "slug": slug.current,
  excerpt,
  publishedAt,
  featuredImage,
  "category": category->{ title, "slug": slug.current },
  "author": author->{ name, "slug": slug.current, role, image }
}`;

export const BLOG_POST_BY_SLUG_QUERY = `*[_type == "blogPost" && slug.current == $slug][0] {
  _id,
  title,
  "slug": slug.current,
  excerpt,
  publishedAt,
  featuredImage,
  body,
  "category": category->{ title, "slug": slug.current },
  "author": author->{ name, "slug": slug.current, role, bio, image },
  seoTitle,
  seoDescription
}`;

export const BLOG_POST_SLUGS_QUERY = `*[_type == "blogPost"].slug.current`;
