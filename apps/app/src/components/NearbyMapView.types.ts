export type VenueLite = {
  name?: string | null;
  lat?: number | null;
  lng?: number | null;
};

export type MapQuizPin = {
  id: string;
  venues: VenueLite | null;
};
