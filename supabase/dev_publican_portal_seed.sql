-- Dev / staging only: one test venue + quiz slot + publican_venues link for the portal.
-- Not a migration — run manually: Supabase → SQL Editor → paste → Run.
--
-- Before running:
--   1) Replace REPLACE_WITH_YOUR_AUTH_USER_UUID with your Auth user id (Authentication → Users).
--   2) If an INSERT fails (unknown column / NOT NULL), open Table Editor → venues / quiz_events →
--      Insert row once to see required fields, then adjust the INSERTs below.

BEGIN;

-- 1) Test venue (must exist before publican_venues).
INSERT INTO public.venues (
  id,
  name,
  address,
  city,
  postcode,
  lat,
  lng
)
VALUES (
  'b0000000-0000-4000-8000-000000000101'::uuid,
  'Dev seed pub',
  '10 Seed Street',
  'London',
  'E1 1AA',
  51.5155,
  -0.072
)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  address = EXCLUDED.address,
  city = EXCLUDED.city,
  postcode = EXCLUDED.postcode,
  lat = EXCLUDED.lat,
  lng = EXCLUDED.lng;

-- 2) One active weekly quiz (portal schedule page).
--    prize is enum prize_type (e.g. cash, bar_tab, drinks, voucher, other) — not free text.
INSERT INTO public.quiz_events (
  id,
  venue_id,
  day_of_week,
  start_time,
  entry_fee_pence,
  fee_basis,
  prize,
  is_active
)
VALUES (
  'b0000000-0000-4000-8000-000000000102'::uuid,
  'b0000000-0000-4000-8000-000000000101'::uuid,
  3, -- Wednesday (Postgres DOW: 0 = Sunday)
  '20:00:00',
  200,
  'per_person',
  'voucher'::public.prize_type,
  true
)
ON CONFLICT (id) DO UPDATE SET
  venue_id = EXCLUDED.venue_id,
  day_of_week = EXCLUDED.day_of_week,
  start_time = EXCLUDED.start_time,
  entry_fee_pence = EXCLUDED.entry_fee_pence,
  fee_basis = EXCLUDED.fee_basis,
  prize = EXCLUDED.prize,
  is_active = EXCLUDED.is_active;

-- 3) Link YOUR login to this venue (replace placeholder).
INSERT INTO public.publican_venues (user_id, venue_id)
VALUES (
  'REPLACE_WITH_YOUR_AUTH_USER_UUID'::uuid,
  'b0000000-0000-4000-8000-000000000101'::uuid
)
ON CONFLICT (user_id, venue_id) DO NOTHING;

COMMIT;
