import { defineType, defineField } from "sanity";

const CITY_SLUGS = ["london", "birmingham", "manchester", "glasgow", "edinburgh"] as const;

export const cityType = defineType({
  name: "city",
  title: "City",
  type: "document",
  description:
    "Editorial content for each city landing page (e.g. /find-a-quiz/london). Slug must match the URL. Quiz listings come from the app, not from Sanity.",
  fields: [
    defineField({
      name: "cityName",
      title: "City name",
      type: "string",
      description: "Display name, e.g. London, Manchester. Use proper capitalisation.",
      validation: (Rule) => Rule.required().max(50),
    }),
    defineField({
      name: "slug",
      title: "Slug",
      type: "slug",
      options: {
        source: "cityName",
        slugify: (input: string) =>
          input
            .toLowerCase()
            .trim()
            .replace(/\s+/g, "-")
            .replace(/[^\w-]+/g, ""),
      },
      description:
        "Must match the URL. Use: london, birmingham, manchester, glasgow, or edinburgh. Generate from city name then adjust if needed.",
      validation: (Rule) =>
        Rule.required().custom((slug) => {
          if (!slug?.current) return "Slug is required";
          const value = slug.current.toLowerCase();
          return CITY_SLUGS.includes(value as (typeof CITY_SLUGS)[number])
            ? true
            : `Slug must be one of: ${CITY_SLUGS.join(", ")}`;
        }),
    }),
    defineField({
      name: "heroTitle",
      title: "Hero title",
      type: "string",
      description: "Main headline on the city page, e.g. “Pub Quizzes in London”.",
      validation: (Rule) => Rule.max(80),
    }),
    defineField({
      name: "heroIntro",
      title: "Hero intro",
      type: "text",
      rows: 3,
      description: "Short intro under the hero. Explain what’s on offer in this city.",
    }),
    defineField({
      name: "whyUseQuizzerTitle",
      title: "Why use Quizzer section title",
      type: "string",
      description: "Heading for the “Why use Quizzer in [City]?” block. Can include the city name.",
      validation: (Rule) => Rule.max(80),
    }),
    defineField({
      name: "whyUseQuizzerCards",
      title: "Why use Quizzer cards",
      type: "array",
      description: "Typically 3 cards. Keep copy relevant to this city where possible.",
      of: [
        {
          type: "object",
          fields: [
            { name: "title", type: "string", title: "Title" },
            { name: "body", type: "text", title: "Body", rows: 3 },
          ],
          preview: {
            select: { title: "title" },
            prepare: ({ title }) => ({ title: title || "Card" }),
          },
        },
      ],
    }),
    defineField({
      name: "popularQuizNightsIntro",
      title: "Popular quiz nights intro",
      type: "text",
      rows: 3,
      description: "Intro text above the “Popular quiz nights” section. Actual quiz list comes from the app.",
    }),
    defineField({
      name: "seoTitle",
      title: "SEO title",
      type: "string",
      description: "Page title for search results, e.g. “Pub Quizzes in London | Quizzer”.",
      validation: (Rule) => Rule.max(70),
    }),
    defineField({
      name: "seoDescription",
      title: "SEO description",
      type: "text",
      rows: 2,
      description: "Meta description for this city page. Keep under ~160 characters.",
      validation: (Rule) => Rule.max(160),
    }),
  ],
  preview: {
    select: { cityName: "cityName", slug: "slug.current" },
    prepare: ({ cityName, slug }) => ({
      title: cityName || "Untitled city",
      subtitle: slug ? `/${slug}` : "",
    }),
  },
});
