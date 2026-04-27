BEGIN;

-- 1.1 Covering index for the interest-count subquery used by feed RPCs.
-- (PK already covers (quiz_event_id, user_id, occurrence_date), but counts
--  by (quiz_event_id, occurrence_date) prefer this narrower index.)
CREATE INDEX IF NOT EXISTS idx_quiz_event_interests_event_date
  ON quiz_event_interests (quiz_event_id, occurrence_date);

-- 1.2 Replace get_upcoming_occurrences_feed with a richer return shape that
--     eliminates the client-side N+1 to quiz_events / venues.
DROP FUNCTION IF EXISTS public.get_upcoming_occurrences_feed(date, date);

CREATE OR REPLACE FUNCTION public.get_upcoming_occurrences_feed(
  p_from date DEFAULT (now() AT TIME ZONE 'Europe/London')::date,
  p_to   date DEFAULT ((now() AT TIME ZONE 'Europe/London')::date + 21)
) RETURNS TABLE (
  quiz_event_id uuid,
  occurrence_date date,
  venue_id uuid,
  venue_name text,
  venue_address text,
  venue_postcode text,
  venue_city text,
  venue_lat double precision,
  venue_lng double precision,
  day_of_week smallint,
  start_time time,
  entry_fee_pence integer,
  prize text,
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
    v.address,
    v.postcode,
    v.city,
    v.lat,
    v.lng,
    q.day_of_week::smallint,
    q.start_time::time,
    q.entry_fee_pence::integer,
    q.prize::text,
    q.cadence_pill_label,
    (o.cancelled_at IS NOT NULL),
    COALESCE(ic.cnt, 0)::bigint,
    (oc.host_user_id IS NOT NULL)
  FROM quiz_event_occurrences o
  INNER JOIN quiz_events q ON q.id = o.quiz_event_id
  INNER JOIN venues v ON v.id = q.venue_id
  LEFT JOIN LATERAL (
    SELECT count(*)::bigint AS cnt
    FROM quiz_event_interests i
    WHERE i.quiz_event_id = o.quiz_event_id
      AND i.occurrence_date = o.occurrence_date
  ) ic ON TRUE
  LEFT JOIN LATERAL (
    SELECT host_user_id
    FROM quiz_occurrence_claims c
    WHERE c.quiz_event_id = o.quiz_event_id
      AND c.occurrence_date = o.occurrence_date
      AND c.released_at IS NULL
    LIMIT 1
  ) oc ON TRUE
  WHERE q.is_active = true
    AND o.occurrence_date BETWEEN p_from AND p_to
  ORDER BY o.occurrence_date, v.name;
$$;

REVOKE ALL ON FUNCTION public.get_upcoming_occurrences_feed(date, date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_upcoming_occurrences_feed(date, date) TO anon, authenticated;

-- 1.3 Per-venue batched upcoming occurrences for the publican portal.
CREATE OR REPLACE FUNCTION public.get_upcoming_occurrences_by_venue(
  p_venue_id uuid,
  p_limit_per_event smallint DEFAULT 8
) RETURNS TABLE (
  quiz_event_id uuid,
  occurrence_date date,
  cancelled boolean,
  interest_count bigint
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH ranked AS (
    SELECT
      o.quiz_event_id,
      o.occurrence_date,
      (o.cancelled_at IS NOT NULL) AS cancelled,
      COALESCE((
        SELECT count(*)::bigint
        FROM quiz_event_interests i
        WHERE i.quiz_event_id = o.quiz_event_id
          AND i.occurrence_date = o.occurrence_date
      ), 0) AS interest_count,
      row_number() OVER (
        PARTITION BY o.quiz_event_id
        ORDER BY o.occurrence_date ASC
      ) AS rn
    FROM quiz_event_occurrences o
    INNER JOIN quiz_events q ON q.id = o.quiz_event_id
    WHERE q.venue_id = p_venue_id
      AND q.is_active = true
      AND o.occurrence_date >= (now() AT TIME ZONE 'Europe/London')::date
  )
  SELECT quiz_event_id, occurrence_date, cancelled, interest_count
    FROM ranked
   WHERE rn <= GREATEST(p_limit_per_event, 1)
   ORDER BY quiz_event_id, occurrence_date;
$$;

REVOKE ALL ON FUNCTION public.get_upcoming_occurrences_by_venue(uuid, smallint) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_upcoming_occurrences_by_venue(uuid, smallint) TO authenticated;

COMMIT;
