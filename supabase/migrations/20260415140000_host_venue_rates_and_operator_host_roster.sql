-- Operator-managed per-host venue pay rates + host roster/detail RPCs.
-- Depends on host_quiz_sessions.completed_at / gross_earnings_pence (not session_date / gross_pence).

-- Link approved applications to auth user (email match) for roster/detail.
ALTER TABLE public.host_applications
  ADD COLUMN IF NOT EXISTS host_user_id uuid REFERENCES auth.users (id) ON DELETE SET NULL;

COMMENT ON COLUMN public.host_applications.host_user_id IS
  'Set when approved: auth user matched by application email; used for host roster and payouts.';

CREATE INDEX IF NOT EXISTS idx_host_applications_host_user_id
  ON public.host_applications (host_user_id)
  WHERE host_user_id IS NOT NULL;

UPDATE public.host_applications ha
SET host_user_id = u.id
FROM auth.users u
WHERE ha.status = 'approved'::public.host_application_status
  AND ha.host_user_id IS NULL
  AND lower(trim(u.email)) = lower(trim(ha.email));

CREATE OR REPLACE FUNCTION public.operator_approve_host_application(p_application_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r public.host_applications%ROWTYPE;
  uid uuid;
BEGIN
  IF NOT public.is_operator() THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  SELECT * INTO r FROM public.host_applications WHERE id = p_application_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'application not found';
  END IF;
  IF r.status IS DISTINCT FROM 'pending'::public.host_application_status THEN
    RAISE EXCEPTION 'application is not pending';
  END IF;

  SELECT u.id INTO uid
  FROM auth.users u
  WHERE lower(trim(u.email)) = lower(trim(r.email))
  LIMIT 1;

  UPDATE public.host_applications
  SET
    status = 'approved'::public.host_application_status,
    reviewed_at = now(),
    rejection_reason = NULL,
    host_user_id = uid
  WHERE id = p_application_id;

  INSERT INTO public.host_allowlisted_emails (email)
  VALUES (lower(trim(r.email)))
  ON CONFLICT (email) DO NOTHING;
END;
$$;

COMMENT ON FUNCTION public.operator_approve_host_application(uuid) IS
  'Operator only: approve pending host application, set host_user_id when auth user exists, add email to host_allowlisted_emails.';

-- ─────────────────────────────────────────────
-- host_venue_rates
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.host_venue_rates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  host_user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  venue_id uuid NOT NULL REFERENCES public.venues (id) ON DELETE CASCADE,
  fee_pence integer NOT NULL CHECK (fee_pence >= 0),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (host_user_id, venue_id)
);

COMMENT ON TABLE public.host_venue_rates IS
  'Operator-managed host payout rate per venue (pence per session or as documented in notes).';

CREATE INDEX IF NOT EXISTS idx_host_venue_rates_host ON public.host_venue_rates (host_user_id);
CREATE INDEX IF NOT EXISTS idx_host_venue_rates_venue ON public.host_venue_rates (venue_id);

ALTER TABLE public.host_venue_rates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "operator_all_host_venue_rates" ON public.host_venue_rates;
CREATE POLICY "operator_all_host_venue_rates"
  ON public.host_venue_rates
  FOR ALL
  TO authenticated
  USING (public.is_operator())
  WITH CHECK (public.is_operator());

REVOKE ALL ON TABLE public.host_venue_rates FROM PUBLIC;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.host_venue_rates TO authenticated;

-- ─────────────────────────────────────────────
-- operator_host_roster()
-- ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.operator_host_roster()
RETURNS TABLE (
  host_user_id uuid,
  email text,
  assigned_quiz_count bigint,
  sessions_this_month bigint,
  payout_this_month_pence bigint,
  sessions_all_time bigint,
  last_session_date date
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT *
  FROM (
    WITH approved_hosts AS (
      SELECT DISTINCT ha.host_user_id
      FROM public.host_applications ha
      WHERE ha.status = 'approved'::public.host_application_status
        AND ha.host_user_id IS NOT NULL
    ),
    month_sessions AS (
      SELECT
        hqs.host_user_id,
        count(*)::bigint AS session_count,
        sum(coalesce(hvr.fee_pence, 0))::bigint AS payout_pence
      FROM public.host_quiz_sessions hqs
      LEFT JOIN public.host_venue_rates hvr
        ON hvr.host_user_id = hqs.host_user_id
        AND hvr.venue_id = hqs.venue_id
      WHERE date_trunc(
        'month',
        (hqs.completed_at AT TIME ZONE 'Europe/London')
      ) = date_trunc(
        'month',
        (current_timestamp AT TIME ZONE 'Europe/London')
      )
      GROUP BY hqs.host_user_id
    ),
    all_sessions AS (
      SELECT
        hqs.host_user_id,
        count(*)::bigint AS total,
        max((hqs.completed_at AT TIME ZONE 'Europe/London')::date) AS last_date
      FROM public.host_quiz_sessions hqs
      GROUP BY hqs.host_user_id
    )
    SELECT
      ah.host_user_id,
      u.email::text,
      count(DISTINCT ha.quiz_event_id) FILTER (WHERE ha.quiz_event_id IS NOT NULL)::bigint
        AS assigned_quiz_count,
      coalesce(ms.session_count, 0::bigint) AS sessions_this_month,
      coalesce(ms.payout_pence, 0::bigint) AS payout_this_month_pence,
      coalesce(al.total, 0::bigint) AS sessions_all_time,
      al.last_date AS last_session_date
    FROM approved_hosts ah
    JOIN auth.users u ON u.id = ah.host_user_id
    JOIN public.host_applications ha
      ON ha.host_user_id = ah.host_user_id
      AND ha.status = 'approved'::public.host_application_status
    LEFT JOIN month_sessions ms ON ms.host_user_id = ah.host_user_id
    LEFT JOIN all_sessions al ON al.host_user_id = ah.host_user_id
    GROUP BY ah.host_user_id, u.email, ms.session_count, ms.payout_pence, al.total, al.last_date
    ORDER BY u.email
  ) roster WHERE public.is_operator();
$$;

COMMENT ON FUNCTION public.operator_host_roster() IS
  'Operator only: approved hosts with assigned quiz count, session counts, payout from host_venue_rates fee_pence per session this month (London month), all-time sessions.';

-- ─────────────────────────────────────────────
-- operator_host_detail(p_host_user_id)
-- ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.operator_host_detail(p_host_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result jsonb;
BEGIN
  IF NOT public.is_operator() THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  SELECT jsonb_build_object(
    'assigned_quizzes', coalesce(
      (
        SELECT jsonb_agg(
          jsonb_build_object(
            'quiz_event_id', qe.id,
            'day_of_week', qe.day_of_week,
            'start_time', qe.start_time,
            'venue_name', v.name,
            'venue_id', v.id,
            'postcode', v.postcode,
            'is_active', qe.is_active
          )
          ORDER BY qe.day_of_week, qe.start_time
        )
        FROM public.host_applications ha
        INNER JOIN public.quiz_events qe ON qe.id = ha.quiz_event_id
        INNER JOIN public.venues v ON v.id = qe.venue_id
        WHERE ha.host_user_id = p_host_user_id
          AND ha.status = 'approved'::public.host_application_status
      ),
      '[]'::jsonb
    ),
    'recent_sessions', coalesce(
      (
        SELECT jsonb_agg(
          jsonb_build_object(
            'session_id', hqs.id,
            'session_date', (hqs.completed_at AT TIME ZONE 'Europe/London')::date,
            'venue_name', v.name,
            'venue_id', v.id,
            'team_count', hqs.team_count,
            'gross_pence', coalesce(hqs.gross_earnings_pence, 0),
            'fee_pence', coalesce(hvr.fee_pence, 0),
            'this_month', date_trunc(
              'month',
              (hqs.completed_at AT TIME ZONE 'Europe/London')
            ) = date_trunc(
              'month',
              (current_timestamp AT TIME ZONE 'Europe/London')
            )
          )
          ORDER BY hqs.completed_at DESC
        )
        FROM public.host_quiz_sessions hqs
        LEFT JOIN public.venues v ON v.id = hqs.venue_id
        LEFT JOIN public.host_venue_rates hvr
          ON hvr.host_user_id = hqs.host_user_id
          AND hvr.venue_id = hqs.venue_id
        WHERE hqs.host_user_id = p_host_user_id
      ),
      '[]'::jsonb
    ),
    'venue_rates', coalesce(
      (
        SELECT jsonb_agg(
          jsonb_build_object(
            'venue_id', v.id,
            'venue_name', v.name,
            'postcode', v.postcode,
            'fee_pence', hvr.fee_pence,
            'notes', hvr.notes
          )
          ORDER BY v.name
        )
        FROM public.host_venue_rates hvr
        INNER JOIN public.venues v ON v.id = hvr.venue_id
        WHERE hvr.host_user_id = p_host_user_id
      ),
      '[]'::jsonb
    )
  )
  INTO result;

  RETURN result;
END;
$$;

COMMENT ON FUNCTION public.operator_host_detail(uuid) IS
  'Operator only: JSON with assigned quizzes, recent sessions (gross_earnings_pence as gross_pence), and host_venue_rates.';

REVOKE ALL ON FUNCTION public.operator_host_roster() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.operator_host_roster() TO authenticated;

REVOKE ALL ON FUNCTION public.operator_host_detail(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.operator_host_detail(uuid) TO authenticated;
