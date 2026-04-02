import { defineConfig } from "sanity";
import { structureTool } from "sanity/structure";
import { visionTool } from "@sanity/vision";
import { schemaTypes } from "./sanity/schemaTypes";

const projectId = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID ?? "";
const dataset = process.env.NEXT_PUBLIC_SANITY_DATASET ?? "production";

export default defineConfig({
  name: "quizzer-website",
  title: "Quizzer CMS",
  projectId,
  dataset,
  basePath: "/studio",
  plugins: [
    structureTool({
      structure: (S) =>
        S.list()
          .title("Content")
          .items([
            S.listItem()
              .title("Site settings")
              .child(S.document().schemaType("siteSettings").documentId("siteSettings")),
            S.listItem()
              .title("Home page")
              .child(S.document().schemaType("homePage").documentId("homePage")),
            S.listItem()
              .title("Host page")
              .child(S.document().schemaType("hostPage").documentId("hostPage")),
            S.divider(),
            S.listItem()
              .title("Cities")
              .child(S.documentTypeList("city").title("Cities")),
            S.listItem()
              .title("Quiz pages")
              .child(S.documentTypeList("quizPage").title("Quiz pages")),
            S.listItem()
              .title("FAQs")
              .child(S.documentTypeList("faq").title("FAQs")),
            S.listItem()
              .title("Pages")
              .child(S.documentTypeList("page").title("Pages")),
            S.divider(),
            S.listItem()
              .title("Blog")
              .child(
                S.list()
                  .title("Blog")
                  .items([
                    S.listItem()
                      .title("Posts")
                      .child(S.documentTypeList("blogPost").title("Blog posts")),
                    S.listItem()
                      .title("Categories")
                      .child(S.documentTypeList("blogCategory").title("Blog categories")),
                    S.listItem()
                      .title("Authors")
                      .child(S.documentTypeList("blogAuthor").title("Blog authors")),
                  ])
              ),
          ]),
    }),
    visionTool({ defaultApiVersion: "2024-01-01" }),
  ],
  schema: { types: schemaTypes },
});
