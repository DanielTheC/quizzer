-- Per-event host fee override (NULL = use host's default_fee_pence).
ALTER TABLE public.quiz_events
  ADD COLUMN IF NOT EXISTS host_fee_pence integer;

-- Claims table: hosts request a quiz, operator approves/rejects.
CREATE TABLE IF NOT EXISTS public.quiz_claims (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quiz_event_id  uuid NOT NULL REFERENCES public.quiz_events(id) ON DELETE CASCADE,
  host_user_id   uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  host_email     text NOT NULL,
  status         text NOT NULL DEFAULT 'pending'
                   CHECK (status IN ('pending', 'confirmed', 'rejected', 'cancelled')),
  claimed_at     timestamptz NOT NULL DEFAULT now(),
  reviewed_at    timestamptz,
  notes          text
);

CREATE INDEX IF NOT EXISTS idx_quiz_claims_event   ON public.quiz_claims(quiz_event_id);
CREATE INDEX IF NOT EXISTS idx_quiz_claims_host    ON public.quiz_claims(host_user_id);
CREATE INDEX IF NOT EXISTS idx_quiz_claims_status  ON public.quiz_claims(status);

-- Only one pending or confirmed claim per quiz at a time.
CREATE UNIQUE INDEX IF NOT EXISTS quiz_claims_one_active
  ON public.quiz_claims (quiz_event_id)
  WHERE status IN ('pending', 'confirmed');

ALTER TABLE public.quiz_claims ENABLE ROW LEVEL SECURITY;

-- Hosts: insert own claim, read own claims, cancel own pending claim.
CREATE POLICY "Hosts insert own claim"
  ON public.quiz_claims FOR INSERT TO authenticated
  WITH CHECK (host_user_id = auth.uid() AND public.is_allowlisted_host());

CREATE POLICY "Hosts read own claims"
  ON public.quiz_claims FOR SELECT TO authenticated
  USING (host_user_id = auth.uid());

CREATE POLICY "Hosts cancel own pending claim"
  ON public.quiz_claims FOR UPDATE TO authenticated
  USING (host_user_id = auth.uid() AND status = 'pending')
  WITH CHECK (status = 'cancelled');

-- Operators: full read + status management.
CREATE POLICY "Operators read all claims"
  ON public.quiz_claims FOR SELECT TO authenticated
  USING (public.is_operator());

CREATE POLICY "Operators update claims"
  ON public.quiz_claims FOR UPDATE TO authenticated
  USING (public.is_operator())
  WITH CHECK (public.is_operator());

CREATE POLICY "Operators delete claims"
  ON public.quiz_claims FOR DELETE TO authenticated
  USING (public.is_operator());
