-- Defensive: ensure RLS is enabled on venues.
-- ALTER TABLE ... ENABLE ROW LEVEL SECURITY is idempotent — safe to run even if already enabled.
ALTER TABLE IF EXISTS public.venues ENABLE ROW LEVEL SECURITY;
