REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, service_role;

DROP POLICY IF EXISTS "Anyone can view evidence" ON storage.objects;
CREATE POLICY "Public reads handler evidence by folder"
ON storage.objects
FOR SELECT
TO public
USING (
  bucket_id = 'handler-evidence'
  AND array_length(storage.foldername(name), 1) >= 1
);

DROP POLICY IF EXISTS "Public read harvest photos" ON storage.objects;
CREATE POLICY "Public reads harvest photos by folder"
ON storage.objects
FOR SELECT
TO public
USING (
  bucket_id = 'harvest-photos'
  AND array_length(storage.foldername(name), 1) >= 1
);

DROP POLICY IF EXISTS "Public read supply images" ON storage.objects;
CREATE POLICY "Public reads supply images by folder"
ON storage.objects
FOR SELECT
TO public
USING (
  bucket_id = 'supply-images'
  AND array_length(storage.foldername(name), 1) >= 1
);