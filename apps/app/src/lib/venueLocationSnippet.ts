/** Fields needed for a short location label after the venue name (matches quiz detail header). */
export type VenueLocationFields = {
  postcode?: string | null;
  borough?: string | null;
  city?: string | null;
};

/** Outward postcode (e.g. WC2N) when present; otherwise borough / city. */
export function postcodeOutwardOrArea(venue: VenueLocationFields | null | undefined): string {
  if (!venue) return "";
  const pc = venue.postcode?.trim().replace(/\s+/g, " ").toUpperCase();
  if (pc) {
    const m = pc.match(/^([A-Z]{1,2}\d[A-Z\d]?)/);
    if (m?.[1]) return m[1];
    return pc;
  }
  const b = venue.borough?.trim();
  if (b) return b;
  const c = venue.city?.trim();
  return c ?? "";
}
