-- Host series interest (a host flags willingness to cover a recurring quiz).
CREATE TABLE IF NOT EXISTS host_series_interests (
  host_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  quiz_event_id uuid NOT NULL REFERENCES quiz_events(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (host_user_id, quiz_event_id)
);

ALTER TABLE host_series_interests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Hosts manage own series interest"
  ON host_series_interests FOR ALL TO authenticated
  USING (host_user_id = auth.uid() AND public.is_allowlisted_host())
  WITH CHECK (host_user_id = auth.uid() AND public.is_allowlisted_host());

CREATE POLICY "Operators read host series interest"
  ON host_series_interests FOR SELECT TO authenticated
  USING (public.is_operator());

-- Per-host-per-occurrence claim (distinct from series-level quiz_claims).
-- quiz_claims still models who owns the *series* contract; occurrence_claims models
-- who is actually hosting a given night. On claim, both rows are kept in sync
-- (claim creates occurrence_claims for the next N weeks if not already filled by
-- another host from released_by_host).
CREATE TABLE IF NOT EXISTS quiz_occurrence_claims (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quiz_event_id uuid NOT NULL REFERENCES quiz_events(id) ON DELETE CASCADE,
  occurrence_date date NOT NULL,
  host_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  claimed_at timestamptz NOT NULL DEFAULT now(),
  released_at timestamptz,
  release_reason text,
  UNIQUE (quiz_event_id, occurrence_date) -- one active claim per occurrence
);

ALTER TABLE quiz_occurrence_claims ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Hosts read own occurrence claims"
  ON quiz_occurrence_claims FOR SELECT TO authenticated
  USING (host_user_id = auth.uid() OR public.is_operator());

-- No direct INSERT/UPDATE/DELETE policies — all writes go through RPCs below.

CREATE INDEX IF NOT EXISTS idx_quiz_occurrence_claims_host_future
  ON quiz_occurrence_claims (host_user_id, occurrence_date)
  WHERE released_at IS NULL;

-- Operator notifications inbox (extend existing if one already exists — grep first).
CREATE TABLE IF NOT EXISTS operator_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reason text NOT NULL,              -- 'late_unclaim_attempt' | 'occurrence_cancelled' | ...
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  read_at timestamptz
);

ALTER TABLE operator_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Operators read/ack own inbox"
  ON operator_notifications FOR ALL TO authenticated
  USING (public.is_operator()) WITH CHECK (public.is_operator());

ALTER TABLE quiz_events
  ADD COLUMN IF NOT EXISTS cadence_pill_label text
  GENERATED ALWAYS AS (
    CASE frequency
      WHEN 'weekly' THEN 'Weekly'
      WHEN 'monthly' THEN 'Monthly'
      WHEN 'quarterly' THEN 'Quarterly'
      WHEN 'one_off' THEN 'One-off'
    END
  ) STORED;

-- host_claim_occurrence: atomic claim with 4-per-series + same-day guards.
CREATE OR REPLACE FUNCTION public.host_claim_occurrence(
  p_quiz_event_id uuid,
  p_occurrence_date date
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  existing_same_day uuid;
  future_count int;
BEGIN
  IF NOT public.is_allowlisted_host() THEN
    RETURN jsonb_build_object('ok', false, 'code', 'not_allowlisted');
  END IF;

  -- Same-day conflict check (across all series)
  SELECT quiz_event_id INTO existing_same_day
  FROM quiz_occurrence_claims
  WHERE host_user_id = auth.uid()
    AND occurrence_date = p_occurrence_date
    AND released_at IS NULL
  LIMIT 1;
  IF existing_same_day IS NOT NULL THEN
    RETURN jsonb_build_object('ok', false, 'code', 'same_day_conflict',
      'conflicting_quiz_event_id', existing_same_day);
  END IF;

  -- 4-per-series cap (future + unreleased)
  SELECT count(*) INTO future_count
  FROM quiz_occurrence_claims
  WHERE host_user_id = auth.uid()
    AND quiz_event_id = p_quiz_event_id
    AND occurrence_date >= (now() AT TIME ZONE 'Europe/London')::date
    AND released_at IS NULL;
  IF future_count >= 4 THEN
    RETURN jsonb_build_object('ok', false, 'code', 'series_cap_reached');
  END IF;

  INSERT INTO quiz_occurrence_claims (quiz_event_id, occurrence_date, host_user_id)
  VALUES (p_quiz_event_id, p_occurrence_date, auth.uid())
  ON CONFLICT (quiz_event_id, occurrence_date) DO NOTHING;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'code', 'already_claimed');
  END IF;

  RETURN jsonb_build_object('ok', true);
END;
$$;

REVOKE ALL ON FUNCTION public.host_claim_occurrence(uuid, date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.host_claim_occurrence(uuid, date) TO authenticated;

-- host_unclaim_occurrence: blocks within 24h + logs operator notification.
CREATE OR REPLACE FUNCTION public.host_unclaim_occurrence(
  p_quiz_event_id uuid,
  p_occurrence_date date
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  hours_until numeric;
  claim_row record;
BEGIN
  SELECT * INTO claim_row FROM quiz_occurrence_claims
  WHERE quiz_event_id = p_quiz_event_id
    AND occurrence_date = p_occurrence_date
    AND host_user_id = auth.uid()
    AND released_at IS NULL;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'code', 'not_claim_holder');
  END IF;

  hours_until := EXTRACT(EPOCH FROM
    (p_occurrence_date::timestamptz AT TIME ZONE 'Europe/London') - now()) / 3600;

  IF hours_until < 24 THEN
    INSERT INTO operator_notifications (reason, payload)
    VALUES ('late_unclaim_attempt', jsonb_build_object(
      'quiz_event_id', p_quiz_event_id,
      'occurrence_date', p_occurrence_date,
      'host_user_id', auth.uid(),
      'hours_until', hours_until));
    RETURN jsonb_build_object('ok', false, 'code', 'too_late');
  END IF;

  UPDATE quiz_occurrence_claims
  SET released_at = now(), release_reason = 'host_unclaim'
  WHERE id = claim_row.id;

  -- Fire notification payload for host_series_interests readers to pick up
  -- (v1: in-app only — email integration deferred)
  INSERT INTO operator_notifications (reason, payload)
  VALUES ('occurrence_released', jsonb_build_object(
    'quiz_event_id', p_quiz_event_id,
    'occurrence_date', p_occurrence_date));

  RETURN jsonb_build_object('ok', true);
END;
$$;

REVOKE ALL ON FUNCTION public.host_unclaim_occurrence(uuid, date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.host_unclaim_occurrence(uuid, date) TO authenticated;

-- publican_cancel_occurrence: publican-initiated cancel (replaces email-only v1).
CREATE OR REPLACE FUNCTION public.publican_cancel_occurrence(
  p_quiz_event_id uuid,
  p_occurrence_date date,
  p_reason text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_venue uuid;
  is_publican_for_venue boolean;
BEGIN
  SELECT venue_id INTO v_venue FROM quiz_events WHERE id = p_quiz_event_id;

  SELECT EXISTS (
    SELECT 1 FROM publican_profiles
    WHERE user_id = auth.uid() AND venue_id = v_venue
  ) INTO is_publican_for_venue;

  IF NOT is_publican_for_venue THEN
    RETURN jsonb_build_object('ok', false, 'code', 'not_publican_for_venue');
  END IF;

  UPDATE quiz_event_occurrences
  SET cancelled_at = now(),
      cancelled_by = 'publican',
      cancellation_reason = p_reason
  WHERE quiz_event_id = p_quiz_event_id
    AND occurrence_date = p_occurrence_date
    AND cancelled_at IS NULL;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'code', 'already_cancelled_or_missing');
  END IF;

  -- Auto-release the active host claim
  UPDATE quiz_occurrence_claims
  SET released_at = now(), release_reason = 'publican_cancelled'
  WHERE quiz_event_id = p_quiz_event_id
    AND occurrence_date = p_occurrence_date
    AND released_at IS NULL;

  INSERT INTO operator_notifications (reason, payload)
  VALUES ('occurrence_cancelled', jsonb_build_object(
    'quiz_event_id', p_quiz_event_id,
    'occurrence_date', p_occurrence_date,
    'cancelled_by', 'publican',
    'reason', p_reason));

  RETURN jsonb_build_object('ok', true);
END;
$$;

REVOKE ALL ON FUNCTION public.publican_cancel_occurrence(uuid, date, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.publican_cancel_occurrence(uuid, date, text) TO authenticated;

-- Finder feed: one row per occurrence (not per series).
CREATE OR REPLACE FUNCTION public.get_upcoming_occurrences_feed(
  p_from date DEFAULT (now() AT TIME ZONE 'Europe/London')::date,
  p_to date DEFAULT ((now() AT TIME ZONE 'Europe/London')::date + 21)
) RETURNS TABLE (
  quiz_event_id uuid,
  occurrence_date date,
  venue_id uuid,
  venue_name text,
  cadence_pill_label text,
  cancelled boolean,
  interest_count bigint,
  has_host boolean
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT
    o.quiz_event_id,
    o.occurrence_date,
    q.venue_id,
    v.name,
    q.cadence_pill_label,
    (o.cancelled_at IS NOT NULL),
    (SELECT count(*)::bigint FROM quiz_event_interests i
      WHERE i.quiz_event_id = o.quiz_event_id AND i.occurrence_date = o.occurrence_date),
    EXISTS (
      SELECT 1 FROM quiz_occurrence_claims c
      WHERE c.quiz_event_id = o.quiz_event_id
        AND c.occurrence_date = o.occurrence_date
        AND c.released_at IS NULL
    )
  FROM quiz_event_occurrences o
  INNER JOIN quiz_events q ON q.id = o.quiz_event_id
  INNER JOIN venues v ON v.id = q.venue_id
  WHERE q.is_active = true
    AND o.occurrence_date BETWEEN p_from AND p_to
  ORDER BY o.occurrence_date, v.name;
$$;

REVOKE ALL ON FUNCTION public.get_upcoming_occurrences_feed(date, date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_upcoming_occurrences_feed(date, date) TO anon, authenticated;
