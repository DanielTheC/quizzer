-- Public Supabase Storage bucket: venue-images
-- Create this manually in the Supabase dashboard:
--   Storage → New bucket → Name: "venue-images" → Public: ON
-- Or via CLI: supabase storage create venue-images --public

-- venue_images: one row per uploaded photo for a venue
CREATE TABLE public.venue_images (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id     uuid        NOT NULL REFERENCES public.venues(id) ON DELETE CASCADE,
  storage_path text        NOT NULL,   -- path within the venue-images bucket
  alt_text     text,                   -- optional caption / screen-reader text
  sort_order   int         NOT NULL DEFAULT 0,
  uploaded_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_venue_images_venue_id_sort_order ON public.venue_images (venue_id, sort_order);

ALTER TABLE public.venue_images ENABLE ROW LEVEL SECURITY;

-- Anyone (including anon) can read venue images
CREATE POLICY "public_read_venue_images"
  ON public.venue_images FOR SELECT
  USING (true);

-- Only operators can insert/update/delete
CREATE POLICY "operator_write_venue_images"
  ON public.venue_images FOR ALL
  TO authenticated
  USING (public.is_operator())
  WITH CHECK (public.is_operator());

GRANT SELECT ON public.venue_images TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.venue_images TO authenticated;
