-- Links Supabase auth users to venues they manage (publican / multi-venue operators).
-- Row visibility: each user only sees their own links. is_publican() mirrors is_allowlisted_host().

CREATE TABLE IF NOT EXISTS public.publican_venues (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  venue_id uuid NOT NULL REFERENCES public.venues (id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, venue_id)
);

COMMENT ON TABLE public.publican_venues IS 'Maps auth users to venues they manage on the publican portal; managed via service role or SQL.';

CREATE INDEX IF NOT EXISTS idx_publican_venues_user_id ON public.publican_venues (user_id);
CREATE INDEX IF NOT EXISTS idx_publican_venues_venue_id ON public.publican_venues (venue_id);

ALTER TABLE public.publican_venues ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Publicans read own venue links"
  ON public.publican_venues
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Publicans insert own venue links"
  ON public.publican_venues
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Publicans update own venue links"
  ON public.publican_venues
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Publicans delete own venue links"
  ON public.publican_venues
  FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.is_publican()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.publican_venues pv
    WHERE pv.user_id = auth.uid()
  );
$$;

COMMENT ON FUNCTION public.is_publican() IS 'True if the current user has at least one venue link in publican_venues.';

REVOKE ALL ON FUNCTION public.is_publican() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_publican() TO anon;
GRANT EXECUTE ON FUNCTION public.is_publican() TO authenticated;
