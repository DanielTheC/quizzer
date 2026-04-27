BEGIN;

ALTER TABLE public.venues
  ADD COLUMN IF NOT EXISTS google_maps_url text;

COMMENT ON COLUMN public.venues.google_maps_url IS
  'Google Maps share URL for this venue. Opened directly by the mobile Maps button so users land on the actual business listing. Lat/lng are derived from this when the operator saves.';

ALTER TABLE public.venues
  ADD CONSTRAINT venues_google_maps_url_shape
  CHECK (google_maps_url IS NULL OR google_maps_url ~* '^https?://(maps\.app\.goo\.gl|goo\.gl/maps|(www\.)?google\.[a-z.]+/maps)');

COMMIT;
