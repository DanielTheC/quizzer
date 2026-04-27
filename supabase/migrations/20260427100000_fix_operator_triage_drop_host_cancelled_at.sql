-- Fix operator_triage_unhosted_quizzes after host_cancelled_at was dropped
-- by 20260421100000_per_occurrence_interest. Replace the lifetime cancel
-- filter with a per-occurrence one: only show quizzes whose soonest future
-- occurrence is non-cancelled.

CREATE OR REPLACE FUNCTION public.operator_triage_unhosted_quizzes()
RETURNS TABLE (
  quiz_event_id uuid,
  venue_id uuid,
  venue_name text,
  day_of_week integer,
  start_time text,
  interest_count bigint,
  next_occurrence date
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH today_uk AS (
    SELECT (now() AT TIME ZONE 'Europe/London')::date AS d
  ),
  next_occ AS (
    SELECT DISTINCT ON (o.quiz_event_id)
      o.quiz_event_id,
      o.occurrence_date,
      o.cancelled_at
    FROM public.quiz_event_occurrences o, today_uk
    WHERE o.occurrence_date >= today_uk.d
    ORDER BY o.quiz_event_id, o.occurrence_date ASC
  )
  SELECT
    q.id AS quiz_event_id,
    q.venue_id,
    coalesce(v.name, '')::text AS venue_name,
    q.day_of_week::integer AS day_of_week,
    q.start_time::text AS start_time,
    (
      SELECT count(*)::bigint
      FROM public.quiz_event_interests i
      WHERE i.quiz_event_id = q.id
        AND i.occurrence_date = n.occurrence_date
    ) AS interest_count,
    n.occurrence_date AS next_occurrence
  FROM public.quiz_events q
  INNER JOIN public.venues v ON v.id = q.venue_id
  INNER JOIN next_occ n ON n.quiz_event_id = q.id
  WHERE q.is_active = true
    AND n.cancelled_at IS NULL
    AND NOT EXISTS (
      SELECT 1 FROM public.host_applications ha
      WHERE ha.quiz_event_id = q.id
        AND ha.status = 'approved'::public.host_application_status
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.quiz_claims qc
      WHERE qc.quiz_event_id = q.id
        AND qc.status IN ('pending', 'confirmed')
    )
    AND public.is_operator();
$$;

COMMENT ON FUNCTION public.operator_triage_unhosted_quizzes() IS
  'Active quizzes with a non-cancelled next occurrence, no approved host application, no active claim.';
