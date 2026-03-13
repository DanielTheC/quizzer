import { defineType, defineField } from "sanity";

export const siteSettingsType = defineType({
  name: "siteSettings",
  title: "Site Settings",
  type: "document",
  description: "Global site branding, SEO defaults, and footer. Used in the header, footer, and as fallback for page metadata.",
  fields: [
    defineField({
      name: "siteTitle",
      title: "Site title",
      type: "string",
      description: "Brand name shown in the header and used in metadata.",
      initialValue: "Quizzer",
      validation: (Rule) => Rule.max(60),
    }),
    defineField({
      name: "defaultMetaTitle",
      title: "Default meta title",
      type: "string",
      description: "Fallback SEO title for pages that don’t set their own. Shown in browser tabs and search results.",
      initialValue: "Find Pub Quizzes Near You | Quizzer",
      validation: (Rule) => Rule.max(70),
    }),
    defineField({
      name: "defaultMetaDescription",
      title: "Default meta description",
      type: "text",
      rows: 2,
      description: "Fallback description for search engines. Keep under ~160 characters.",
      initialValue:
        "Discover pub quizzes near you, explore quiz nights across UK cities, and climb the leaderboard with Quizzer.",
      validation: (Rule) => Rule.max(160),
    }),
    defineField({
      name: "contactEmail",
      title: "Contact email",
      type: "string",
      description: "Shown on the Contact page and used for general enquiries.",
      initialValue: "hello@quizzerapp.co.uk",
    }),
    defineField({
      name: "socialLinks",
      title: "Social links",
      type: "array",
      description: "Optional. Add links to your social profiles if you want them in the footer or elsewhere.",
      of: [
        {
          type: "object",
          fields: [
            { name: "label", type: "string", title: "Label", description: "e.g. Twitter, Facebook" },
            { name: "url", type: "url", title: "URL" },
          ],
          preview: {
            select: { label: "label" },
            prepare: ({ label }) => ({ title: label || "Social link" }),
          },
        },
      ],
    }),
    defineField({
      name: "footerTagline",
      title: "Footer tagline",
      type: "string",
      description: "Short line under the logo in the footer.",
      initialValue: "Find. Play. Win.",
      validation: (Rule) => Rule.max(100),
    }),
    defineField({
      name: "footerCopyright",
      title: "Footer copyright",
      type: "string",
      description: "e.g. © 2025 Quizzer. All rights reserved. The year can be updated annually.",
      initialValue: "© 2025 Quizzer. All rights reserved.",
      validation: (Rule) => Rule.max(120),
    }),
  ],
});
