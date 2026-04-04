-- Hosts are signed-in users whose email appears in host_allowlisted_emails (lowercase).
-- Answers move to quiz_answers; only allowlisted hosts can SELECT them (RLS).
-- Manage the list in SQL Editor or service role (no client write policies).

CREATE TABLE IF NOT EXISTS host_allowlisted_emails (
  email text PRIMARY KEY
);

COMMENT ON TABLE host_allowlisted_emails IS 'Host app users allowed to load quiz answers. Store lowercase emails; add/remove via dashboard SQL or admin tools.';

CREATE TABLE IF NOT EXISTS quiz_answers (
  question_id uuid PRIMARY KEY REFERENCES quiz_questions(id) ON DELETE CASCADE,
  answer text NOT NULL
);

COMMENT ON TABLE quiz_answers IS 'Host-only answers; RLS restricts SELECT to allowlisted authenticated emails.';

INSERT INTO quiz_answers (question_id, answer)
SELECT id, answer FROM quiz_questions;

ALTER TABLE quiz_questions DROP COLUMN answer;

ALTER TABLE host_allowlisted_emails ENABLE ROW LEVEL SECURITY;
ALTER TABLE quiz_answers ENABLE ROW LEVEL SECURITY;

-- Read allowlist only inside security definer helper (not directly from clients).
CREATE OR REPLACE FUNCTION public.is_allowlisted_host()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM host_allowlisted_emails h
    WHERE auth.jwt() IS NOT NULL
      AND lower(trim(h.email)) = lower(trim(COALESCE(
        auth.jwt()->>'email',
        auth.jwt()->'user_metadata'->>'email',
        ''
      )))
      AND COALESCE(
        NULLIF(trim(auth.jwt()->>'email'), ''),
        NULLIF(trim(auth.jwt()->'user_metadata'->>'email'), '')
      ) IS NOT NULL
  );
$$;

REVOKE ALL ON FUNCTION public.is_allowlisted_host() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_allowlisted_host() TO anon;
GRANT EXECUTE ON FUNCTION public.is_allowlisted_host() TO authenticated;

CREATE POLICY "Allowlisted hosts read answers"
  ON quiz_answers
  FOR SELECT
  TO authenticated
  USING (is_allowlisted_host());

-- Optional starter rows (comment out if you prefer an empty allowlist):
-- INSERT INTO host_allowlisted_emails (email) VALUES ('your.name@example.com') ON CONFLICT DO NOTHING;
