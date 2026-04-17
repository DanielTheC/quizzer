-- Storage RLS policies for the venue-images bucket.
-- A public bucket grants anonymous read but writes require explicit policies.

CREATE POLICY "operator_upload_venue_images"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'venue-images'
    AND EXISTS (
      SELECT 1 FROM public.operator_users
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "operator_update_venue_images"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'venue-images'
    AND EXISTS (
      SELECT 1 FROM public.operator_users
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "operator_delete_venue_images"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'venue-images'
    AND EXISTS (
      SELECT 1 FROM public.operator_users
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "public_read_venue_images_objects"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'venue-images');
