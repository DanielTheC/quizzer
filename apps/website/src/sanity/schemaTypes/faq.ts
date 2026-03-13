import { defineType, defineField } from "sanity";

export const faqType = defineType({
  name: "faq",
  title: "FAQ",
  type: "document",
  description:
    "FAQ items shown on the /faq page (all categories) and on the Host page (category “Hosts” only). Use Order to control order.",
  fields: [
    defineField({
      name: "question",
      title: "Question",
      type: "string",
      description: "The question as shown to users. Keep it clear and concise.",
      validation: (Rule) => Rule.required().max(200),
    }),
    defineField({
      name: "answer",
      title: "Answer",
      type: "text",
      rows: 4,
      description: "The answer. Plain text is fine; avoid long paragraphs.",
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: "category",
      title: "Category",
      type: "string",
      description:
        "General: shown on /faq only. Players: for people finding/playing quizzes. Hosts: shown on /faq and on the Host a Quiz page.",
      options: {
        list: [
          { title: "General", value: "general" },
          { title: "Players", value: "players" },
          { title: "Hosts", value: "hosts" },
        ],
      },
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: "order",
      title: "Order",
      type: "number",
      description: "Lower numbers appear first. Use 0, 10, 20… so you can insert new ones easily.",
      initialValue: 0,
      validation: (Rule) => Rule.min(0).integer(),
    }),
  ],
  preview: {
    select: { question: "question", category: "category" },
    prepare: ({ question, category }) => ({
      title: question || "Untitled FAQ",
      subtitle: category ? `Category: ${category}` : "",
    }),
  },
  orderings: [
    { title: "Order (asc)", name: "orderAsc", by: [{ field: "order", direction: "asc" }] },
    { title: "Order (desc)", name: "orderDesc", by: [{ field: "order", direction: "desc" }] },
  ],
});
