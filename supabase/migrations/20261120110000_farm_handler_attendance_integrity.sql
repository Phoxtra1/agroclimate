-- Make Farm Handler attendance timestamps server-owned and prevent session rewrites.
-- Handlers may create their own clock-in rows and close an active session, but
-- cannot backdate clock-in, rewrite GPS/ownership, delete history, or reopen a
-- closed session through the client API.

DROP POLICY IF EXISTS "Handlers can manage own sessions" ON public.work_sessions;

CREATE POLICY "Handlers can read own sessions"
  ON public.work_sessions FOR SELECT
  TO authenticated
  USING (
    handler_id IN (SELECT id FROM public.handlers WHERE user_id = auth.uid())
  );

CREATE POLICY "Handlers can clock in own sessions"
  ON public.work_sessions FOR INSERT
  TO authenticated
  WITH CHECK (
    handler_id IN (SELECT id FROM public.handlers WHERE user_id = auth.uid())
  );

CREATE POLICY "Handlers can clock out own sessions"
  ON public.work_sessions FOR UPDATE
  TO authenticated
  USING (
    handler_id IN (SELECT id FROM public.handlers WHERE user_id = auth.uid())
  )
  WITH CHECK (
    handler_id IN (SELECT id FROM public.handlers WHERE user_id = auth.uid())
  );

-- Remove broad table-level writes and grant only the columns used by the
-- workspace. Clock-in time is supplied by the database default; clock-out is
-- the only mutable column.
REVOKE INSERT, UPDATE, DELETE ON public.work_sessions FROM anon, authenticated;
GRANT INSERT (handler_id, gps_lat, gps_lon) ON public.work_sessions TO authenticated;
GRANT UPDATE (clock_out) ON public.work_sessions TO authenticated;

CREATE OR REPLACE FUNCTION public.guard_handler_work_session_mutation()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF NEW.id IS DISTINCT FROM OLD.id
      OR NEW.handler_id IS DISTINCT FROM OLD.handler_id
      OR NEW.clock_in IS DISTINCT FROM OLD.clock_in
      OR NEW.gps_lat IS DISTINCT FROM OLD.gps_lat
      OR NEW.gps_lon IS DISTINCT FROM OLD.gps_lon
      OR NEW.farm_qr_id IS DISTINCT FROM OLD.farm_qr_id THEN
      RAISE EXCEPTION 'Attendance ownership, clock-in time and captured location are immutable';
    END IF;

    IF OLD.clock_out IS NOT NULL AND NEW.clock_out IS DISTINCT FROM OLD.clock_out THEN
      RAISE EXCEPTION 'A closed work session cannot be reopened or rewritten';
    END IF;

    IF OLD.clock_out IS NULL AND NEW.clock_out IS NOT NULL THEN
      IF now() < OLD.clock_in THEN
        RAISE EXCEPTION 'Cannot clock out before the recorded clock-in time';
      END IF;
      NEW.clock_out := now();
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_handler_work_session_mutation ON public.work_sessions;
CREATE TRIGGER trg_guard_handler_work_session_mutation
  BEFORE UPDATE ON public.work_sessions
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_handler_work_session_mutation();
