-- Operators need SELECT/DELETE on host_allowlisted_emails for /admin/hosts allowlist UI.
-- Table uses email as primary key only (no id / created_at).

DROP POLICY IF EXISTS "Operators read host allowlist emails" ON public.host_allowlisted_emails;
CREATE POLICY "Operators read host allowlist emails"
  ON public.host_allowlisted_emails
  FOR SELECT
  TO authenticated
  USING (public.is_operator());

DROP POLICY IF EXISTS "Operators delete host allowlist emails" ON public.host_allowlisted_emails;
CREATE POLICY "Operators delete host allowlist emails"
  ON public.host_allowlisted_emails
  FOR DELETE
  TO authenticated
  USING (public.is_operator());
