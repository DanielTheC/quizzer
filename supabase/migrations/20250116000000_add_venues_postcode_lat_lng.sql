-- Add postcode, lat, lng to venues for distance filtering (UK).
-- Safe to run: columns only added if missing.

ALTER TABLE venues
  ADD COLUMN IF NOT EXISTS postcode text,
  ADD COLUMN IF NOT EXISTS lat double precision,
  ADD COLUMN IF NOT EXISTS lng double precision;

COMMENT ON COLUMN venues.postcode IS 'UK postcode (e.g. SW1A 1AA) for geocoding';
COMMENT ON COLUMN venues.lat IS 'Latitude (WGS84) from geocoding';
COMMENT ON COLUMN venues.lng IS 'Longitude (WGS84) from geocoding';

-- Backfill guidance (run after migration):
-- 1. Ensure each venue has a postcode set (UK format).
-- 2. Geocode postcodes to lat/lng (e.g. GET https://api.postcodes.io/postcodes/{postcode}).
-- 3. UPDATE venues SET lat = ..., lng = ... WHERE id = ...;
-- Example script (Node): for each venue with postcode, call postcodes.io, then UPDATE venues SET lat = res.latitude, lng = res.longitude WHERE id = venue_id;
