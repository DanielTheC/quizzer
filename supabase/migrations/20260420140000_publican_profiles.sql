-- Venue publicans (publicans) linked 1:1 to auth.users and their venue.

CREATE TABLE IF NOT EXISTS public.publican_profiles (
  id          uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  venue_id    uuid NOT NULL REFERENCES public.venues(id) ON DELETE CASCADE,
  email       text NOT NULL,
  first_name  text,
  last_name   text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.publican_profiles ENABLE ROW LEVEL SECURITY;

-- Publicans can read and update their own profile
CREATE POLICY "Publican reads own profile"
  ON public.publican_profiles FOR SELECT TO authenticated
  USING (id = auth.uid());

CREATE POLICY "Publican updates own profile"
  ON public.publican_profiles FOR UPDATE TO authenticated
  USING (id = auth.uid()) WITH CHECK (id = auth.uid());

-- Publicans can read their own venue via their profile
DROP POLICY IF EXISTS "Publican reads own venue" ON public.venues;
CREATE POLICY "Publican reads own venue"
  ON public.venues FOR SELECT TO authenticated
  USING (
    id IN (SELECT venue_id FROM public.publican_profiles WHERE id = auth.uid())
  );

-- Publicans can read quiz events for their venue
DROP POLICY IF EXISTS "Publican reads own quiz events" ON public.quiz_events;
CREATE POLICY "Publican reads own quiz events"
  ON public.quiz_events FOR SELECT TO authenticated
  USING (
    venue_id IN (SELECT venue_id FROM public.publican_profiles WHERE id = auth.uid())
  );

-- Operators manage all profiles
CREATE POLICY "Operators manage publican profiles"
  ON public.publican_profiles FOR ALL TO authenticated
  USING (public.is_operator()) WITH CHECK (public.is_operator());
