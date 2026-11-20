-- Enforce that a farmer can assign work only to handler profiles owned by that farmer.
DROP POLICY IF EXISTS "Farmers can manage their tasks" ON public.handler_tasks;
CREATE POLICY "Farmers manage tasks for their own handlers"
  ON public.handler_tasks
  FOR ALL
  TO authenticated
  USING (
    farmer_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.handlers h
      WHERE h.id = handler_tasks.handler_id
        AND h.farmer_id = auth.uid()
    )
  )
  WITH CHECK (
    farmer_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.handlers h
      WHERE h.id = handler_tasks.handler_id
        AND h.farmer_id = auth.uid()
    )
  );

-- A handler may update only a task assigned to their own handler profile and
-- cannot change its farmer/handler ownership while completing the task.
DROP POLICY IF EXISTS "Handlers can update assigned tasks" ON public.handler_tasks;
CREATE POLICY "Handlers update only their assigned tasks"
  ON public.handler_tasks
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.handlers h
      WHERE h.id = handler_tasks.handler_id
        AND h.user_id = auth.uid()
        AND h.farmer_id = handler_tasks.farmer_id
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.handlers h
      WHERE h.id = handler_tasks.handler_id
        AND h.user_id = auth.uid()
        AND h.farmer_id = handler_tasks.farmer_id
    )
  );

-- Issue reports must always be associated with the farmer who owns the
-- reporting handler profile; clients cannot redirect a report to another farm.
DROP POLICY IF EXISTS "Handlers can manage own issues" ON public.handler_issues;
CREATE POLICY "Handlers manage issues for their own farm"
  ON public.handler_issues
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.handlers h
      WHERE h.id = handler_issues.handler_id
        AND h.user_id = auth.uid()
        AND h.farmer_id = handler_issues.farmer_id
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.handlers h
      WHERE h.id = handler_issues.handler_id
        AND h.user_id = auth.uid()
        AND h.farmer_id = handler_issues.farmer_id
    )
  );
