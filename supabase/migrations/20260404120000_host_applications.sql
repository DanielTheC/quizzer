-- Self-service host access requests (review/approve in SQL or dashboard; not app-managed).

DO $$
BEGIN
  CREATE TYPE host_application_status AS ENUM ('pending', 'approved', 'rejected');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS host_applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  full_name text NOT NULL,
  phone text NOT NULL,
  experience_notes text NOT NULL,
  status host_application_status NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  reviewed_at timestamptz
);

COMMENT ON TABLE host_applications IS 'Host access requests; email must match authenticated user on insert/select.';

CREATE UNIQUE INDEX IF NOT EXISTS host_applications_one_pending_per_email
  ON host_applications (lower(trim(email)))
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS host_applications_email_created
  ON host_applications (lower(trim(email)), created_at DESC);

ALTER TABLE host_applications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users insert own host application" ON host_applications;
CREATE POLICY "Users insert own host application"
  ON host_applications
  FOR INSERT
  TO authenticated
  WITH CHECK (
    status = 'pending'
    AND reviewed_at IS NULL
    AND lower(trim(email)) = lower(trim(COALESCE(
      NULLIF(trim(auth.jwt()->>'email'), ''),
      NULLIF(trim(auth.jwt()->'user_metadata'->>'email'), ''),
      ''
    )))
    AND COALESCE(
      NULLIF(trim(auth.jwt()->>'email'), ''),
      NULLIF(trim(auth.jwt()->'user_metadata'->>'email'), '')
    ) IS NOT NULL
  );

DROP POLICY IF EXISTS "Users read own host applications" ON host_applications;
CREATE POLICY "Users read own host applications"
  ON host_applications
  FOR SELECT
  TO authenticated
  USING (
    lower(trim(email)) = lower(trim(COALESCE(
      NULLIF(trim(auth.jwt()->>'email'), ''),
      NULLIF(trim(auth.jwt()->'user_metadata'->>'email'), ''),
      ''
    )))
  );

-- No client UPDATE/DELETE; admins use service role or SQL to set status/reviewed_at.
