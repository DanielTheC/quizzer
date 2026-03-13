export type Venue = {
    id: string;
    name: string;
    address: string;
    postcode: string | null;
    city: string | null;
    lat: number | null;
    lng: number | null;
  };
  
  export type QuizEvent = {
    id: string;
    day_of_week: number;
    start_time: string;
    entry_fee_pence: number;
    fee_basis: string;
    prize: string;
    is_active: boolean;
    venue_id: string;
  };
  