/**
 * UK postcode geocoding via postcodes.io (free, no API key).
 * Docs: https://postcodes.io/
 */

const BASE = "https://api.postcodes.io/postcodes";

function normalizePostcode(postcode: string): string {
  return postcode.trim().toUpperCase().replace(/\s+/g, "");
}

export type LatLng = { lat: number; lng: number };

export async function geocodeUkPostcode(postcode: string): Promise<LatLng | null> {
  const normalized = normalizePostcode(postcode);
  if (!normalized.length) return null;

  try {
    const res = await fetch(`${BASE}/${encodeURIComponent(normalized)}`);
    const json = await res.json();
    if (json.status !== 200 || !json.result) return null;
    const { latitude, longitude } = json.result;
    if (latitude == null || longitude == null) return null;
    return { lat: Number(latitude), lng: Number(longitude) };
  } catch {
    return null;
  }
}
