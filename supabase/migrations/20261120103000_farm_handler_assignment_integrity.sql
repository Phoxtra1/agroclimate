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

-- Serialize clock-in attempts per handler and prevent concurrent active sessions.
CREATE OR REPLACE FUNCTION public.enforce_single_active_handler_session()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended(NEW.handler_id::text, 0));

  IF NEW.clock_out IS NULL AND EXISTS (
    SELECT 1
    FROM public.work_sessions s
    WHERE s.handler_id = NEW.handler_id
      AND s.clock_out IS NULL
      AND s.id IS DISTINCT FROM NEW.id
  ) THEN
    RAISE EXCEPTION 'An active work session already exists for this handler'
      USING ERRCODE = '23505';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_single_active_handler_session ON public.work_sessions;
CREATE TRIGGER trg_single_active_handler_session
  BEFORE INSERT OR UPDATE OF handler_id, clock_out
  ON public.work_sessions
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_single_active_handler_session();
