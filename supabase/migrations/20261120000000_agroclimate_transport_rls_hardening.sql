-- Restrict transport records and admin-only overview data to their intended parties.
-- The earlier logistics migration granted all authenticated users unrestricted
-- access to delivery_jobs/tracking_sessions. The admin overview migration also
-- added platform-wide SELECT policies for every authenticated user.

-- Remove unrestricted transport policies.
DROP POLICY IF EXISTS "authenticated_select_delivery_jobs" ON public.delivery_jobs;
DROP POLICY IF EXISTS "authenticated_all_delivery_jobs" ON public.delivery_jobs;
DROP POLICY IF EXISTS "authenticated_select_tracking_sessions" ON public.tracking_sessions;
DROP POLICY IF EXISTS "authenticated_all_tracking_sessions" ON public.tracking_sessions;

-- Delivery records are visible only to their supplier, buyer, assigned driver or admins.
CREATE POLICY "delivery_jobs_parties_select"
  ON public.delivery_jobs
  FOR SELECT
  TO authenticated
  USING (
    auth.uid() = supplier_id
    OR auth.uid() = buyer_id
    OR auth.uid() = driver_id
    OR public.has_role(auth.uid(), 'admin')
  );

-- The supplier creates the job after the transport terms are accepted.
CREATE POLICY "delivery_jobs_supplier_insert"
  ON public.delivery_jobs
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = supplier_id
    OR public.has_role(auth.uid(), 'admin')
  );

-- Supplier, buyer and assigned driver can update operational status; admins can manage all fields.
CREATE POLICY "delivery_jobs_parties_update"
  ON public.delivery_jobs
  FOR UPDATE
  TO authenticated
  USING (
    auth.uid() = supplier_id
    OR auth.uid() = buyer_id
    OR auth.uid() = driver_id
    OR public.has_role(auth.uid(), 'admin')
  )
  WITH CHECK (
    auth.uid() = supplier_id
    OR auth.uid() = buyer_id
    OR auth.uid() = driver_id
    OR public.has_role(auth.uid(), 'admin')
  );

CREATE POLICY "delivery_jobs_admin_delete"
  ON public.delivery_jobs
  FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Tracking is visible only to parties attached to the linked delivery job.
CREATE POLICY "tracking_sessions_parties_select"
  ON public.tracking_sessions
  FOR SELECT
  TO authenticated
  USING (
    auth.uid() = driver_id
    OR EXISTS (
      SELECT 1
      FROM public.delivery_jobs job
      WHERE job.id = tracking_sessions.delivery_job_id
        AND (
          auth.uid() = job.supplier_id
          OR auth.uid() = job.buyer_id
          OR auth.uid() = job.driver_id
        )
    )
    OR public.has_role(auth.uid(), 'admin')
  );

-- A supplier creates the initial tracking record with the accepted delivery job.
CREATE POLICY "tracking_sessions_job_party_insert"
  ON public.tracking_sessions
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = driver_id
    OR EXISTS (
      SELECT 1
      FROM public.delivery_jobs job
      WHERE job.id = tracking_sessions.delivery_job_id
        AND (
          auth.uid() = job.supplier_id
          OR auth.uid() = job.driver_id
        )
    )
    OR public.has_role(auth.uid(), 'admin')
  );

-- Only the supplier, assigned driver or admin can change tracking state/positions.
CREATE POLICY "tracking_sessions_job_party_update"
  ON public.tracking_sessions
  FOR UPDATE
  TO authenticated
  USING (
    auth.uid() = driver_id
    OR EXISTS (
      SELECT 1
      FROM public.delivery_jobs job
      WHERE job.id = tracking_sessions.delivery_job_id
        AND (
          auth.uid() = job.supplier_id
          OR auth.uid() = job.driver_id
        )
    )
    OR public.has_role(auth.uid(), 'admin')
  )
  WITH CHECK (
    auth.uid() = driver_id
    OR EXISTS (
      SELECT 1
      FROM public.delivery_jobs job
      WHERE job.id = tracking_sessions.delivery_job_id
        AND (
          auth.uid() = job.supplier_id
          OR auth.uid() = job.driver_id
        )
    )
    OR public.has_role(auth.uid(), 'admin')
  );

CREATE POLICY "tracking_sessions_admin_delete"
  ON public.tracking_sessions
  FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Platform-wide metric reads must be restricted to actual administrators.
DROP POLICY IF EXISTS "Authenticated view all profiles for overview" ON public.profiles;
DROP POLICY IF EXISTS "Authenticated view all drivers for overview" ON public.agtrans_drivers;
DROP POLICY IF EXISTS "Authenticated view all requests for overview" ON public.agtrans_requests;
DROP POLICY IF EXISTS "Authenticated view all agreements for overview" ON public.transport_agreements;
DROP POLICY IF EXISTS "Authenticated view activity for overview" ON public.activity;
DROP POLICY IF EXISTS "Authenticated view all alerts for overview" ON public.disaster_alerts;

CREATE POLICY "Admins view all profiles for overview"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins view all drivers for overview"
  ON public.agtrans_drivers
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins view all requests for overview"
  ON public.agtrans_requests
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins view all agreements for overview"
  ON public.transport_agreements
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins view activity for overview"
  ON public.activity
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins view all alerts for overview"
  ON public.disaster_alerts
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
