-- Device tokens for outbound push (Expo push token string). Player app should upsert here when notifications are enabled.
-- Until the mobile host journey registers tokens, publican “notify attendees” will report 0 deliveries with interested count only.

CREATE TABLE IF NOT EXISTS public.push_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  token text NOT NULL,
  platform text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, token)
);

COMMENT ON TABLE public.push_tokens IS
  'Expo push tokens per user (ExponentPushToken[...]). Register from the player app after notification permission.';

CREATE INDEX IF NOT EXISTS idx_push_tokens_user_id ON public.push_tokens (user_id);
CREATE INDEX IF NOT EXISTS idx_push_tokens_user_updated ON public.push_tokens (user_id, updated_at DESC);

ALTER TABLE public.push_tokens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users read own push tokens" ON public.push_tokens;
CREATE POLICY "Users read own push tokens"
  ON public.push_tokens
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users insert own push tokens" ON public.push_tokens;
CREATE POLICY "Users insert own push tokens"
  ON public.push_tokens
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users update own push tokens" ON public.push_tokens;
CREATE POLICY "Users update own push tokens"
  ON public.push_tokens
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users delete own push tokens" ON public.push_tokens;
CREATE POLICY "Users delete own push tokens"
  ON public.push_tokens
  FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());
