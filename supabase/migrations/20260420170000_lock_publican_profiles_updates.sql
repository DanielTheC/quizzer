-- Remove self-service profile updates on publican_profiles.
-- Publicans no longer manage their own row (they could otherwise rewrite
-- venue_id and gain publican access to any venue). Operators manage these
-- via the admin portal and the create-publican API route (service role).

DROP POLICY IF EXISTS "Publican updates own profile" ON public.publican_profiles;
