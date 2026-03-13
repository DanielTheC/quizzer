/** Quiz listing item – matches mobile app + SEO needs */
export interface Quiz {
  id: string;
  venueName: string;
  slug: string;
  area: string;
  city: string;
  day: string;
  time: string;
  entryFee: string;
  prize: string;
  tags: string[];
}

/** City for find-a-quiz */
export interface City {
  slug: string;
  name: string;
  description: string;
}
