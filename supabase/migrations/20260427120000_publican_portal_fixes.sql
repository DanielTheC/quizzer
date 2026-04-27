BEGIN;

-- 1. Repoint publican_messages INSERT policy from publican_venues to
--    publican_profiles. Publicans created via the admin invite flow have
--    a publican_profiles row keyed by auth.uid().

DROP POLICY IF EXISTS "Publicans insert messages for managed venues"
  ON public.publican_messages;

CREATE POLICY "Publicans insert messages for managed venues"
  ON public.publican_messages
  FOR INSERT
  TO authenticated
  WITH CHECK (
    publican_user_id = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.publican_profiles pp
      WHERE pp.id = auth.uid()
        AND pp.venue_id = publican_messages.venue_id
    )
  );

-- 2. Update is_publican() to check publican_profiles. Keep returning true
--    if a legacy publican_venues row still exists, so we don't break
--    anyone migrated from the old model.

CREATE OR REPLACE FUNCTION public.is_publican()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.publican_profiles pp
    WHERE pp.id = auth.uid()
  ) OR EXISTS (
    SELECT 1 FROM public.publican_venues pv
    WHERE pv.user_id = auth.uid()
  );
$$;

-- 3. Per-occurrence interest summary RPC for the publican dashboard.
--    Returns upcoming-interest totals per quiz event at the publican's
--    venue (sums across all non-cancelled future occurrences).

CREATE OR REPLACE FUNCTION public.publican_dashboard_event_interest(
  p_venue_id uuid
) RETURNS TABLE (
  quiz_event_id uuid,
  upcoming_interest_count bigint,
  next_occurrence_date date,
  next_occurrence_interest_count bigint
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH guard AS (
    SELECT EXISTS (
      SELECT 1 FROM public.publican_profiles pp
      WHERE pp.id = auth.uid() AND pp.venue_id = p_venue_id
    ) AS allowed
  ),
  today_uk AS (
    SELECT (now() AT TIME ZONE 'Europe/London')::date AS d
  ),
  events AS (
    SELECT q.id
    FROM public.quiz_events q, guard
    WHERE q.venue_id = p_venue_id
      AND guard.allowed
  ),
  totals AS (
    SELECT e.id AS quiz_event_id,
           COALESCE((
             SELECT count(*)::bigint
             FROM public.quiz_event_interests i
             JOIN public.quiz_event_occurrences o
               ON o.quiz_event_id = i.quiz_event_id
              AND o.occurrence_date = i.occurrence_date
             WHERE i.quiz_event_id = e.id
               AND o.cancelled_at IS NULL
               AND o.occurrence_date >= (SELECT d FROM today_uk)
           ), 0) AS upcoming_interest_count
    FROM events e
  ),
  next_occ AS (
    SELECT DISTINCT ON (o.quiz_event_id)
           o.quiz_event_id,
           o.occurrence_date,
           COALESCE((
             SELECT count(*)::bigint FROM public.quiz_event_interests i
             WHERE i.quiz_event_id = o.quiz_event_id
               AND i.occurrence_date = o.occurrence_date
           ), 0) AS interest_count
    FROM public.quiz_event_occurrences o
    JOIN events e ON e.id = o.quiz_event_id
    WHERE o.cancelled_at IS NULL
      AND o.occurrence_date >= (SELECT d FROM today_uk)
    ORDER BY o.quiz_event_id, o.occurrence_date ASC
  )
  SELECT t.quiz_event_id,
         t.upcoming_interest_count,
         n.occurrence_date,
         COALESCE(n.interest_count, 0)
  FROM totals t
  LEFT JOIN next_occ n ON n.quiz_event_id = t.quiz_event_id;
$$;

REVOKE ALL ON FUNCTION public.publican_dashboard_event_interest(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.publican_dashboard_event_interest(uuid) TO authenticated;

COMMIT;
