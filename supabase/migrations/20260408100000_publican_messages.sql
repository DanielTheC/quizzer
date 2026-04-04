-- Publican → operator messaging (venue- or quiz-scoped). Operators use allowlisted emails like hosts.

DO $$
BEGIN
  CREATE TYPE public.publican_message_type AS ENUM (
    'cancellation_request',
    'special_request',
    'complaint',
    'host_request',
    'general'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE public.publican_message_status AS ENUM (
    'open',
    'in_progress',
    'resolved'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS public.operator_allowlisted_emails (
  email text PRIMARY KEY
);

COMMENT ON TABLE public.operator_allowlisted_emails IS
  'Quizzer operators (dashboard / SQL). Lowercase emails; add via service role. Used by is_allowlisted_operator() for RLS.';

ALTER TABLE public.operator_allowlisted_emails ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.publican_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  publican_user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users (id) ON DELETE CASCADE,
  venue_id uuid NOT NULL REFERENCES public.venues (id) ON DELETE CASCADE,
  quiz_event_id uuid REFERENCES public.quiz_events (id) ON DELETE SET NULL,
  message_type public.publican_message_type NOT NULL,
  body text NOT NULL,
  status public.publican_message_status NOT NULL DEFAULT 'open',
  operator_reply text,
  created_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  CONSTRAINT publican_messages_body_not_empty CHECK (length(trim(body)) > 0)
);

COMMENT ON TABLE public.publican_messages IS
  'Publican requests to operators; one operator_reply per row until full threading exists.';
COMMENT ON COLUMN public.publican_messages.operator_reply IS 'Single operator response shown to the publican inline.';

CREATE INDEX IF NOT EXISTS idx_publican_messages_publican_user ON public.publican_messages (publican_user_id);
CREATE INDEX IF NOT EXISTS idx_publican_messages_venue ON public.publican_messages (venue_id);
CREATE INDEX IF NOT EXISTS idx_publican_messages_created ON public.publican_messages (created_at DESC);

-- Optional starter allowlist (comment out if empty):
-- INSERT INTO public.operator_allowlisted_emails (email) VALUES ('you@example.com') ON CONFLICT DO NOTHING;

CREATE OR REPLACE FUNCTION public.is_allowlisted_operator()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.operator_allowlisted_emails o
    WHERE auth.jwt() IS NOT NULL
      AND lower(trim(o.email)) = lower(trim(COALESCE(
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

COMMENT ON FUNCTION public.is_allowlisted_operator() IS 'True if JWT email is in operator_allowlisted_emails (lowercase).';

REVOKE ALL ON FUNCTION public.is_allowlisted_operator() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_allowlisted_operator() TO anon;
GRANT EXECUTE ON FUNCTION public.is_allowlisted_operator() TO authenticated;

CREATE OR REPLACE FUNCTION public.publican_messages_validate_quiz_venue()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.quiz_event_id IS NULL THEN
    RETURN NEW;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.quiz_events q
    WHERE q.id = NEW.quiz_event_id AND q.venue_id = NEW.venue_id
  ) THEN
    RAISE EXCEPTION 'quiz_event_id must reference a quiz_event for the same venue_id';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS publican_messages_validate_quiz_venue_trigger ON public.publican_messages;
CREATE TRIGGER publican_messages_validate_quiz_venue_trigger
  BEFORE INSERT OR UPDATE OF quiz_event_id, venue_id ON public.publican_messages
  FOR EACH ROW
  EXECUTE PROCEDURE public.publican_messages_validate_quiz_venue();

ALTER TABLE public.publican_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Publicans read own messages" ON public.publican_messages;
CREATE POLICY "Publicans read own messages"
  ON public.publican_messages
  FOR SELECT
  TO authenticated
  USING (publican_user_id = auth.uid());

DROP POLICY IF EXISTS "Operators read all publican messages" ON public.publican_messages;
CREATE POLICY "Operators read all publican messages"
  ON public.publican_messages
  FOR SELECT
  TO authenticated
  USING (public.is_allowlisted_operator());

DROP POLICY IF EXISTS "Publicans insert messages for managed venues" ON public.publican_messages;
CREATE POLICY "Publicans insert messages for managed venues"
  ON public.publican_messages
  FOR INSERT
  TO authenticated
  WITH CHECK (
    publican_user_id = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.publican_venues pv
      WHERE pv.user_id = auth.uid()
        AND pv.venue_id = publican_messages.venue_id
    )
  );

DROP POLICY IF EXISTS "Operators update publican messages" ON public.publican_messages;
CREATE POLICY "Operators update publican messages"
  ON public.publican_messages
  FOR UPDATE
  TO authenticated
  USING (public.is_allowlisted_operator())
  WITH CHECK (public.is_allowlisted_operator());
