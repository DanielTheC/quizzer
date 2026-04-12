-- Recent host quiz sessions for operator analytics (last 14 London calendar days).
-- Day/time columns come from one representative quiz_events row at the venue when present.

CREATE OR REPLACE FUNCTION public.operator_recent_sessions()
RETURNS TABLE (
  session_id uuid,
  session_date date,
  venue_name text,
  quiz_event_id uuid,
  day_of_week integer,
  start_time text,
  team_count integer,
  gross_pence bigint
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  cutoff date;
BEGIN
  IF NOT public.is_operator() THEN
    RETURN;
  END IF;

  cutoff := (current_timestamp AT TIME ZONE 'Europe/London')::date - 14;

  RETURN QUERY
  SELECT
    h.id,
    (h.completed_at AT TIME ZONE 'Europe/London')::date,
    coalesce(v.name, '')::text,
    q.id,
    q.day_of_week,
    q.start_time::text,
    h.team_count,
    coalesce(h.gross_earnings_pence, 0)::bigint
  FROM public.host_quiz_sessions h
  LEFT JOIN public.venues v ON v.id = h.venue_id
  LEFT JOIN LATERAL (
    SELECT qe.id, qe.day_of_week, qe.start_time
    FROM public.quiz_events qe
    WHERE qe.venue_id = h.venue_id
    ORDER BY qe.is_active DESC, qe.day_of_week ASC, qe.start_time ASC
    LIMIT 1
  ) q ON true
  WHERE (h.completed_at AT TIME ZONE 'Europe/London')::date >= cutoff
  ORDER BY h.completed_at DESC;
END;
$$;

COMMENT ON FUNCTION public.operator_recent_sessions() IS
  'Operator only: host_quiz_sessions in last 14 days (London) with venue name and sample quiz slot for day/time.';

REVOKE ALL ON FUNCTION public.operator_recent_sessions() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.operator_recent_sessions() TO authenticated;
