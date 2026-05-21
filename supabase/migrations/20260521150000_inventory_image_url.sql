-- Product thumbnail for inventory rows.

ALTER TABLE public.inventory_items
  ADD COLUMN IF NOT EXISTS image_url text NOT NULL DEFAULT '';

COMMENT ON COLUMN public.inventory_items.image_url IS 'Public image URL (Supabase files/inventory/…).';

-- Manager / CEO can upload inventory photos to the files bucket.
DROP POLICY IF EXISTS "Manager CEO insert inventory files" ON storage.objects;
CREATE POLICY "Manager CEO insert inventory files"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'files'
    AND (storage.foldername(name))[1] = 'inventory'
    AND public.jwt_user_is_manager_or_ceo()
  );

DROP POLICY IF EXISTS "Manager CEO update inventory files" ON storage.objects;
CREATE POLICY "Manager CEO update inventory files"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'files'
    AND (storage.foldername(name))[1] = 'inventory'
    AND public.jwt_user_is_manager_or_ceo()
  )
  WITH CHECK (
    bucket_id = 'files'
    AND (storage.foldername(name))[1] = 'inventory'
    AND public.jwt_user_is_manager_or_ceo()
  );
