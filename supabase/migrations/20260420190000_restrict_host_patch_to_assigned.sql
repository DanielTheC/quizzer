-- Restrict host_patch_quiz_event_host_fields() to only allow allowlisted hosts
-- who are actually assigned to the quiz via a pending/confirmed quiz_claims row.
-- Previously any allowlisted host could cancel any quiz event.
--
-- Signature and return type preserved (uuid, text, boolean, timestamptz, boolean) RETURNS boolean
-- so that CREATE OR REPLACE actually replaces the existing function and current
-- frontend callers (HostDashboardScreen.tsx) continue to work unchanged.

CREATE OR REPLACE FUNCTION public.host_patch_quiz_event_host_fields(
  p_quiz_event_id uuid,
  p_capacity_note text,
  p_update_note boolean,
  p_cancelled_at timestamptz,
  p_update_cancellation boolean
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_allowlisted_host() THEN
    RETURN false;
  END IF;

  -- Caller must be assigned to this quiz via a live quiz_claims row.
  IF NOT EXISTS (
    SELECT 1
    FROM public.quiz_claims
    WHERE quiz_event_id = p_quiz_event_id
      AND host_user_id = auth.uid()
      AND status IN ('pending', 'confirmed')
  ) THEN
    RETURN false;
  END IF;

  UPDATE public.quiz_events
  SET
    host_capacity_note = CASE WHEN p_update_note         THEN p_capacity_note ELSE host_capacity_note END,
    host_cancelled_at  = CASE WHEN p_update_cancellation THEN p_cancelled_at  ELSE host_cancelled_at  END
  WHERE id = p_quiz_event_id;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.host_patch_quiz_event_host_fields(uuid, text, boolean, timestamptz, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.host_patch_quiz_event_host_fields(uuid, text, boolean, timestamptz, boolean) TO authenticated;
