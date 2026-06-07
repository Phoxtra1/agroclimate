
CREATE POLICY "Users read own drone media files" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'drone-media' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users upload own drone media files" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'drone-media' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users update own drone media files" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'drone-media' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users delete own drone media files" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'drone-media' AND auth.uid()::text = (storage.foldername(name))[1]);
