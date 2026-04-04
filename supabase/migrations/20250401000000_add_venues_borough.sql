-- Optional short area label for player UI (e.g. London borough, town). Falls back to city in app if null.
ALTER TABLE venues
  ADD COLUMN IF NOT EXISTS borough text;

COMMENT ON COLUMN venues.borough IS 'Local area for compact UI (e.g. Walthamstow, Shoreditch). Prefer over full address when set.';
