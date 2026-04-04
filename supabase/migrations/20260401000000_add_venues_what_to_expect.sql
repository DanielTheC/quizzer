-- Player-facing venue copy for quiz detail ("What to expect"). Newline-separated lines render as bullets in the app.
ALTER TABLE venues
  ADD COLUMN IF NOT EXISTS what_to_expect text;

COMMENT ON COLUMN venues.what_to_expect IS 'Per-venue quiz night description for players; use line breaks for separate bullet points.';
