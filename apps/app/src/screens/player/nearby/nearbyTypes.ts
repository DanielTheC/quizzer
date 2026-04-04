export type LocationPermissionStatus = "granted" | "denied" | "undetermined";

export type Venue = {
  name: string;
  address: string;
  postcode?: string | null;
  city?: string | null;
  lat?: number | null;
  lng?: number | null;
};

export type QuizEvent = {
  id: string;
  day_of_week: number;
  start_time: string;
  entry_fee_pence: number;
  prize: string;
  venues: Venue | null;
  /** From list query embed; omit if unavailable. */
  interest_count?: number;
};

export const PRIZE_OPTIONS = ["all", "cash", "bar_tab", "drinks", "voucher", "other"] as const;
export type PrizeFilter = (typeof PRIZE_OPTIONS)[number];

export const DISTANCE_MILES = [1, 3, 5, 10] as const;
export type DistanceFilter = (typeof DISTANCE_MILES)[number] | null;
