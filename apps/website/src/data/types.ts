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
  /** Venue coordinates (for client-side distance). */
  lat?: number;
  lng?: number;
  /** Distance in miles from user (set when location available). */
  distance?: number;
  /** Venue address lines (detail page). */
  address?: string;
  postcode?: string;
}

/** City for find-a-quiz */
export interface City {
  slug: string;
  name: string;
  description: string;
}
