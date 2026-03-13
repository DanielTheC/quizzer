import imageUrlBuilder from "@sanity/image-url";
import { sanityClient } from "./client";

const builder = imageUrlBuilder(sanityClient);

/** Sanity image reference (asset or image object with _type and asset). */
type SanityImageSource = { _type?: string; asset?: { _ref?: string } } | null | undefined;

/**
 * Build a Sanity image URL for use in img src or next/image.
 * Returns undefined if source is missing so you can guard with optional chaining.
 */
export function urlFor(source: SanityImageSource) {
  if (!source) return undefined;
  return builder.image(source);
}
