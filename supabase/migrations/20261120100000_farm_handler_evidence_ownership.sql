-- Keep handler evidence attached only to tasks assigned to that handler.
DROP POLICY IF EXISTS "Handlers can manage own evidence" ON public.task_evidence;
CREATE POLICY "Handlers can manage evidence for assigned tasks"
  ON public.task_evidence FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.handlers h
      JOIN public.handler_tasks t ON t.handler_id = h.id
      WHERE h.id = task_evidence.handler_id
        AND h.user_id = auth.uid()
        AND t.id = task_evidence.task_id
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.handlers h
      JOIN public.handler_tasks t ON t.handler_id = h.id
      WHERE h.id = task_evidence.handler_id
        AND h.user_id = auth.uid()
        AND t.id = task_evidence.task_id
    )
  );

-- Upload paths are <handler_id>/<task_id>/<file>. Restrict inserts to the
-- authenticated handler who owns the handler profile and assigned task.
DROP POLICY IF EXISTS "Handlers can upload evidence" ON storage.objects;
CREATE POLICY "Handlers can upload evidence for assigned tasks"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'handler-evidence'
    AND array_length(storage.foldername(name), 1) >= 2
    AND EXISTS (
      SELECT 1
      FROM public.handlers h
      JOIN public.handler_tasks t ON t.handler_id = h.id
      WHERE h.user_id = auth.uid()
        AND h.id::text = (storage.foldername(name))[1]
        AND t.id::text = (storage.foldername(name))[2]
    )
  );
