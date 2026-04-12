-- Operator dashboard: network-wide KPIs and per-venue rollups (host sessions + interests).
-- Uses host_quiz_sessions.completed_at / gross_earnings_pence / team_count (see 20260412100000_host_quiz_sessions.sql).

CREATE OR REPLACE FUNCTION public.operator_network_summary()
RETURNS TABLE (
  active_quiz_count bigint,
  total_interests bigint,
  teams_last_7d bigint,
  gross_last_7d_pence bigint
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

  cutoff := (current_timestamp AT TIME ZONE 'Europe/London')::date - 7;

  RETURN QUERY
  SELECT
    (SELECT COUNT(*)::bigint FROM public.quiz_events WHERE is_active = true),
    (SELECT COUNT(*)::bigint FROM public.quiz_event_interests),
    COALESCE(
      (SELECT SUM(s.team_count)::bigint
       FROM public.host_quiz_sessions s
       WHERE (s.completed_at AT TIME ZONE 'Europe/London')::date >= cutoff),
      0
    ),
    COALESCE(
      (SELECT SUM(s.gross_earnings_pence)::bigint
       FROM public.host_quiz_sessions s
       WHERE (s.completed_at AT TIME ZONE 'Europe/London')::date >= cutoff),
      0
    );
END;
$$;

COMMENT ON FUNCTION public.operator_network_summary() IS
  'Operator only: headline KPIs (active quizzes, total interests, teams and gross pence from host sessions in last 7 London calendar days).';

CREATE OR REPLACE FUNCTION public.operator_venue_stats()
RETURNS TABLE (
  venue_id uuid,
  venue_name text,
  postcode text,
  active_quiz_count bigint,
  interest_count bigint,
  teams_last_7d bigint,
  gross_last_7d_pence bigint,
  last_session_date date
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

  cutoff := (current_timestamp AT TIME ZONE 'Europe/London')::date - 7;

  RETURN QUERY
  SELECT
    v.id,
    v.name::text,
    v.postcode::text,
    (SELECT COUNT(*)::bigint
     FROM public.quiz_events qe
     WHERE qe.venue_id = v.id AND qe.is_active = true),
    (SELECT COUNT(*)::bigint
     FROM public.quiz_event_interests qei
     INNER JOIN public.quiz_events qe ON qe.id = qei.quiz_event_id
     WHERE qe.venue_id = v.id),
    COALESCE(
      (SELECT SUM(s.team_count)::bigint
       FROM public.host_quiz_sessions s
       WHERE s.venue_id = v.id
         AND (s.completed_at AT TIME ZONE 'Europe/London')::date >= cutoff),
      0
    ),
    COALESCE(
      (SELECT SUM(s.gross_earnings_pence)::bigint
       FROM public.host_quiz_sessions s
       WHERE s.venue_id = v.id
         AND (s.completed_at AT TIME ZONE 'Europe/London')::date >= cutoff),
      0
    ),
    (SELECT MAX((s.completed_at AT TIME ZONE 'Europe/London')::date)
     FROM public.host_quiz_sessions s
     WHERE s.venue_id = v.id)
  FROM public.venues v
  ORDER BY 4 DESC, 5 DESC;
END;
$$;

COMMENT ON FUNCTION public.operator_venue_stats() IS
  'Operator only: per-venue active quiz count, interest rows, last-7d teams/gross from host_quiz_sessions, last session date (London).';

REVOKE ALL ON FUNCTION public.operator_network_summary() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.operator_network_summary() TO authenticated;

REVOKE ALL ON FUNCTION public.operator_venue_stats() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.operator_venue_stats() TO authenticated;
