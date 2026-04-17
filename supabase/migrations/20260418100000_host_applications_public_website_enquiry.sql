-- Public /host-a-quiz marketing form: allow pending rows without requiring auth email match.
-- Existing policy "Users insert own host application" remains for in-app authenticated sign-ups.

DROP POLICY IF EXISTS "Public website host enquiry insert" ON public.host_applications;
CREATE POLICY "Public website host enquiry insert"
  ON public.host_applications
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    status = 'pending'::public.host_application_status
    AND reviewed_at IS NULL
  );
