import { defineType, defineField } from "sanity";

/**
 * Editorial layer for /find-a-quiz/quiz/[id].
 * Quiz times, venue, entry and prize still come from Supabase; this document overrides hero/SEO and adds long-form copy.
 */
export const quizPageType = defineType({
  name: "quizPage",
  title: "Quiz page",
  type: "document",
  description:
    "Content for an individual quiz URL. Set Quiz event ID to the Supabase quiz_events.id (same value as in the website URL).",
  fields: [
    defineField({
      name: "quizEventId",
      title: "Quiz event ID",
      type: "string",
      description: "UUID from Supabase table quiz_events.id. Must match the ID in /find-a-quiz/quiz/[this-id].",
      validation: (Rule) =>
        Rule.required().min(1).max(80).warning("Use the exact quiz_events.id from Supabase (UUID), or the mock id in local data."),
    }),
    defineField({
      name: "enabled",
      title: "Enabled",
      type: "boolean",
      description: "Turn off to hide all Sanity content on the live site (page still works from database only).",
      initialValue: true,
    }),
    defineField({
      name: "heroTitle",
      title: "Hero title",
      type: "string",
      description: "Optional. Replaces the venue name in the yellow hero. Leave empty to use the venue name from the database.",
      validation: (Rule) => Rule.max(100),
    }),
    defineField({
      name: "heroSubtitle",
      title: "Hero subtitle",
      type: "text",
      rows: 2,
      description:
        "Optional. Replaces the line under the title (default: area · day · time from the database).",
    }),
    defineField({
      name: "body",
      title: "Page body",
      type: "blockContent",
      description: "Optional rich text shown below the quiz details card.",
    }),
    defineField({
      name: "seoTitle",
      title: "SEO title",
      type: "string",
      description: "Optional. Page title for search results.",
      validation: (Rule) => Rule.max(70),
    }),
    defineField({
      name: "seoDescription",
      title: "SEO description",
      type: "text",
      rows: 2,
      description: "Optional meta description (~160 characters).",
      validation: (Rule) => Rule.max(160),
    }),
  ],
  preview: {
    select: { title: "heroTitle", id: "quizEventId", enabled: "enabled" },
    prepare: ({ title, id, enabled }) => ({
      title: title?.trim() || id || "Quiz page",
      subtitle: id ? `${id}${enabled === false ? " (disabled)" : ""}` : "",
    }),
  },
});
