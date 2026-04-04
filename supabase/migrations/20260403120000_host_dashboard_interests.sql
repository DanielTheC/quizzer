-- Player "interested" (synced when signed in; aggregated for allowlisted hosts).
-- Host-only fields on quiz_events: capacity note + last-minute cancellation timestamp.

ALTER TABLE quiz_events
  ADD COLUMN IF NOT EXISTS host_capacity_note text,
  ADD COLUMN IF NOT EXISTS host_cancelled_at timestamptz;

COMMENT ON COLUMN quiz_events.host_capacity_note IS 'Optional note for hosts only (e.g. table space). Shown on host dashboard, not player detail.';
COMMENT ON COLUMN quiz_events.host_cancelled_at IS 'When set, players see a cancellation notice on quiz detail. Hosts clear by patching null.';

CREATE TABLE IF NOT EXISTS quiz_event_interests (
  quiz_event_id uuid NOT NULL REFERENCES quiz_events(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (quiz_event_id, user_id)
);

COMMENT ON TABLE quiz_event_interests IS 'Signed-in players who saved/interested in a quiz; used for host aggregate counts (RLS: own rows only).';

CREATE INDEX IF NOT EXISTS idx_quiz_event_interests_quiz ON quiz_event_interests (quiz_event_id);

ALTER TABLE quiz_event_interests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own quiz interests"
  ON quiz_event_interests
  FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Dashboard listing: one row per active quiz event (empty if caller is not allowlisted host).
CREATE OR REPLACE FUNCTION public.host_quiz_dashboard_rows()
RETURNS TABLE (
  quiz_event_id uuid,
  venue_id uuid,
  venue_name text,
  day_of_week integer,
  start_time text,
  interest_count bigint,
  host_capacity_note text,
  host_cancelled_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    q.id,
    q.venue_id,
    v.name,
    q.day_of_week::integer,
    q.start_time::text,
    (SELECT count(*)::bigint FROM quiz_event_interests i WHERE i.quiz_event_id = q.id),
    q.host_capacity_note,
    q.host_cancelled_at
  FROM quiz_events q
  INNER JOIN venues v ON v.id = q.venue_id
  WHERE q.is_active = true
    AND public.is_allowlisted_host()
  ORDER BY q.day_of_week, q.start_time, v.name;
$$;

CREATE OR REPLACE FUNCTION public.host_patch_quiz_event_host_fields(
  p_quiz_event_id uuid,
  p_capacity_note text,
  p_update_note boolean,
  p_cancelled_at timestamptz,
  p_update_cancellation boolean
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_allowlisted_host() THEN
    RETURN false;
  END IF;
  UPDATE quiz_events
  SET
    host_capacity_note = CASE WHEN p_update_note THEN p_capacity_note ELSE host_capacity_note END,
    host_cancelled_at = CASE WHEN p_update_cancellation THEN p_cancelled_at ELSE host_cancelled_at END
  WHERE id = p_quiz_event_id;
  IF NOT FOUND THEN
    RETURN false;
  END IF;
  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.host_quiz_dashboard_rows() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.host_quiz_dashboard_rows() TO authenticated;

REVOKE ALL ON FUNCTION public.host_patch_quiz_event_host_fields(uuid, text, boolean, timestamptz, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.host_patch_quiz_event_host_fields(uuid, text, boolean, timestamptz, boolean) TO authenticated;
