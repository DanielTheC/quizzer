import { defineType, defineField } from "sanity";

export const homePageType = defineType({
  name: "homePage",
  title: "Home page",
  type: "document",
  description: "Content for the homepage: hero, stats, feature cards, host section, and final CTA. One document only.",
  fields: [
    defineField({
      name: "heroTitle",
      title: "Hero title",
      type: "string",
      description: "Main headline at the top of the homepage.",
      initialValue: "Find a Pub Quiz Near You",
      validation: (Rule) => Rule.max(80),
    }),
    defineField({
      name: "heroSubtitle",
      title: "Hero subtitle",
      type: "text",
      rows: 3,
      description: "Supporting text under the hero headline. Keep it short and inviting.",
      initialValue:
        "Discover quiz nights across the UK, track your scores and climb the leaderboard with Quizzer.",
    }),
    defineField({
      name: "statItems",
      title: "Stat items",
      type: "array",
      description: "Numbers shown in badges (e.g. Quizzes Listed, Cities Live). Add 4 for best layout.",
      of: [
        {
          type: "object",
          fields: [
            { name: "value", type: "string", title: "Value", description: "e.g. 500+, 5, 10k+" },
            { name: "label", type: "string", title: "Label", description: "e.g. Quizzes Listed" },
          ],
          preview: {
            select: { value: "value", label: "label" },
            prepare: ({ value, label }) => ({ title: `${value ?? "—"} ${label ?? ""}`.trim() }),
          },
        },
      ],
      initialValue: [
        { value: "500+", label: "Quizzes Listed" },
        { value: "5", label: "Cities Live" },
        { value: "10k+", label: "Teams Playing" },
        { value: "200+", label: "Pubs Partnered" },
      ],
    }),
    defineField({
      name: "featureCards",
      title: "Feature cards",
      type: "array",
      description: "Three cards explaining why players use Quizzer. Order matters.",
      of: [
        {
          type: "object",
          fields: [
            { name: "title", type: "string", title: "Title" },
            { name: "body", type: "text", title: "Body", rows: 3 },
            {
              name: "accent",
              type: "string",
              title: "Accent colour",
              options: {
                list: [
                  { title: "Yellow", value: "yellow" },
                  { title: "Cream", value: "cream" },
                  { title: "Green", value: "green" },
                ],
              },
            },
          ],
          preview: {
            select: { title: "title" },
            prepare: ({ title }) => ({ title: title || "Feature card" }),
          },
        },
      ],
      initialValue: [
        {
          title: "Find quizzes nearby",
          body: "Discover pub quizzes happening in your city tonight.",
          accent: "yellow",
        },
        {
          title: "Play live quizzes",
          body: "Join the game and see scores update live.",
          accent: "cream",
        },
        {
          title: "Climb the leaderboard",
          body: "Compete against teams across your city.",
          accent: "green",
        },
      ],
    }),
    defineField({
      name: "hostSectionTitle",
      title: "Host section title",
      type: "string",
      description: "Heading for the “For venues” block on the homepage.",
      initialValue: "For venues",
      validation: (Rule) => Rule.max(60),
    }),
    defineField({
      name: "hostSectionCopy",
      title: "Host section copy",
      type: "text",
      rows: 4,
      description: "Short pitch to venues about hosting quizzes with Quizzer.",
      initialValue:
        "Run quiz nights that pull in crowds and keep them coming back. Quizzer helps you list your quiz, manage rounds, and let players join on their phones. More footfall, less admin.",
    }),
    defineField({
      name: "finalCtaTitle",
      title: "Final CTA title",
      type: "string",
      description: "Headline for the last call-to-action block before the footer.",
      initialValue: "Ready to find your next quiz night?",
      validation: (Rule) => Rule.max(80),
    }),
    defineField({
      name: "finalCtaCopy",
      title: "Final CTA copy",
      type: "text",
      rows: 2,
      description: "Supporting line under the final CTA title.",
      initialValue: "Browse quizzes happening tonight near you.",
    }),
    defineField({
      name: "seoTitle",
      title: "SEO title",
      type: "string",
      description: "Used as the page title in search results. Overrides default meta title when set.",
      validation: (Rule) => Rule.max(70),
    }),
    defineField({
      name: "seoDescription",
      title: "SEO description",
      type: "text",
      rows: 2,
      description: "Used as the meta description for the homepage. Keep under ~160 characters.",
      validation: (Rule) => Rule.max(160),
    }),
  ],
});
