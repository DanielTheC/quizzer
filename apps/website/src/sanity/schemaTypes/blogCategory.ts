import { defineType, defineField } from "sanity";

export const blogCategoryType = defineType({
  name: "blogCategory",
  title: "Blog category",
  type: "document",
  description: "Categories for grouping blog posts (e.g. Tips, News, Venue spotlights).",
  fields: [
    defineField({
      name: "title",
      title: "Title",
      type: "string",
      description: "Display name (e.g. Quiz Tips, News).",
      validation: (Rule) => Rule.required().max(60),
    }),
    defineField({
      name: "slug",
      title: "Slug",
      type: "slug",
      options: {
        source: "title",
        slugify: (input: string) =>
          input
            .toLowerCase()
            .trim()
            .replace(/\s+/g, "-")
            .replace(/[^\w-]+/g, ""),
      },
      description: "URL-friendly identifier. Generate from title.",
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: "description",
      title: "Description",
      type: "text",
      rows: 2,
      description: "Optional short description of this category.",
      validation: (Rule) => Rule.max(160),
    }),
  ],
  preview: {
    select: { title: "title", slug: "slug.current" },
    prepare: ({ title, slug }) => ({
      title: title || "Untitled category",
      subtitle: slug ? slug : "",
    }),
  },
});
