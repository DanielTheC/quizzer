-- Public reads: active listings (website + apps). Publicans: read all rows for venues they manage (incl. inactive / cancelled for ops).

ALTER TABLE public.quiz_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "quiz_events_select_active_public" ON public.quiz_events;
CREATE POLICY "quiz_events_select_active_public"
  ON public.quiz_events
  FOR SELECT
  TO anon, authenticated
  USING (is_active = true);

DROP POLICY IF EXISTS "quiz_events_select_publican_managed_venue" ON public.quiz_events;
CREATE POLICY "quiz_events_select_publican_managed_venue"
  ON public.quiz_events
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.publican_venues pv
      WHERE pv.user_id = auth.uid()
        AND pv.venue_id = quiz_events.venue_id
    )
  );

COMMENT ON POLICY "quiz_events_select_active_public" ON public.quiz_events IS
  'Find-a-quiz and player apps: active events only.';
COMMENT ON POLICY "quiz_events_select_publican_managed_venue" ON public.quiz_events IS
  'Publican portal: full schedule rows for linked venues (RLS scoped by publican_venues).';

-- Interest totals for portal dashboard (RLS hides other users interests from direct SELECT).
CREATE OR REPLACE FUNCTION public.publican_venue_quiz_interest_counts(p_venue_id uuid)
RETURNS TABLE (quiz_event_id uuid, interest_count bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    q.id,
    (SELECT count(*)::bigint FROM public.quiz_event_interests i WHERE i.quiz_event_id = q.id)
  FROM public.quiz_events q
  WHERE q.venue_id = p_venue_id
    AND q.is_active = true
    AND EXISTS (
      SELECT 1
      FROM public.publican_venues pv
      WHERE pv.user_id = auth.uid()
        AND pv.venue_id = p_venue_id
    );
$$;

COMMENT ON FUNCTION public.publican_venue_quiz_interest_counts(uuid) IS
  'Per-event interest counts for publican portal; caller must manage p_venue_id via publican_venues.';

REVOKE ALL ON FUNCTION public.publican_venue_quiz_interest_counts(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.publican_venue_quiz_interest_counts(uuid) TO authenticated;
