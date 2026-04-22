-- Per-occurrence interest + occurrence materialisation.
-- Replaces lifetime quiz_event_interests with (user, quiz_event, occurrence_date) RSVP.
-- Adds quiz_event_occurrences for cancellation + host release.

BEGIN;

-- 1. Frequency enum + columns on quiz_events -------------------------------

DO $$ BEGIN
  CREATE TYPE quiz_event_frequency AS ENUM ('weekly', 'monthly', 'quarterly', 'one_off');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE quiz_events
  ADD COLUMN IF NOT EXISTS frequency quiz_event_frequency NOT NULL DEFAULT 'weekly',
  ADD COLUMN IF NOT EXISTS nth_week smallint CHECK (nth_week BETWEEN 1 AND 5),
  ADD COLUMN IF NOT EXISTS start_date date,
  ADD COLUMN IF NOT EXISTS occurrences_planned smallint NOT NULL DEFAULT 12
    CHECK (occurrences_planned >= 0 AND occurrences_planned <= 52);

COMMENT ON COLUMN quiz_events.frequency IS 'Operator-set cadence. Drives occurrence materialisation.';
COMMENT ON COLUMN quiz_events.nth_week IS '1..5 for monthly/quarterly (nth weekday of month). NULL for weekly/one_off.';
COMMENT ON COLUMN quiz_events.start_date IS 'First occurrence date. All materialised dates derive from this.';
COMMENT ON COLUMN quiz_events.occurrences_planned IS 'How many future occurrences to materialise. Operator-controlled (three-month rolling contract baseline).';

-- Drop the lifetime cancellation flag in favour of per-occurrence cancellation.
ALTER TABLE quiz_events DROP COLUMN IF EXISTS host_cancelled_at;

-- 2. Cancellation reason enum ----------------------------------------------

DO $$ BEGIN
  CREATE TYPE quiz_occurrence_cancelled_by AS ENUM ('host', 'publican', 'operator');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 3. Occurrences table -----------------------------------------------------

CREATE TABLE IF NOT EXISTS quiz_event_occurrences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quiz_event_id uuid NOT NULL REFERENCES quiz_events(id) ON DELETE CASCADE,
  occurrence_date date NOT NULL,
  cancelled_at timestamptz,
  cancelled_by quiz_occurrence_cancelled_by,
  cancellation_reason text,
  penalty_applied boolean NOT NULL DEFAULT false,
  released_by_host_at timestamptz,
  substitute_host_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (quiz_event_id, occurrence_date)
);

COMMENT ON TABLE quiz_event_occurrences IS 'Materialised future dates for a quiz. One row per scheduled occurrence.';

CREATE INDEX IF NOT EXISTS idx_quiz_event_occurrences_date ON quiz_event_occurrences (occurrence_date);
CREATE INDEX IF NOT EXISTS idx_quiz_event_occurrences_quiz_date ON quiz_event_occurrences (quiz_event_id, occurrence_date);

ALTER TABLE quiz_event_occurrences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Occurrences public read"
  ON quiz_event_occurrences FOR SELECT
  USING (true);

CREATE POLICY "Operators manage occurrences"
  ON quiz_event_occurrences FOR ALL
  TO authenticated
  USING (public.is_operator())
  WITH CHECK (public.is_operator());

-- 4. Rewrite quiz_event_interests with occurrence_date in PK --------------

DROP TABLE IF EXISTS quiz_event_interests;

CREATE TABLE quiz_event_interests (
  quiz_event_id uuid NOT NULL REFERENCES quiz_events(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  occurrence_date date NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (quiz_event_id, user_id, occurrence_date)
);

COMMENT ON TABLE quiz_event_interests IS 'Per-occurrence RSVP. Reset daily by cron when occurrence_date < today (Europe/London).';

CREATE INDEX IF NOT EXISTS idx_quiz_event_interests_quiz_date
  ON quiz_event_interests (quiz_event_id, occurrence_date);
CREATE INDEX IF NOT EXISTS idx_quiz_event_interests_user
  ON quiz_event_interests (user_id);

ALTER TABLE quiz_event_interests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own quiz interests"
  ON quiz_event_interests FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- 5. Occurrence generation helper -----------------------------------------
-- Given (start_date, day_of_week 0..6, frequency, nth_week, count) returns N dates.

CREATE OR REPLACE FUNCTION public.generate_quiz_occurrence_dates(
  p_start_date date,
  p_day_of_week smallint,     -- 0 = Sunday .. 6 = Saturday (Postgres convention)
  p_frequency quiz_event_frequency,
  p_nth_week smallint,        -- 1..5 or NULL
  p_count smallint
) RETURNS SETOF date
LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE
  d date;
  anchor date;
  month_cursor date;
  step_months int;
  nth int;
  produced int := 0;
BEGIN
  IF p_count <= 0 THEN RETURN; END IF;

  IF p_frequency = 'one_off' THEN
    RETURN NEXT p_start_date;
    RETURN;
  END IF;

  IF p_frequency = 'weekly' THEN
    -- snap start_date forward to first matching weekday
    anchor := p_start_date + ((7 + p_day_of_week - EXTRACT(DOW FROM p_start_date)::int) % 7);
    FOR i IN 0..(p_count - 1) LOOP
      RETURN NEXT anchor + (i * 7);
    END LOOP;
    RETURN;
  END IF;

  -- monthly / quarterly: nth weekday of month
  step_months := CASE p_frequency WHEN 'monthly' THEN 1 WHEN 'quarterly' THEN 3 END;
  nth := COALESCE(p_nth_week, 1);
  month_cursor := date_trunc('month', p_start_date)::date;

  WHILE produced < p_count LOOP
    -- first matching weekday of this month
    d := month_cursor + ((7 + p_day_of_week - EXTRACT(DOW FROM month_cursor)::int) % 7);
    -- bump to nth
    d := d + ((nth - 1) * 7);
    -- only accept if still in the same month (5th weekday may overflow → skip)
    IF EXTRACT(MONTH FROM d) = EXTRACT(MONTH FROM month_cursor) AND d >= p_start_date THEN
      RETURN NEXT d;
      produced := produced + 1;
    END IF;
    month_cursor := (month_cursor + make_interval(months => step_months))::date;
    -- safety: bail at 10y lookahead
    IF month_cursor > p_start_date + interval '10 years' THEN EXIT; END IF;
  END LOOP;
END;
$$;

-- 6. Materialisation RPC: regenerates future occurrences for a quiz -------

CREATE OR REPLACE FUNCTION public.rebuild_quiz_event_occurrences(p_quiz_event_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  q RECORD;
  today_uk date := (now() AT TIME ZONE 'Europe/London')::date;
BEGIN
  IF NOT public.is_operator() THEN
    RAISE EXCEPTION 'operator only';
  END IF;

  SELECT id, day_of_week, frequency, nth_week, start_date, occurrences_planned
    INTO q
  FROM quiz_events WHERE id = p_quiz_event_id;
  IF NOT FOUND THEN RETURN; END IF;

  -- drop future uncancelled occurrences; keep past + already-cancelled rows for audit
  DELETE FROM quiz_event_occurrences
   WHERE quiz_event_id = p_quiz_event_id
     AND occurrence_date >= today_uk
     AND cancelled_at IS NULL;

  INSERT INTO quiz_event_occurrences (quiz_event_id, occurrence_date)
  SELECT p_quiz_event_id, d
  FROM public.generate_quiz_occurrence_dates(
    GREATEST(q.start_date, today_uk),
    q.day_of_week::smallint,
    q.frequency,
    q.nth_week,
    q.occurrences_planned
  ) d
  ON CONFLICT (quiz_event_id, occurrence_date) DO NOTHING;

  -- drop stale interest rows for dates no longer scheduled
  DELETE FROM quiz_event_interests i
   WHERE i.quiz_event_id = p_quiz_event_id
     AND i.occurrence_date >= today_uk
     AND NOT EXISTS (
       SELECT 1 FROM quiz_event_occurrences o
        WHERE o.quiz_event_id = i.quiz_event_id
          AND o.occurrence_date = i.occurrence_date
          AND o.cancelled_at IS NULL
     );
END;
$$;

REVOKE ALL ON FUNCTION public.rebuild_quiz_event_occurrences(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rebuild_quiz_event_occurrences(uuid) TO authenticated;

-- 7. Operator cancel-occurrence RPC ---------------------------------------

CREATE OR REPLACE FUNCTION public.cancel_quiz_occurrence(
  p_quiz_event_id uuid,
  p_occurrence_date date,
  p_cancelled_by quiz_occurrence_cancelled_by,
  p_reason text
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- v1: operator only (publican cancellation gated by penalty flow, deferred)
  IF NOT public.is_operator() THEN RETURN false; END IF;

  UPDATE quiz_event_occurrences
     SET cancelled_at = now(),
         cancelled_by = p_cancelled_by,
         cancellation_reason = p_reason
   WHERE quiz_event_id = p_quiz_event_id
     AND occurrence_date = p_occurrence_date
     AND cancelled_at IS NULL;

  IF NOT FOUND THEN RETURN false; END IF;

  DELETE FROM quiz_event_interests
   WHERE quiz_event_id = p_quiz_event_id
     AND occurrence_date = p_occurrence_date;

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.cancel_quiz_occurrence(uuid, date, quiz_occurrence_cancelled_by, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cancel_quiz_occurrence(uuid, date, quiz_occurrence_cancelled_by, text) TO authenticated;

-- 8. Host release-occurrence RPC -----------------------------------------

CREATE OR REPLACE FUNCTION public.release_quiz_occurrence(
  p_quiz_event_id uuid,
  p_occurrence_date date
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  is_current_host boolean;
BEGIN
  -- host must own the claim on this quiz_event
  SELECT EXISTS (
    SELECT 1 FROM quiz_claims c
     WHERE c.quiz_event_id = p_quiz_event_id
       AND c.host_user_id = auth.uid()
       AND c.released_at IS NULL
  ) INTO is_current_host;

  IF NOT is_current_host THEN RETURN false; END IF;

  UPDATE quiz_event_occurrences
     SET released_by_host_at = now(),
         substitute_host_user_id = NULL
   WHERE quiz_event_id = p_quiz_event_id
     AND occurrence_date = p_occurrence_date
     AND cancelled_at IS NULL
     AND released_by_host_at IS NULL;

  RETURN FOUND;
END;
$$;

REVOKE ALL ON FUNCTION public.release_quiz_occurrence(uuid, date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.release_quiz_occurrence(uuid, date) TO authenticated;

-- 9. Public per-occurrence count RPC (replaces lifetime RPC) -------------

DROP FUNCTION IF EXISTS public.get_quiz_event_interest_count(uuid);

CREATE OR REPLACE FUNCTION public.get_quiz_event_interest_count(
  p_quiz_event_id uuid,
  p_occurrence_date date
) RETURNS bigint
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT count(*)::bigint
  FROM quiz_event_interests
  WHERE quiz_event_id = p_quiz_event_id
    AND occurrence_date = p_occurrence_date;
$$;

REVOKE ALL ON FUNCTION public.get_quiz_event_interest_count(uuid, date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_quiz_event_interest_count(uuid, date) TO anon, authenticated;

-- 10. Public "next occurrence" helper used by find-a-quiz -----------------

CREATE OR REPLACE FUNCTION public.get_next_quiz_occurrence(p_quiz_event_id uuid)
RETURNS TABLE (occurrence_date date, interest_count bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT o.occurrence_date,
         (SELECT count(*)::bigint FROM quiz_event_interests i
           WHERE i.quiz_event_id = o.quiz_event_id AND i.occurrence_date = o.occurrence_date)
  FROM quiz_event_occurrences o
  WHERE o.quiz_event_id = p_quiz_event_id
    AND o.occurrence_date >= (now() AT TIME ZONE 'Europe/London')::date
    AND o.cancelled_at IS NULL
  ORDER BY o.occurrence_date ASC
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.get_next_quiz_occurrence(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_next_quiz_occurrence(uuid) TO anon, authenticated;

-- 11. Upcoming occurrences (for detail screen chips) ---------------------

CREATE OR REPLACE FUNCTION public.get_upcoming_quiz_occurrences(
  p_quiz_event_id uuid,
  p_limit smallint DEFAULT 4
) RETURNS TABLE (
  occurrence_date date,
  cancelled boolean,
  interest_count bigint
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT o.occurrence_date,
         (o.cancelled_at IS NOT NULL) AS cancelled,
         (SELECT count(*)::bigint FROM quiz_event_interests i
           WHERE i.quiz_event_id = o.quiz_event_id AND i.occurrence_date = o.occurrence_date)
  FROM quiz_event_occurrences o
  WHERE o.quiz_event_id = p_quiz_event_id
    AND o.occurrence_date >= (now() AT TIME ZONE 'Europe/London')::date
  ORDER BY o.occurrence_date ASC
  LIMIT GREATEST(p_limit, 1);
$$;

REVOKE ALL ON FUNCTION public.get_upcoming_quiz_occurrences(uuid, smallint) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_upcoming_quiz_occurrences(uuid, smallint) TO anon, authenticated;

-- 12. host_quiz_dashboard_rows: drop host_cancelled_at, add next-occurrence
DROP FUNCTION IF EXISTS public.host_quiz_dashboard_rows();

CREATE OR REPLACE FUNCTION public.host_quiz_dashboard_rows()
RETURNS TABLE (
  quiz_event_id uuid,
  venue_id uuid,
  venue_name text,
  day_of_week integer,
  start_time text,
  next_occurrence_date date,
  next_occurrence_interest_count bigint,
  host_capacity_note text
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT
    q.id,
    q.venue_id,
    v.name,
    q.day_of_week::integer,
    q.start_time::text,
    n.occurrence_date,
    COALESCE(n.interest_count, 0),
    q.host_capacity_note
  FROM quiz_events q
  INNER JOIN venues v ON v.id = q.venue_id
  LEFT JOIN LATERAL public.get_next_quiz_occurrence(q.id) n ON TRUE
  WHERE q.is_active = true
    AND public.is_allowlisted_host()
  ORDER BY q.day_of_week, q.start_time, v.name;
$$;

REVOKE ALL ON FUNCTION public.host_quiz_dashboard_rows() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.host_quiz_dashboard_rows() TO authenticated;

-- host_patch_quiz_event_host_fields: drop cancellation params (no longer host-level)
DROP FUNCTION IF EXISTS public.host_patch_quiz_event_host_fields(uuid, text, boolean, timestamptz, boolean);

CREATE OR REPLACE FUNCTION public.host_patch_quiz_event_host_fields(
  p_quiz_event_id uuid,
  p_capacity_note text
) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_allowlisted_host() THEN RETURN false; END IF;
  UPDATE quiz_events SET host_capacity_note = p_capacity_note WHERE id = p_quiz_event_id;
  RETURN FOUND;
END;
$$;

REVOKE ALL ON FUNCTION public.host_patch_quiz_event_host_fields(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.host_patch_quiz_event_host_fields(uuid, text) TO authenticated;

-- 13. Cron: hourly sweep of expired interest rows ------------------------

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.unschedule('quiz_event_interests_sweep')
      WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'quiz_event_interests_sweep');
    PERFORM cron.schedule(
      'quiz_event_interests_sweep',
      '5 * * * *',
      $sweep$
        DELETE FROM public.quiz_event_interests
         WHERE occurrence_date < (now() AT TIME ZONE 'Europe/London')::date
      $sweep$
    );
  END IF;
END $$;

-- 14. Backfill ----------------------------------------------------------

-- set start_date on existing quiz_events: next matching weekday from today (UK)
UPDATE quiz_events SET start_date = (
  (now() AT TIME ZONE 'Europe/London')::date
  + ((7 + day_of_week::int - EXTRACT(DOW FROM (now() AT TIME ZONE 'Europe/London')::date)::int) % 7)
) WHERE start_date IS NULL;

-- materialise 12 occurrences per active weekly quiz
INSERT INTO quiz_event_occurrences (quiz_event_id, occurrence_date)
SELECT q.id, d
FROM quiz_events q,
LATERAL public.generate_quiz_occurrence_dates(
  q.start_date,
  q.day_of_week::smallint,
  q.frequency,
  q.nth_week,
  q.occurrences_planned
) d
WHERE q.is_active = true
ON CONFLICT (quiz_event_id, occurrence_date) DO NOTHING;

COMMIT;
