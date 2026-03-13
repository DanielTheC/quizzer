import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { Container } from "@/components/ui/Container";
import { getBlogPostBySlug, getBlogPosts, getSiteSettings } from "@/sanity/lib/fetch";
import { buildPageMetadata } from "@/sanity/lib/metadata";
import { urlFor } from "@/sanity/lib/image";
import { BlogBody } from "@/components/blog/BlogBody";
import { BlogCard } from "@/components/blog/BlogCard";
import type { BlogPostListItem } from "@/sanity/lib/types";

interface PageProps {
  params: Promise<{ slug: string }>;
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleDateString("en-GB", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  } catch {
    return "";
  }
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const [post, siteSettings] = await Promise.all([
    getBlogPostBySlug(slug),
    getSiteSettings(),
  ]);
  if (!post) {
    return { title: "Post not found" };
  }
  const base = buildPageMetadata({
    title: post.seoTitle ?? post.title ?? undefined,
    description: post.seoDescription ?? post.excerpt ?? undefined,
    siteSettings,
    fallbackTitle: post.title ?? "Blog post",
    fallbackDescription: post.excerpt ?? undefined,
  });
  return {
    ...base,
    alternates: {
      canonical: `/blog/${slug}`,
    },
  };
}

export async function generateStaticParams() {
  const slugs = await getBlogPosts().then((posts) =>
    posts.map((p) => p.slug).filter((s): s is string => Boolean(s))
  );
  return slugs.map((slug) => ({ slug }));
}

export default async function BlogPostPage({ params }: PageProps) {
  const { slug } = await params;
  const post = await getBlogPostBySlug(slug);
  if (!post) notFound();

  const allPosts = await getBlogPosts();
  const relatedPosts = allPosts
    .filter((p) => p._id !== post._id && (p.category?.slug === post.category?.slug || !post.category?.slug))
    .slice(0, 3) as BlogPostListItem[];

  const featuredImageUrl = post.featuredImage
    ? urlFor(post.featuredImage)?.width(1200).height(630).url()
    : null;
  const authorImageUrl = post.author?.image
    ? urlFor(post.author.image)?.width(80).height(80).url()
    : null;

  return (
    <article className="pb-16">
      <div className="bg-quizzer-yellow py-12 sm:py-16 border-b-[3px] border-quizzer-black">
        <Container>
          {post.category?.title && (
            <Link
              href="/blog"
              className="inline-block text-sm font-semibold text-quizzer-pink uppercase tracking-wide mb-2 hover:underline"
            >
              {post.category.title}
            </Link>
          )}
          <h1 className="font-heading text-3xl sm:text-4xl md:text-5xl font-normal text-quizzer-black mb-4">
            {post.title ?? "Untitled"}
          </h1>
          <p className="text-quizzer-black/80">
            {formatDate(post.publishedAt)}
          </p>
        </Container>
      </div>

      {featuredImageUrl && (
        <div className="relative w-full aspect-[1200/500] bg-quizzer-cream border-b-[3px] border-quizzer-black">
          <Image
            src={featuredImageUrl}
            alt={post.title ?? "Featured image"}
            fill
            className="object-cover"
            priority
            sizes="100vw"
          />
        </div>
      )}

      <Container className="pt-10 pb-12 max-w-[720px]">
        <BlogBody value={Array.isArray(post.body) ? post.body : undefined} />

        {post.author && (post.author.name || post.author.bio) && (
          <aside className="mt-12 pt-8 border-t-[3px] border-quizzer-black">
            <div className="flex gap-4 items-start">
              {authorImageUrl && (
                <div className="relative w-16 h-16 rounded-full overflow-hidden border-[3px] border-quizzer-black flex-shrink-0">
                  <Image
                    src={authorImageUrl}
                    alt={post.author.name ?? "Author"}
                    fill
                    className="object-cover"
                  />
                </div>
              )}
              <div>
                {post.author.name && (
                  <p className="font-heading text-lg text-quizzer-black">
                    {post.author.name}
                  </p>
                )}
                {post.author.role && (
                  <p className="text-sm text-quizzer-black/70">{post.author.role}</p>
                )}
                {post.author.bio && (
                  <p className="text-quizzer-black/80 mt-1">{post.author.bio}</p>
                )}
              </div>
            </div>
          </aside>
        )}

        {relatedPosts.length > 0 && (
          <section className="mt-16 pt-12 border-t-[3px] border-quizzer-black">
            <h2 className="font-heading text-2xl text-quizzer-black mb-6">
              Related posts
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
              {relatedPosts.map((p) => (
                <BlogCard key={p._id} post={p} />
              ))}
            </div>
          </section>
        )}
      </Container>
    </article>
  );
}
