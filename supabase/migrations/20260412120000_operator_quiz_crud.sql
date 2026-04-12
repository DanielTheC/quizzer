-- Operator CRUD on venues and quiz_events for admin quiz/venue forms.

-- venues: operators need full CRUD
DROP POLICY IF EXISTS "Operators read all venues" ON public.venues;
CREATE POLICY "Operators read all venues"
  ON public.venues
  FOR SELECT
  TO authenticated
  USING (public.is_operator());

DROP POLICY IF EXISTS "Operators insert venues" ON public.venues;
CREATE POLICY "Operators insert venues"
  ON public.venues
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_operator());

DROP POLICY IF EXISTS "Operators update venues" ON public.venues;
CREATE POLICY "Operators update venues"
  ON public.venues
  FOR UPDATE
  TO authenticated
  USING (public.is_operator())
  WITH CHECK (public.is_operator());

DROP POLICY IF EXISTS "Operators delete venues" ON public.venues;
CREATE POLICY "Operators delete venues"
  ON public.venues
  FOR DELETE
  TO authenticated
  USING (public.is_operator());

-- quiz_events: operators need full CRUD
-- (SELECT policy already exists in 20260411100000_admin_triage.sql)
DROP POLICY IF EXISTS "Operators insert quiz events" ON public.quiz_events;
CREATE POLICY "Operators insert quiz events"
  ON public.quiz_events
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_operator());

DROP POLICY IF EXISTS "Operators update quiz events" ON public.quiz_events;
CREATE POLICY "Operators update quiz events"
  ON public.quiz_events
  FOR UPDATE
  TO authenticated
  USING (public.is_operator())
  WITH CHECK (public.is_operator());

DROP POLICY IF EXISTS "Operators delete quiz events" ON public.quiz_events;
CREATE POLICY "Operators delete quiz events"
  ON public.quiz_events
  FOR DELETE
  TO authenticated
  USING (public.is_operator());
