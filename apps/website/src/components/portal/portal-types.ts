export type PortalVenueLink = {
  id: string;
  venueId: string;
  venueName: string;
};

export function mapPublicanVenueRows(data: unknown): PortalVenueLink[] {
  if (!Array.isArray(data)) return [];
  const out: PortalVenueLink[] = [];
  for (const row of data) {
    if (!row || typeof row !== "object") continue;
    const r = row as Record<string, unknown>;
    const id = r.id;
    const venueId = r.venue_id;
    const venues = r.venues;
    let venueName = "Venue";
    if (venues && typeof venues === "object" && !Array.isArray(venues)) {
      const n = (venues as { name?: unknown }).name;
      if (typeof n === "string" && n.trim()) venueName = n.trim();
    }
    if (typeof id === "string" && typeof venueId === "string") {
      out.push({ id, venueId, venueName });
    }
  }
  return out;
}
