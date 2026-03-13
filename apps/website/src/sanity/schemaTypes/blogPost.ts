import { defineType, defineField } from "sanity";

export const blogPostType = defineType({
  name: "blogPost",
  title: "Blog post",
  type: "document",
  description: "A single blog post. Set slug, publish date, and Publish when ready to show on the site.",
  groups: [
    { name: "content", title: "Content", default: true },
    { name: "seo", title: "SEO" },
    { name: "settings", title: "Settings" },
  ],
  fields: [
    defineField({
      name: "title",
      title: "Title",
      type: "string",
      group: "content",
      description: "Main headline. Keep it clear and engaging.",
      validation: (Rule) => Rule.required().max(100),
    }),
    defineField({
      name: "slug",
      title: "Slug",
      type: "slug",
      group: "content",
      options: {
        source: "title",
        slugify: (input: string) =>
          input
            .toLowerCase()
            .trim()
            .replace(/\s+/g, "-")
            .replace(/[^\w-]+/g, ""),
      },
      description: "URL path (e.g. /blog/my-first-post). Generate from title then edit if needed.",
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: "excerpt",
      title: "Excerpt",
      type: "text",
      group: "content",
      rows: 3,
      description: "Short summary for cards and search results. One or two sentences.",
      validation: (Rule) => Rule.max(300),
    }),
    defineField({
      name: "publishedAt",
      title: "Publish date",
      type: "datetime",
      group: "content",
      description: "When the post was (or will be) published. Used for ordering and display.",
      validation: (Rule) => Rule.required(),
      initialValue: () => new Date().toISOString(),
    }),
    defineField({
      name: "featuredImage",
      title: "Featured image",
      type: "image",
      group: "content",
      description: "Main image for the post and listing cards. Recommend 1200×630px for best display.",
      options: { hotspot: true },
      fields: [
        {
          name: "alt",
          type: "string",
          title: "Alt text",
          description: "Describe the image for accessibility.",
        },
      ],
    }),
    defineField({
      name: "body",
      title: "Body",
      type: "blockContent",
      group: "content",
      description: "Main post content. Use headings, lists, and links as needed.",
    }),
    defineField({
      name: "category",
      title: "Category",
      type: "reference",
      group: "content",
      to: [{ type: "blogCategory" }],
      description: "Category for this post (e.g. Tips, News). Create categories under Blog → Categories first.",
    }),
    defineField({
      name: "author",
      title: "Author",
      type: "reference",
      group: "content",
      to: [{ type: "blogAuthor" }],
      description: "Optional. Create authors under Blog → Authors first.",
    }),
    defineField({
      name: "featured",
      title: "Featured",
      type: "boolean",
      group: "settings",
      description: "Show this post in the featured section on the blog listing page.",
      initialValue: false,
    }),
    defineField({
      name: "seoTitle",
      title: "SEO title",
      type: "string",
      group: "seo",
      description: "Page title for search results. Leave blank to use the post title.",
      validation: (Rule) => Rule.max(70),
    }),
    defineField({
      name: "seoDescription",
      title: "SEO description",
      type: "text",
      group: "seo",
      rows: 2,
      description: "Meta description for search results. Leave blank to use the excerpt. Keep under ~160 characters.",
      validation: (Rule) => Rule.max(160),
    }),
  ],
  preview: {
    select: {
      title: "title",
      slug: "slug.current",
      publishedAt: "publishedAt",
      featured: "featured",
    },
    prepare: ({ title, slug, publishedAt, featured }) => {
      const date = publishedAt ? new Date(publishedAt).toLocaleDateString("en-GB") : "";
      return {
        title: title || "Untitled post",
        subtitle: [slug && `/blog/${slug}`, date, featured ? "★ Featured" : ""].filter(Boolean).join(" · "),
      };
    },
  },
  orderings: [
    { title: "Publish date (newest)", name: "publishedAtDesc", by: [{ field: "publishedAt", direction: "desc" }] },
    { title: "Publish date (oldest)", name: "publishedAtAsc", by: [{ field: "publishedAt", direction: "asc" }] },
    { title: "Title A–Z", name: "titleAsc", by: [{ field: "title", direction: "asc" }] },
  ],
});
