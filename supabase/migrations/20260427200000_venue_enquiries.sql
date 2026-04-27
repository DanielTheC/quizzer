BEGIN;

DO $$
BEGIN
  CREATE TYPE public.venue_enquiry_status AS ENUM (
    'new', 'in_progress', 'converted', 'rejected'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$
BEGIN
  CREATE TYPE public.venue_enquiry_frequency AS ENUM (
    'one_off', 'weekly', 'monthly', 'not_sure'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$
BEGIN
  CREATE TYPE public.venue_enquiry_existing AS ENUM (
    'already_runs', 'wants_to_start'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.venue_enquiries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_name text NOT NULL,
  contact_name text NOT NULL,
  email text NOT NULL,
  phone text,
  city text,
  frequency public.venue_enquiry_frequency,
  existing public.venue_enquiry_existing,
  message text,
  status public.venue_enquiry_status NOT NULL DEFAULT 'new',
  source_ip text,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now(),
  reviewed_at timestamptz,
  operator_notes text,
  CONSTRAINT venue_enquiries_email_shape CHECK (email ~* '^[^\s@]+@[^\s@]+\.[^\s@]+$'),
  CONSTRAINT venue_enquiries_venue_name_len CHECK (length(trim(venue_name)) BETWEEN 2 AND 200),
  CONSTRAINT venue_enquiries_contact_len   CHECK (length(trim(contact_name)) BETWEEN 2 AND 200),
  CONSTRAINT venue_enquiries_message_len   CHECK (message IS NULL OR length(message) <= 4000)
);

CREATE INDEX IF NOT EXISTS idx_venue_enquiries_status_created
  ON public.venue_enquiries (status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_venue_enquiries_email_lower
  ON public.venue_enquiries ((lower(trim(email))));

ALTER TABLE public.venue_enquiries ENABLE ROW LEVEL SECURITY;

-- Operators read all
DROP POLICY IF EXISTS "Operators read venue enquiries" ON public.venue_enquiries;
CREATE POLICY "Operators read venue enquiries"
  ON public.venue_enquiries FOR SELECT
  TO authenticated
  USING (public.is_operator());

-- Operators update (status / notes)
DROP POLICY IF EXISTS "Operators update venue enquiries" ON public.venue_enquiries;
CREATE POLICY "Operators update venue enquiries"
  ON public.venue_enquiries FOR UPDATE
  TO authenticated
  USING (public.is_operator())
  WITH CHECK (public.is_operator());

-- No INSERT policy. Inserts only via the service-role API route.

COMMIT;
