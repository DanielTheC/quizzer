import { defineType, defineField } from "sanity";

export const hostPageType = defineType({
  name: "hostPage",
  title: "Host page",
  type: "document",
  description: "Content for the Host a Quiz page: hero, benefits, FAQ intro, contact block, and CTA. One document only.",
  fields: [
    defineField({
      name: "heroTitle",
      title: "Hero title",
      type: "string",
      description: "Main headline at the top of the Host page.",
      initialValue: "Host smarter pub quizzes with Quizzer",
      validation: (Rule) => Rule.max(80),
    }),
    defineField({
      name: "heroIntro",
      title: "Hero intro",
      type: "text",
      rows: 4,
      description: "Intro paragraph under the hero headline.",
      initialValue:
        "Bring more people through the door with organised, engaging quiz nights powered by Quizzer.",
    }),
    defineField({
      name: "benefits",
      title: "Benefits",
      type: "array",
      description: "Cards explaining why venues use Quizzer. Typically 3–4 items.",
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
            prepare: ({ title }) => ({ title: title || "Benefit" }),
          },
        },
      ],
      initialValue: [
        {
          title: "Increase midweek footfall",
          body: "Quiz nights bring in teams on quieter evenings and build a regular crowd.",
          accent: "yellow",
        },
        {
          title: "Simplify quiz hosting",
          body: "Run rounds and leaderboards through the app with less admin and fewer paper answer sheets.",
          accent: "cream",
        },
        {
          title: "Engage customers with live scoring",
          body: "Players answer on their phones and see live scores, keeping the room engaged.",
          accent: "green",
        },
        {
          title: "Build a loyal quiz night crowd",
          body: "Regulars save your venue in the app and get reminders, so they keep coming back.",
          accent: "yellow",
        },
      ],
    }),
    defineField({
      name: "faqIntro",
      title: "FAQ section intro title",
      type: "string",
      description: "Heading above the FAQ accordion on this page. FAQs with category “Hosts” are shown here.",
      initialValue: "FAQ for hosts",
      validation: (Rule) => Rule.max(60),
    }),
    defineField({
      name: "ctaTitle",
      title: "Bottom CTA title",
      type: "string",
      description: "Headline for the final call-to-action (e.g. “Want to play instead?”).",
      initialValue: "Interested in hosting a quiz night with Quizzer?",
      validation: (Rule) => Rule.max(80),
    }),
    defineField({
      name: "ctaCopy",
      title: "Bottom CTA copy",
      type: "string",
      description: "Button or link label for the bottom CTA (e.g. “Find a Quiz”).",
      initialValue: "Find a Quiz",
    }),
    defineField({
      name: "contactSectionTitle",
      title: "Contact section title",
      type: "string",
      description: "Heading for the contact form block.",
      initialValue: "Get in touch",
      validation: (Rule) => Rule.max(60),
    }),
    defineField({
      name: "contactSectionCopy",
      title: "Contact section copy",
      type: "text",
      rows: 2,
      description: "Short line above the contact form.",
      initialValue: "Tell us about your venue and quiz night. We’ll get back to you with next steps.",
    }),
    defineField({
      name: "seoTitle",
      title: "SEO title",
      type: "string",
      description: "Page title for search results. Overrides default when set.",
      validation: (Rule) => Rule.max(70),
    }),
    defineField({
      name: "seoDescription",
      title: "SEO description",
      type: "text",
      rows: 2,
      description: "Meta description for the Host page. Keep under ~160 characters.",
      validation: (Rule) => Rule.max(160),
    }),
  ],
});
