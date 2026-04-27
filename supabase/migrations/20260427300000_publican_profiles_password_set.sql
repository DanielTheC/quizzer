BEGIN;

ALTER TABLE public.publican_profiles
  ADD COLUMN IF NOT EXISTS password_set_at timestamptz;

COMMENT ON COLUMN public.publican_profiles.password_set_at IS
  'Set when the publican first chooses a password via /portal/welcome. Null = first-run still pending.';

CREATE OR REPLACE FUNCTION public.mark_publican_password_set()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.publican_profiles
  SET password_set_at = now()
  WHERE id = auth.uid()
    AND password_set_at IS NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.mark_publican_password_set() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mark_publican_password_set() TO authenticated;

COMMIT;
