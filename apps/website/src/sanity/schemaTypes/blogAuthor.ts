import { defineType, defineField } from "sanity";

export const blogAuthorType = defineType({
  name: "blogAuthor",
  title: "Blog author",
  type: "document",
  description: "Author profile for blog posts. Create authors once and reference them on posts.",
  fields: [
    defineField({
      name: "name",
      title: "Name",
      type: "string",
      description: "Full name as it appears on the site.",
      validation: (Rule) => Rule.required().max(80),
    }),
    defineField({
      name: "slug",
      title: "Slug",
      type: "slug",
      options: {
        source: "name",
        slugify: (input: string) =>
          input
            .toLowerCase()
            .trim()
            .replace(/\s+/g, "-")
            .replace(/[^\w-]+/g, ""),
      },
      description: "URL-friendly identifier. Generate from name (e.g. jane-doe).",
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: "role",
      title: "Role",
      type: "string",
      description: "Job title or role (e.g. Content Lead, Quizzer Team).",
      validation: (Rule) => Rule.max(60),
    }),
    defineField({
      name: "bio",
      title: "Bio",
      type: "text",
      rows: 3,
      description: "Short bio shown on the post. One or two sentences.",
      validation: (Rule) => Rule.max(300),
    }),
    defineField({
      name: "image",
      title: "Image",
      type: "image",
      description: "Author photo. Square or portrait works best; recommend at least 200×200px.",
      options: { hotspot: true },
    }),
  ],
  preview: {
    select: { name: "name", slug: "slug.current" },
    prepare: ({ name, slug }) => ({
      title: name || "Untitled author",
      subtitle: slug ? `/${slug}` : "",
    }),
  },
});
