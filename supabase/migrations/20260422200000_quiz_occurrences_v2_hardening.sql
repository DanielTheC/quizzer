-- v2 hardening: stricter unclaim cutoff, past-date guard, FK on claims,
-- host notification routing.

BEGIN;

-- 1.1  host_unclaim_occurrence: use the actual quiz start_time, not midnight UK
CREATE OR REPLACE FUNCTION public.host_unclaim_occurrence(
  p_quiz_event_id uuid,
  p_occurrence_date date
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  hours_until numeric;
  claim_row record;
  quiz_start_local timestamptz;
  q_start_time time;
BEGIN
  SELECT * INTO claim_row FROM quiz_occurrence_claims
   WHERE quiz_event_id = p_quiz_event_id
     AND occurrence_date = p_occurrence_date
     AND host_user_id = auth.uid()
     AND released_at IS NULL;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'code', 'not_claim_holder');
  END IF;

  SELECT start_time INTO q_start_time FROM quiz_events WHERE id = p_quiz_event_id;
  IF q_start_time IS NULL THEN q_start_time := time '20:00'; END IF;

  -- Build the actual quiz start as Europe/London local, then back to UTC.
  quiz_start_local :=
    ((p_occurrence_date::text || ' ' || q_start_time::text)::timestamp
       AT TIME ZONE 'Europe/London');

  hours_until := EXTRACT(EPOCH FROM (quiz_start_local - now())) / 3600;

  IF hours_until < 24 THEN
    INSERT INTO operator_notifications (reason, payload)
    VALUES ('late_unclaim_attempt', jsonb_build_object(
      'quiz_event_id', p_quiz_event_id,
      'occurrence_date', p_occurrence_date,
      'host_user_id', auth.uid(),
      'hours_until', hours_until,
      'quiz_start_at', quiz_start_local));
    RETURN jsonb_build_object('ok', false, 'code', 'too_late');
  END IF;

  UPDATE quiz_occurrence_claims
     SET released_at = now(), release_reason = 'host_unclaim'
   WHERE id = claim_row.id;

  -- Route to host_notifications (created below), not operator_notifications.
  INSERT INTO host_notifications (host_user_id, reason, payload)
  SELECT hsi.host_user_id,
         'series_occurrence_released',
         jsonb_build_object(
           'quiz_event_id', p_quiz_event_id,
           'occurrence_date', p_occurrence_date)
    FROM host_series_interests hsi
   WHERE hsi.quiz_event_id = p_quiz_event_id
     AND hsi.host_user_id <> auth.uid();  -- don't notify the unclaimer

  RETURN jsonb_build_object('ok', true);
END;
$$;

REVOKE ALL ON FUNCTION public.host_unclaim_occurrence(uuid, date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.host_unclaim_occurrence(uuid, date) TO authenticated;

-- 1.2  publican_cancel_occurrence: refuse past dates
CREATE OR REPLACE FUNCTION public.publican_cancel_occurrence(
  p_quiz_event_id uuid,
  p_occurrence_date date,
  p_reason text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_venue uuid;
  is_publican_for_venue boolean;
  today_uk date := (now() AT TIME ZONE 'Europe/London')::date;
BEGIN
  IF p_occurrence_date < today_uk THEN
    RETURN jsonb_build_object('ok', false, 'code', 'past_date');
  END IF;

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
     AND cancelled_at IS NULL
     AND occurrence_date >= today_uk;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'code', 'already_cancelled_or_missing');
  END IF;

  UPDATE quiz_occurrence_claims
     SET released_at = now(), release_reason = 'publican_cancelled'
   WHERE quiz_event_id = p_quiz_event_id
     AND occurrence_date = p_occurrence_date
     AND released_at IS NULL;

  -- Notify the displaced host directly + operator inbox row.
  INSERT INTO host_notifications (host_user_id, reason, payload)
  SELECT c.host_user_id,
         'occurrence_cancelled_publican',
         jsonb_build_object(
           'quiz_event_id', p_quiz_event_id,
           'occurrence_date', p_occurrence_date,
           'reason', p_reason)
    FROM quiz_occurrence_claims c
   WHERE c.quiz_event_id = p_quiz_event_id
     AND c.occurrence_date = p_occurrence_date
     AND c.release_reason = 'publican_cancelled';

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

-- 1.3  host_claim_occurrence: require the occurrence to actually exist
CREATE OR REPLACE FUNCTION public.host_claim_occurrence(
  p_quiz_event_id uuid,
  p_occurrence_date date
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  existing_same_day uuid;
  future_count int;
  occurrence_exists boolean;
BEGIN
  IF NOT public.is_allowlisted_host() THEN
    RETURN jsonb_build_object('ok', false, 'code', 'not_allowlisted');
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM quiz_event_occurrences o
     WHERE o.quiz_event_id = p_quiz_event_id
       AND o.occurrence_date = p_occurrence_date
       AND o.cancelled_at IS NULL
  ) INTO occurrence_exists;
  IF NOT occurrence_exists THEN
    RETURN jsonb_build_object('ok', false, 'code', 'no_such_occurrence');
  END IF;

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

-- 1.4  Belt-and-braces FK to stop ghost claims via direct SQL
ALTER TABLE quiz_occurrence_claims
  ADD CONSTRAINT quiz_occurrence_claims_occurrence_fk
  FOREIGN KEY (quiz_event_id, occurrence_date)
  REFERENCES quiz_event_occurrences (quiz_event_id, occurrence_date)
  ON DELETE CASCADE
  NOT VALID;

ALTER TABLE quiz_occurrence_claims VALIDATE CONSTRAINT quiz_occurrence_claims_occurrence_fk;

-- 1.5  host_notifications: per-host inbox the mobile app polls
CREATE TABLE IF NOT EXISTS host_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  host_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reason text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  read_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_host_notifications_host_unread
  ON host_notifications (host_user_id, created_at DESC)
  WHERE read_at IS NULL;

ALTER TABLE host_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Hosts read own notifications"
  ON host_notifications FOR SELECT TO authenticated
  USING (host_user_id = auth.uid());

CREATE POLICY "Hosts mark own notifications read"
  ON host_notifications FOR UPDATE TO authenticated
  USING (host_user_id = auth.uid())
  WITH CHECK (host_user_id = auth.uid());

-- No INSERT policy — inserts only via SECURITY DEFINER RPCs above.

COMMIT;
