-- Default host fee stored on the allowlist entry.
-- Per-event overrides live on quiz_events (migration 2).

ALTER TABLE public.host_allowlisted_emails
  ADD COLUMN IF NOT EXISTS default_fee_pence integer NOT NULL DEFAULT 0;

-- Allowlisted hosts may read their own row (to display their default fee in-app).
DROP POLICY IF EXISTS "Host reads own allowlist entry" ON public.host_allowlisted_emails;
CREATE POLICY "Host reads own allowlist entry"
  ON public.host_allowlisted_emails
  FOR SELECT
  TO authenticated
  USING (
    lower(trim(email)) = lower(trim(
      COALESCE(
        NULLIF(trim(auth.jwt()->>'email'), ''),
        NULLIF(trim(auth.jwt()->'user_metadata'->>'email'), ''),
        ''
      )
    ))
  );

-- Operators may UPDATE the default fee.
DROP POLICY IF EXISTS "Operators update host_allowlisted_emails" ON public.host_allowlisted_emails;
CREATE POLICY "Operators update host_allowlisted_emails"
  ON public.host_allowlisted_emails
  FOR UPDATE
  TO authenticated
  USING (public.is_operator())
  WITH CHECK (public.is_operator());
