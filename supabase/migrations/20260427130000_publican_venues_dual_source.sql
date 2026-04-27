BEGIN;

-- publican_venue_quiz_interest_counts is legacy but still used by portal
-- paths. Keep its exact return shape while accepting both current
-- publican_profiles users and legacy publican_venues users.
CREATE OR REPLACE FUNCTION public.publican_venue_quiz_interest_counts(
  p_venue_id uuid
) RETURNS TABLE (
  quiz_event_id uuid,
  interest_count bigint
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH guard AS (
    SELECT (
      EXISTS (
        SELECT 1 FROM public.publican_profiles pp
        WHERE pp.id = auth.uid() AND pp.venue_id = p_venue_id
      )
      OR EXISTS (
        SELECT 1 FROM public.publican_venues pv
        WHERE pv.user_id = auth.uid() AND pv.venue_id = p_venue_id
      )
    ) AS allowed
  )
  SELECT q.id,
         (SELECT count(*)::bigint FROM public.quiz_event_interests i
           WHERE i.quiz_event_id = q.id)
    FROM public.quiz_events q, guard
   WHERE q.venue_id = p_venue_id
     AND q.is_active = true
     AND guard.allowed;
$$;

REVOKE ALL ON FUNCTION public.publican_venue_quiz_interest_counts(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.publican_venue_quiz_interest_counts(uuid) TO authenticated;

COMMIT;
