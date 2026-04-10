-- Completed host quiz nights: server-side rollup for dashboard earnings and session counts.
-- Inserts only via SECURITY DEFINER RPC (allowlisted hosts).

ALTER TABLE public.quiz_events
  ADD COLUMN IF NOT EXISTS entry_fee_pence integer;

COMMENT ON COLUMN public.quiz_events.entry_fee_pence IS 'Optional per-player entry fee in pence; used when recording a completed host session for earnings.';

CREATE TABLE public.host_quiz_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  host_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  venue_id uuid REFERENCES public.venues(id) ON DELETE SET NULL,
  pack_id uuid REFERENCES public.quiz_packs(id) ON DELETE SET NULL,
  completed_at timestamptz NOT NULL DEFAULT now(),
  team_count integer NOT NULL DEFAULT 0,
  total_player_count integer NOT NULL DEFAULT 0,
  entry_fee_pence integer,
  gross_earnings_pence integer
);

COMMENT ON TABLE public.host_quiz_sessions IS 'One row per completed quiz night from the host app; gross_earnings_pence = entry_fee_pence * total_player_count when fee is set.';

CREATE INDEX IF NOT EXISTS idx_host_quiz_sessions_host_user ON public.host_quiz_sessions (host_user_id);

ALTER TABLE public.host_quiz_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Hosts read own quiz sessions"
  ON public.host_quiz_sessions
  FOR SELECT
  TO authenticated
  USING (host_user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.record_host_quiz_session(
  p_venue_id uuid,
  p_pack_id uuid,
  p_team_count integer,
  p_total_player_count integer
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_fee integer;
  v_gross integer;
  new_id uuid;
BEGIN
  IF NOT public.is_allowlisted_host() THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  SELECT q.entry_fee_pence INTO v_fee
  FROM public.quiz_events q
  WHERE q.venue_id = p_venue_id
    AND q.is_active = true
  LIMIT 1;

  v_gross := CASE
    WHEN v_fee IS NOT NULL THEN v_fee * p_total_player_count
    ELSE NULL
  END;

  INSERT INTO public.host_quiz_sessions (
    host_user_id,
    venue_id,
    pack_id,
    team_count,
    total_player_count,
    entry_fee_pence,
    gross_earnings_pence
  )
  VALUES (
    auth.uid(),
    p_venue_id,
    p_pack_id,
    p_team_count,
    p_total_player_count,
    v_fee,
    v_gross
  )
  RETURNING id INTO new_id;

  RETURN new_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.host_dashboard_summary()
RETURNS TABLE (
  total_sessions bigint,
  total_earnings_pence bigint,
  total_player_count bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_allowlisted_host() THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    count(*)::bigint,
    coalesce(sum(s.gross_earnings_pence), 0)::bigint,
    coalesce(sum(s.total_player_count), 0)::bigint
  FROM public.host_quiz_sessions s
  WHERE s.host_user_id = auth.uid();
END;
$$;

REVOKE ALL ON FUNCTION public.record_host_quiz_session(uuid, uuid, integer, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_host_quiz_session(uuid, uuid, integer, integer) TO authenticated;

REVOKE ALL ON FUNCTION public.host_dashboard_summary() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.host_dashboard_summary() TO authenticated;
