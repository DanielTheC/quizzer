import { sanityClient, isSanityConfigured } from "./client";
import {
  SITE_SETTINGS_QUERY,
  HOME_PAGE_QUERY,
  HOST_PAGE_QUERY,
  CITY_BY_SLUG_QUERY,
  ALL_FAQS_QUERY,
} from "./queries";
import type {
  SiteSettings,
  HomePage,
  HostPage,
  CityDocument,
  FaqDocument,
} from "./types";

export async function getSiteSettings(): Promise<SiteSettings | null> {
  if (!isSanityConfigured()) return null;
  try {
    return await sanityClient.fetch<SiteSettings | null>(SITE_SETTINGS_QUERY, {}, { next: { revalidate: 60 } });
  } catch {
    return null;
  }
}

export async function getHomePage(): Promise<HomePage | null> {
  if (!isSanityConfigured()) return null;
  try {
    return await sanityClient.fetch<HomePage | null>(HOME_PAGE_QUERY, {}, { next: { revalidate: 60 } });
  } catch {
    return null;
  }
}

export async function getHostPage(): Promise<HostPage | null> {
  if (!isSanityConfigured()) return null;
  try {
    return await sanityClient.fetch<HostPage | null>(HOST_PAGE_QUERY, {}, { next: { revalidate: 60 } });
  } catch {
    return null;
  }
}

export async function getCityBySlug(slug: string): Promise<CityDocument | null> {
  if (!isSanityConfigured()) return null;
  try {
    return await sanityClient.fetch<CityDocument | null>(CITY_BY_SLUG_QUERY, { slug }, { next: { revalidate: 60 } });
  } catch {
    return null;
  }
}

export async function getAllFaqs(): Promise<FaqDocument[] | null> {
  if (!isSanityConfigured()) return null;
  try {
    return await sanityClient.fetch<FaqDocument[] | null>(ALL_FAQS_QUERY, {}, { next: { revalidate: 60 } });
  } catch {
    return null;
  }
}
