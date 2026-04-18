-- Allow public (anon + authenticated) read access to venues.
-- The quiz_events → venues join requires this for the website find-a-quiz page.
CREATE POLICY "venues_select_public"
  ON public.venues
  FOR SELECT
  TO anon, authenticated
  USING (true);
