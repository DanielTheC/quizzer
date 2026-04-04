-- Public aggregate interest count for quiz detail (RLS on quiz_event_interests only allows per-user rows).
-- Table bootstrap: safe if 20260403120000_host_dashboard_interests.sql was never applied.

CREATE TABLE IF NOT EXISTS quiz_event_interests (
  quiz_event_id uuid NOT NULL REFERENCES quiz_events(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (quiz_event_id, user_id)
);

COMMENT ON TABLE quiz_event_interests IS 'Signed-in players who saved/interested in a quiz; used for host aggregate counts (RLS: own rows only).';

CREATE INDEX IF NOT EXISTS idx_quiz_event_interests_quiz ON quiz_event_interests (quiz_event_id);

ALTER TABLE quiz_event_interests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own quiz interests" ON quiz_event_interests;
CREATE POLICY "Users manage own quiz interests"
  ON quiz_event_interests
  FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.get_quiz_event_interest_count(p_quiz_event_id uuid)
RETURNS bigint
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT count(*)::bigint
  FROM quiz_event_interests
  WHERE quiz_event_id = p_quiz_event_id;
$$;

COMMENT ON FUNCTION public.get_quiz_event_interest_count(uuid) IS 'Anon-safe total interest count for a listing; no per-user data exposed.';

REVOKE ALL ON FUNCTION public.get_quiz_event_interest_count(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_quiz_event_interest_count(uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.get_quiz_event_interest_count(uuid) TO authenticated;
