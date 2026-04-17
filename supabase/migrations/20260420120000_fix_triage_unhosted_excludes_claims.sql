-- Fix operator_triage_unhosted_quizzes to also exclude quizzes with an
-- active quiz_claim (pending or confirmed). Previously it only checked
-- host_applications, so claimed quizzes still appeared as unhosted.

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
  WITH tz AS (
    SELECT
      (current_timestamp AT TIME ZONE 'Europe/London')::date AS d,
      EXTRACT(DOW FROM (current_timestamp AT TIME ZONE 'Europe/London')::date)::integer AS cdow
  )
  SELECT
    q.id AS quiz_event_id,
    q.venue_id,
    coalesce(v.name, '')::text AS venue_name,
    q.day_of_week::integer AS day_of_week,
    q.start_time::text AS start_time,
    (SELECT count(*)::bigint FROM public.quiz_event_interests i WHERE i.quiz_event_id = q.id) AS interest_count,
    (
      (SELECT d FROM tz) + ((q.day_of_week - (SELECT cdow FROM tz) + 7) % 7) * INTERVAL '1 day'
    )::date AS next_occurrence
  FROM public.quiz_events q
  INNER JOIN public.venues v ON v.id = q.venue_id
  WHERE q.is_active = true
    AND q.host_cancelled_at IS NULL
    -- exclude quizzes with an approved host application (legacy system)
    AND NOT EXISTS (
      SELECT 1 FROM public.host_applications ha
      WHERE ha.quiz_event_id = q.id
        AND ha.status = 'approved'::public.host_application_status
    )
    -- exclude quizzes with an active claim (new claims system)
    AND NOT EXISTS (
      SELECT 1 FROM public.quiz_claims qc
      WHERE qc.quiz_event_id = q.id
        AND qc.status IN ('pending', 'confirmed')
    )
    AND public.is_operator();
$$;

COMMENT ON FUNCTION public.operator_triage_unhosted_quizzes() IS
  'Active non-cancelled quizzes with no approved host application and no active quiz claim.';
