-- Operator dashboard accounts (auth user id + display name). Rows added manually via SQL or service role.

CREATE TABLE IF NOT EXISTS public.operator_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users (id) ON DELETE CASCADE,
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.operator_users IS
  'Quizzer internal operators; grant access with INSERT (service role / SQL) only. Checked by is_operator().';

CREATE INDEX IF NOT EXISTS idx_operator_users_user_id ON public.operator_users (user_id);

CREATE OR REPLACE FUNCTION public.is_operator()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.operator_users ou
    WHERE ou.user_id = auth.uid()
  );
$$;

COMMENT ON FUNCTION public.is_operator() IS 'True if auth.uid() has a row in operator_users.';

REVOKE ALL ON FUNCTION public.is_operator() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_operator() TO anon;
GRANT EXECUTE ON FUNCTION public.is_operator() TO authenticated;

ALTER TABLE public.operator_users ENABLE ROW LEVEL SECURITY;

-- No self-join: each auth user may only read their own operator row (non-operators get an empty result).
DROP POLICY IF EXISTS "Operators read own operator row" ON public.operator_users;
CREATE POLICY "Operators read own operator row"
  ON public.operator_users
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Example (use real auth user id from auth.users):
-- INSERT INTO public.operator_users (user_id, name) VALUES ('00000000-0000-0000-0000-000000000000', 'Your Name');
