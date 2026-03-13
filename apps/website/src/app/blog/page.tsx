import type { Metadata } from "next";
import { Container } from "@/components/ui/Container";
import { PageHero } from "@/components/ui/PageHero";
import { getBlogPosts, getFeaturedBlogPosts } from "@/sanity/lib/fetch";
import { BlogCard } from "@/components/blog/BlogCard";

export const metadata: Metadata = {
  title: "Blog",
  description:
    "News, tips, and stories from Quizzer. Pub quiz nights, hosting advice, and more.",
  alternates: {
    canonical: "/blog",
  },
};

export default async function BlogPage() {
  const [featured, allPosts] = await Promise.all([
    getFeaturedBlogPosts(),
    getBlogPosts(),
  ]);

  const featuredIds = new Set(featured.map((p) => p._id));
  const remainingPosts = allPosts.filter((p) => !featuredIds.has(p._id));

  return (
    <>
      <PageHero
        title="Blog"
        description="News, tips, and stories from the world of pub quizzes. Hosting advice, quiz night round-ups, and more."
        background="yellow"
      />

      {featured.length > 0 && (
        <section className="py-12 sm:py-16 bg-quizzer-cream border-b-[3px] border-quizzer-black">
          <Container>
            <h2 className="font-heading text-2xl sm:text-3xl text-quizzer-black mb-6">
              Featured
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {featured.map((post) => (
                <BlogCard key={post._id} post={post} />
              ))}
            </div>
          </Container>
        </section>
      )}

      <section className="py-12 sm:py-16 bg-quizzer-white">
        <Container>
          <h2 className="font-heading text-2xl sm:text-3xl text-quizzer-black mb-6">
            All posts
          </h2>
          {remainingPosts.length === 0 && featured.length === 0 ? (
            <p className="text-quizzer-black/80">
              No blog posts yet. Check back soon.
            </p>
          ) : remainingPosts.length === 0 ? (
            <p className="text-quizzer-black/80">
              More posts coming soon.
            </p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {remainingPosts.map((post) => (
                <BlogCard key={post._id} post={post} />
              ))}
            </div>
          )}
        </Container>
      </section>
    </>
  );
}
