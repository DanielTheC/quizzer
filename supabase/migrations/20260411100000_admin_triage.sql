-- Host application → quiz linking (for “unhosted” triage), operator RLS/RPCs for /admin triage.

ALTER TABLE public.host_applications
  ADD COLUMN IF NOT EXISTS quiz_event_id uuid REFERENCES public.quiz_events (id) ON DELETE SET NULL;

ALTER TABLE public.host_applications
  ADD COLUMN IF NOT EXISTS rejection_reason text;

COMMENT ON COLUMN public.host_applications.quiz_event_id IS 'When set, an approved application claims host duties for this recurring quiz slot.';
COMMENT ON COLUMN public.host_applications.rejection_reason IS 'Optional note when status = rejected (admin only).';

CREATE INDEX IF NOT EXISTS idx_host_applications_quiz_event
  ON public.host_applications (quiz_event_id)
  WHERE quiz_event_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_host_applications_status_created
  ON public.host_applications (status, created_at ASC);

-- Operators (operator_users / is_operator) may review applications.
DROP POLICY IF EXISTS "Operators read all host applications" ON public.host_applications;
CREATE POLICY "Operators read all host applications"
  ON public.host_applications
  FOR SELECT
  TO authenticated
  USING (public.is_operator());

DROP POLICY IF EXISTS "Operators update host applications" ON public.host_applications;
CREATE POLICY "Operators update host applications"
  ON public.host_applications
  FOR UPDATE
  TO authenticated
  USING (public.is_operator())
  WITH CHECK (public.is_operator());

-- Allow operators to add host emails when approving applications.
DROP POLICY IF EXISTS "Operators insert host allowlist emails" ON public.host_allowlisted_emails;
CREATE POLICY "Operators insert host allowlist emails"
  ON public.host_allowlisted_emails
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_operator());

-- Publican messages: allow dashboard operators as well as email-allowlisted operators.
DROP POLICY IF EXISTS "Operators read all publican messages" ON public.publican_messages;
CREATE POLICY "Operators read all publican messages"
  ON public.publican_messages
  FOR SELECT
  TO authenticated
  USING (public.is_allowlisted_operator() OR public.is_operator());

DROP POLICY IF EXISTS "Operators update publican messages" ON public.publican_messages;
CREATE POLICY "Operators update publican messages"
  ON public.publican_messages
  FOR UPDATE
  TO authenticated
  USING (public.is_allowlisted_operator() OR public.is_operator())
  WITH CHECK (public.is_allowlisted_operator() OR public.is_operator());

-- Full quiz read for operator triage (unhosted panel).
DROP POLICY IF EXISTS "Operators read all quiz events" ON public.quiz_events;
CREATE POLICY "Operators read all quiz events"
  ON public.quiz_events
  FOR SELECT
  TO authenticated
  USING (public.is_operator());

CREATE OR REPLACE FUNCTION public.operator_approve_host_application(p_application_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r public.host_applications%ROWTYPE;
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

  UPDATE public.host_applications
  SET
    status = 'approved'::public.host_application_status,
    reviewed_at = now(),
    rejection_reason = NULL
  WHERE id = p_application_id;

  INSERT INTO public.host_allowlisted_emails (email)
  VALUES (lower(trim(r.email)))
  ON CONFLICT (email) DO NOTHING;
END;
$$;

COMMENT ON FUNCTION public.operator_approve_host_application(uuid) IS 'Operator only: approve pending host application and add email to host_allowlisted_emails.';

REVOKE ALL ON FUNCTION public.operator_approve_host_application(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.operator_approve_host_application(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.operator_triage_unhosted_quizzes()
RETURNS TABLE (
  quiz_event_id uuid,
  venue_id uuid,
  venue_name text,
  day_of_week integer,
  start_time text,
  interest_count bigint,
  next_occurrence date
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH tz AS (
    SELECT
      (current_timestamp AT TIME ZONE 'Europe/London')::date AS d,
      EXTRACT(DOW FROM (current_timestamp AT TIME ZONE 'Europe/London')::date)::integer AS cdow
  )
  SELECT
    q.id AS quiz_event_id,
    q.venue_id,
    coalesce(v.name, '')::text AS venue_name,
    q.day_of_week::integer AS day_of_week,
    q.start_time::text AS start_time,
    (SELECT count(*)::bigint FROM public.quiz_event_interests i WHERE i.quiz_event_id = q.id) AS interest_count,
    (
      (SELECT d FROM tz) + ((q.day_of_week - (SELECT cdow FROM tz) + 7) % 7) * INTERVAL '1 day'
    )::date AS next_occurrence
  FROM public.quiz_events q
  INNER JOIN public.venues v ON v.id = q.venue_id
  WHERE q.is_active = true
    AND q.host_cancelled_at IS NULL
    AND NOT EXISTS (
      SELECT 1 FROM public.host_applications ha
      WHERE ha.quiz_event_id = q.id
        AND ha.status = 'approved'::public.host_application_status
    )
    AND public.is_operator();
$$;

COMMENT ON FUNCTION public.operator_triage_unhosted_quizzes() IS
  'Active non-cancelled quizzes with no approved host_application claiming this quiz_event_id.';

REVOKE ALL ON FUNCTION public.operator_triage_unhosted_quizzes() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.operator_triage_unhosted_quizzes() TO authenticated;
