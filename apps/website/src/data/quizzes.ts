import type { Quiz, City } from "./types";
import { fetchQuizzesFromSupabase } from "@/lib/quizzes";

/** Static city list (used for navigation; counts can come from Supabase) */
export const quizzes: Quiz[] = [
  {
    id: "1",
    venueName: "The Crown & Anchor",
    slug: "crown-anchor-london",
    area: "Soho",
    city: "london",
    day: "Tuesday",
    time: "8:00 PM",
    entryFee: "£2",
    prize: "£50 bar tab",
    tags: ["General knowledge", "Music", "Picture round"],
  },
  {
    id: "2",
    venueName: "The Duke of Wellington",
    slug: "duke-wellington-london",
    area: "Shoreditch",
    city: "london",
    day: "Wednesday",
    time: "7:30 PM",
    entryFee: "£3",
    prize: "£100 cash",
    tags: ["General knowledge", "Sport"],
  },
  {
    id: "3",
    venueName: "The Red Lion",
    slug: "red-lion-london",
    area: "Camden",
    city: "london",
    day: "Thursday",
    time: "8:00 PM",
    entryFee: "Free",
    prize: "Drinks voucher",
    tags: ["General knowledge", "Film"],
  },
  {
    id: "4",
    venueName: "The Old Crown",
    slug: "old-crown-birmingham",
    area: "Digbeth",
    city: "birmingham",
    day: "Monday",
    time: "7:30 PM",
    entryFee: "£2",
    prize: "£30 bar tab",
    tags: ["General knowledge"],
  },
  {
    id: "5",
    venueName: "The Victoria",
    slug: "victoria-birmingham",
    area: "Jewellery Quarter",
    city: "birmingham",
    day: "Wednesday",
    time: "8:00 PM",
    entryFee: "£2.50",
    prize: "£50",
    tags: ["Music", "Picture round"],
  },
  {
    id: "6",
    venueName: "The Briton's Protection",
    slug: "britons-protection-manchester",
    area: "City Centre",
    city: "manchester",
    day: "Tuesday",
    time: "8:00 PM",
    entryFee: "£2",
    prize: "Bar tab",
    tags: ["General knowledge", "Sport"],
  },
  {
    id: "7",
    venueName: "The Blue Lagoon",
    slug: "blue-lagoon-glasgow",
    area: "West End",
    city: "glasgow",
    day: "Thursday",
    time: "7:30 PM",
    entryFee: "£3",
    prize: "£75",
    tags: ["General knowledge", "Music"],
  },
  {
    id: "8",
    venueName: "The Banshee Labyrinth",
    slug: "banshee-edinburgh",
    area: "Old Town",
    city: "edinburgh",
    day: "Sunday",
    time: "8:00 PM",
    entryFee: "Free",
    prize: "Drinks",
    tags: ["General knowledge", "Film", "Picture round"],
  },
];

export const cities: City[] = [
  { slug: "london", name: "London", description: "Find pub quizzes across London." },
  { slug: "birmingham", name: "Birmingham", description: "Quiz nights in Birmingham." },
  { slug: "manchester", name: "Manchester", description: "Pub quizzes in Manchester." },
  { slug: "glasgow", name: "Glasgow", description: "Quiz nights in Glasgow." },
  { slug: "edinburgh", name: "Edinburgh", description: "Pub quizzes in Edinburgh." },
];

export function getQuizzesByCity(citySlug: string): Quiz[] {
  return quizzes.filter((q) => q.city === citySlug);
}

export function getFeaturedQuizzes(limit = 3): Quiz[] {
  return quizzes.slice(0, limit);
}

/**
 * Get quizzes for the website: from Supabase if configured, otherwise static data.
 */
export async function getQuizzesForSite(): Promise<Quiz[]> {
  const fromSupabase = await fetchQuizzesFromSupabase();
  if (fromSupabase.length > 0) return fromSupabase;
  return quizzes;
}

/**
 * Get quizzes for a city: from Supabase if configured, otherwise static data.
 */
export async function getQuizzesForCity(citySlug: string): Promise<Quiz[]> {
  const fromSupabase = await fetchQuizzesFromSupabase();
  if (fromSupabase.length > 0) {
    return fromSupabase.filter((q) => q.city === citySlug);
  }
  return getQuizzesByCity(citySlug);
}
