-- Optional display names for allowlisted hosts (portal / admin).

ALTER TABLE public.host_allowlisted_emails
  ADD COLUMN IF NOT EXISTS first_name text,
  ADD COLUMN IF NOT EXISTS last_name text;
