export type PortalVenueLink = {
  id: string;
  venueId: string;
  venueName: string;
};

/** Single-venue link from `publican_profiles` + nested `venues` row. */
export function venueLinksFromPublicanProfile(
  profile: {
    venue_id: string;
    venues: { name?: string | null } | { name?: string | null }[] | null;
  } | null
): PortalVenueLink[] {
  if (!profile?.venue_id) return [];
  let venueName = "Venue";
  const v = profile.venues;
  if (Array.isArray(v)) {
    const first = v[0];
    if (first && typeof first === "object") {
      const n = first.name;
      if (typeof n === "string" && n.trim()) venueName = n.trim();
    }
  } else if (v && typeof v === "object") {
    const n = v.name;
    if (typeof n === "string" && n.trim()) venueName = n.trim();
  }
  const id = profile.venue_id;
  return [{ id, venueId: id, venueName }];
}

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
