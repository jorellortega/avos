-- Bucket `files`: public read; CEO (jwt_user_is_ceo) can upload/update/delete.
-- Apply after 20250412900000_fix_users_rls_recursion.sql (jwt_user_is_ceo).

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'files',
  'files',
  true,
  10485760,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml']
)
ON CONFLICT (id) DO UPDATE
SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "Public read files bucket" ON storage.objects;
CREATE POLICY "Public read files bucket"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'files');

DROP POLICY IF EXISTS "CEO insert files bucket" ON storage.objects;
CREATE POLICY "CEO insert files bucket"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'files'
    AND public.jwt_user_is_ceo()
  );

DROP POLICY IF EXISTS "CEO update files bucket" ON storage.objects;
CREATE POLICY "CEO update files bucket"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'files' AND public.jwt_user_is_ceo())
  WITH CHECK (bucket_id = 'files' AND public.jwt_user_is_ceo());

DROP POLICY IF EXISTS "CEO delete files bucket" ON storage.objects;
CREATE POLICY "CEO delete files bucket"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'files' AND public.jwt_user_is_ceo());
