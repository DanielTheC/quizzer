import Link from "next/link";
import Image from "next/image";
import type { BlogPostListItem } from "@/sanity/lib/types";
import { urlFor } from "@/sanity/lib/image";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";

interface BlogCardProps {
  post: BlogPostListItem;
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

export function BlogCard({ post }: BlogCardProps) {
  const slug = post.slug ?? "";
  const href = `/blog/${slug}`;
  const imageUrl = post.featuredImage
    ? urlFor(post.featuredImage)?.width(600).height(340).url()
    : null;

  return (
    <Card accent="bg-quizzer-white" className="h-full flex flex-col">
      {imageUrl && (
        <Link href={href} className="block mb-4 -m-6 mb-4 rounded-t-[9px] overflow-hidden border-b-[3px] border-quizzer-black">
          <div className="relative w-full aspect-[600/340] bg-quizzer-cream">
            <Image
              src={imageUrl}
              alt={post.title ?? "Blog post"}
              fill
              className="object-cover"
              sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
            />
          </div>
        </Link>
      )}
      <div className="flex-1 flex flex-col">
        {post.category?.title && (
          <p className="text-sm font-semibold text-quizzer-pink uppercase tracking-wide mb-1">
            {post.category.title}
          </p>
        )}
        <h2 className="font-heading text-xl font-normal text-quizzer-black mb-2 line-clamp-2">
          <Link href={href} className="text-quizzer-black hover:underline">
            {post.title ?? "Untitled"}
          </Link>
        </h2>
        {post.excerpt && (
          <p className="text-quizzer-black/80 text-sm mb-4 line-clamp-3 flex-1">
            {post.excerpt}
          </p>
        )}
        <p className="text-xs text-quizzer-black/60 mb-4">
          {formatDate(post.publishedAt)}
        </p>
        <Button href={href} variant="outline" size="sm">
          Read more
        </Button>
      </div>
    </Card>
  );
}
