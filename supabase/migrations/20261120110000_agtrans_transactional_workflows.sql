-- Normalize legacy request.driver_id values from driver-profile UUIDs to auth user UUIDs.
UPDATE public.agtrans_requests r
SET driver_id = d.user_id
FROM public.agtrans_drivers d
WHERE r.driver_id = d.id;

-- AGTrans: replace globally-readable logistics rows with party-scoped access.
DROP POLICY IF EXISTS "authenticated_select_delivery_jobs" ON public.delivery_jobs;
DROP POLICY IF EXISTS "authenticated_all_delivery_jobs" ON public.delivery_jobs;
DROP POLICY IF EXISTS "authenticated_select_tracking_sessions" ON public.tracking_sessions;
DROP POLICY IF EXISTS "authenticated_all_tracking_sessions" ON public.tracking_sessions;

CREATE POLICY "AGTrans parties read delivery jobs"
  ON public.delivery_jobs FOR SELECT TO authenticated
  USING (
    supplier_id = auth.uid()
    OR buyer_id = auth.uid()
    OR driver_id = auth.uid()
    OR public.has_role(auth.uid(), 'admin')
  );

CREATE POLICY "AGTrans request parties create delivery jobs"
  ON public.delivery_jobs FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'admin')
    OR EXISTS (
      SELECT 1 FROM public.agtrans_requests r
      WHERE r.id = request_id
        AND r.supplier_id = delivery_jobs.supplier_id
        AND r.buyer_id IS NOT DISTINCT FROM delivery_jobs.buyer_id
        AND r.driver_id = delivery_jobs.driver_id
        AND (r.supplier_id = auth.uid() OR r.driver_id = auth.uid())
    )
  );

CREATE POLICY "AGTrans parties update delivery jobs"
  ON public.delivery_jobs FOR UPDATE TO authenticated
  USING (
    supplier_id = auth.uid()
    OR driver_id = auth.uid()
    OR public.has_role(auth.uid(), 'admin')
  )
  WITH CHECK (
    supplier_id = auth.uid()
    OR driver_id = auth.uid()
    OR public.has_role(auth.uid(), 'admin')
  );

CREATE POLICY "AGTrans admins delete delivery jobs"
  ON public.delivery_jobs FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "AGTrans parties read tracking sessions"
  ON public.tracking_sessions FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.delivery_jobs j
      WHERE j.id = delivery_job_id
        AND (
          j.supplier_id = auth.uid()
          OR j.buyer_id = auth.uid()
          OR j.driver_id = auth.uid()
          OR public.has_role(auth.uid(), 'admin')
        )
    )
  );

CREATE POLICY "AGTrans parties create tracking sessions"
  ON public.tracking_sessions FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.delivery_jobs j
      WHERE j.id = delivery_job_id
        AND j.driver_id = tracking_sessions.driver_id
        AND (j.driver_id = auth.uid() OR j.supplier_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
    )
  );

CREATE POLICY "AGTrans assigned driver updates tracking"
  ON public.tracking_sessions FOR UPDATE TO authenticated
  USING (
    driver_id = auth.uid()
    OR public.has_role(auth.uid(), 'admin')
  )
  WITH CHECK (
    driver_id = auth.uid()
    OR public.has_role(auth.uid(), 'admin')
  );

CREATE POLICY "AGTrans admins delete tracking"
  ON public.tracking_sessions FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Driver IDs in AGTrans requests, delivery jobs and tracking sessions are
-- auth.users IDs (the same value used by the driver app and device GPS).
DROP POLICY IF EXISTS "Assigned driver reads request" ON public.agtrans_requests;
DROP POLICY IF EXISTS "Assigned driver updates status" ON public.agtrans_requests;
DROP POLICY IF EXISTS "Approved drivers see open requests" ON public.agtrans_requests;
DROP POLICY IF EXISTS "Approved drivers claim open requests" ON public.agtrans_requests;
DROP POLICY IF EXISTS "Verified drivers see open requests" ON public.agtrans_requests;
DROP POLICY IF EXISTS "Verified drivers can claim open requests" ON public.agtrans_requests;

CREATE POLICY "AGTrans assigned user reads request"
  ON public.agtrans_requests FOR SELECT TO authenticated
  USING (driver_id = auth.uid());

CREATE POLICY "AGTrans assigned user updates request"
  ON public.agtrans_requests FOR UPDATE TO authenticated
  USING (driver_id = auth.uid())
  WITH CHECK (driver_id = auth.uid());

CREATE POLICY "AGTrans approved drivers see open requests"
  ON public.agtrans_requests FOR SELECT TO authenticated
  USING (
    status = 'searching_driver'
    AND driver_id IS NULL
    AND EXISTS (
      SELECT 1 FROM public.agtrans_drivers d
      WHERE d.user_id = auth.uid()
        AND d.approval_status = 'approved'
        AND d.admin_suspended = FALSE
    )
  );

CREATE POLICY "AGTrans approved drivers claim open requests"
  ON public.agtrans_requests FOR UPDATE TO authenticated
  USING (
    status = 'searching_driver'
    AND driver_id IS NULL
    AND EXISTS (
      SELECT 1 FROM public.agtrans_drivers d
      WHERE d.user_id = auth.uid()
        AND d.approval_status = 'approved'
        AND d.admin_suspended = FALSE
    )
  )
  WITH CHECK (
    driver_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.agtrans_drivers d
      WHERE d.user_id = auth.uid()
        AND d.approval_status = 'approved'
        AND d.admin_suspended = FALSE
    )
  );

-- A driver may not self-approve, suspend/unsuspend, change reputation counters,
-- ratings or remaining reserved capacity.
DROP POLICY IF EXISTS "Driver manages own profile" ON public.agtrans_drivers;
CREATE POLICY "Driver reads own profile"
  ON public.agtrans_drivers FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Driver creates own pending profile"
  ON public.agtrans_drivers FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND COALESCE(approval_status, 'pending') = 'pending'
    AND COALESCE(admin_suspended, FALSE) = FALSE
  );

CREATE POLICY "Driver updates own profile"
  ON public.agtrans_drivers FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

REVOKE UPDATE ON public.agtrans_drivers FROM authenticated;
GRANT UPDATE (
  full_name, phone, region, district, vehicle_type, plate_number,
  vehicle_capacity_kg, route_coverage, preferred_corridors, license_url,
  license_class, availability_status, insurance_status, roadworthiness_status,
  cargo_categories, rate_information, vehicle_images, current_location,
  driver_photo_url, vehicle_features, cargo_types_accepted, current_location_text,
  pickup_area, destination, planned_route, departure_date, departure_time,
  estimated_arrival, route_flexibility, pricing_type, suggested_fee,
  offer_notes, special_cargo_instructions, offer_status
) ON public.agtrans_drivers TO authenticated;

REVOKE UPDATE ON public.agtrans_requests FROM authenticated;
GRANT UPDATE (
  status, driver_id, negotiation_status, driver_counter_price, counter_note,
  rejection_reason, agreed_fee, agreement_timestamp, agreement_id
) ON public.agtrans_requests TO authenticated;

REVOKE UPDATE ON public.delivery_jobs FROM authenticated;
GRANT UPDATE (status, transport_agreement_id) ON public.delivery_jobs TO authenticated;

REVOKE UPDATE ON public.tracking_sessions FROM authenticated;
GRANT UPDATE (
  current_lat, current_lon, speed_kn, heading, last_location_at,
  location_accuracy_m, location_source, is_simulated, eta, distance_m, route, status
) ON public.tracking_sessions TO authenticated;

-- A driver's published capacity is recalculated by the database when an offer
-- is first published or the vehicle's carrying capacity changes.
CREATE OR REPLACE FUNCTION public.agtrans_sync_offer_capacity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  reserved numeric := 0;
BEGIN
  IF NEW.vehicle_capacity_kg IS DISTINCT FROM OLD.vehicle_capacity_kg
     OR (OLD.offer_status IS DISTINCT FROM 'published' AND NEW.offer_status = 'published') THEN
    SELECT COALESCE(SUM(j.quantity), 0) INTO reserved
    FROM public.delivery_jobs j
    WHERE j.driver_id = NEW.user_id
      AND j.status NOT IN ('Delivered', 'Completed', 'Cancelled');
    NEW.remaining_capacity := GREATEST(0, COALESCE(NEW.vehicle_capacity_kg, 0) - reserved);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_agtrans_sync_offer_capacity ON public.agtrans_drivers;
CREATE TRIGGER trg_agtrans_sync_offer_capacity
  BEFORE UPDATE ON public.agtrans_drivers
  FOR EACH ROW EXECUTE FUNCTION public.agtrans_sync_offer_capacity();

UPDATE public.agtrans_drivers d
SET remaining_capacity = GREATEST(0, COALESCE(d.vehicle_capacity_kg, 0) - COALESCE((
  SELECT SUM(j.quantity) FROM public.delivery_jobs j
  WHERE j.driver_id = d.user_id AND j.status NOT IN ('Delivered', 'Completed', 'Cancelled')
), 0))
WHERE d.offer_status = 'published';

-- Only the database updates delivery reputation and returns reserved capacity.
CREATE OR REPLACE FUNCTION public.agtrans_apply_delivery_completion()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.status NOT IN ('Delivered', 'Completed', 'Cancelled')
     AND NEW.status IN ('Delivered', 'Completed', 'Cancelled') THEN
    UPDATE public.agtrans_drivers
    SET remaining_capacity = LEAST(
          COALESCE(vehicle_capacity_kg, 0),
          COALESCE(remaining_capacity, 0) + COALESCE(NEW.quantity, 0)
        )
    WHERE user_id = NEW.driver_id;
  END IF;

  IF OLD.status NOT IN ('Delivered', 'Completed')
     AND NEW.status IN ('Delivered', 'Completed') THEN
    UPDATE public.agtrans_drivers
    SET completed_deliveries = COALESCE(completed_deliveries, 0) + 1,
        reliability_score = LEAST(100, COALESCE(reliability_score, 100) + 2)
    WHERE user_id = NEW.driver_id;
  ELSIF OLD.status <> 'Cancelled' AND NEW.status = 'Cancelled' THEN
    UPDATE public.agtrans_drivers
    SET cancellations = COALESCE(cancellations, 0) + 1,
        reliability_score = GREATEST(0, COALESCE(reliability_score, 100) - 15),
        admin_suspended = (COALESCE(cancellations, 0) + 1 >= 3),
        notes = CASE
          WHEN COALESCE(cancellations, 0) + 1 >= 3
          THEN 'Automatically suspended after repeated trip cancellations.'
          ELSE notes
        END
    WHERE user_id = NEW.driver_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_agtrans_delivery_completion ON public.delivery_jobs;
CREATE TRIGGER trg_agtrans_delivery_completion
  AFTER UPDATE OF status ON public.delivery_jobs
  FOR EACH ROW EXECUTE FUNCTION public.agtrans_apply_delivery_completion();

-- Atomic, idempotent acceptance-to-delivery creation. The request, job,
-- agreement, tracking session and capacity reservation commit together.
CREATE OR REPLACE FUNCTION public.create_agtrans_delivery_job(
  p_request_id uuid,
  p_transport_fee numeric DEFAULT NULL
)
RETURNS public.delivery_jobs
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r public.agtrans_requests%ROWTYPE;
  d public.agtrans_drivers%ROWTYPE;
  j public.delivery_jobs%ROWTYPE;
  a public.transport_agreements%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT * INTO r
  FROM public.agtrans_requests
  WHERE id = p_request_id
  FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'Transport request not found'; END IF;
  IF auth.uid() IS DISTINCT FROM r.supplier_id
     AND auth.uid() IS DISTINCT FROM r.driver_id
     AND NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Only the request supplier or assigned driver can create its delivery';
  END IF;
  IF r.status <> 'accepted' THEN RAISE EXCEPTION 'Transport request must be accepted first'; END IF;
  IF r.driver_id IS NULL THEN RAISE EXCEPTION 'A driver must be assigned before delivery creation'; END IF;

  SELECT * INTO j FROM public.delivery_jobs WHERE request_id = r.id LIMIT 1;
  IF FOUND THEN RETURN j; END IF;

  SELECT * INTO d FROM public.agtrans_drivers WHERE user_id = r.driver_id FOR UPDATE;
  IF NOT FOUND OR d.approval_status <> 'approved' OR d.admin_suspended THEN
    RAISE EXCEPTION 'Assigned driver is not approved or is suspended';
  END IF;
  IF COALESCE(r.quantity, 0) <= 0 THEN RAISE EXCEPTION 'Cargo quantity must be greater than zero'; END IF;
  IF COALESCE(d.remaining_capacity, 0) < r.quantity THEN
    RAISE EXCEPTION 'Driver does not have enough remaining vehicle capacity';
  END IF;

  INSERT INTO public.delivery_jobs (
    supplier_id, buyer_id, driver_id, request_id, agreement_id,
    product, quantity, pickup_location, destination, transport_fee,
    driver_name, vehicle_type, plate_number, status
  ) VALUES (
    r.supplier_id, r.buyer_id, r.driver_id, r.id, r.agreement_id,
    r.product_type, r.quantity, r.pickup_location, r.delivery_location, COALESCE(p_transport_fee, 0),
    d.full_name, d.vehicle_type, d.plate_number, 'Assigned'
  ) RETURNING * INTO j;

  INSERT INTO public.transport_agreements (
    request_id, supplier_id, buyer_id, driver_id, marketplace_order_id,
    agreed_fee, agreement_timestamp, delivery_status
  ) VALUES (
    r.id, r.supplier_id, r.buyer_id, r.driver_id, r.marketplace_order_id,
    COALESCE(p_transport_fee, r.agreed_fee, 0), COALESCE(r.agreement_timestamp, now()), 'Assigned'
  ) RETURNING * INTO a;

  UPDATE public.delivery_jobs SET transport_agreement_id = a.id WHERE id = j.id RETURNING * INTO j;
  UPDATE public.agtrans_requests SET agreement_id = a.id WHERE id = r.id;

  INSERT INTO public.tracking_sessions (
    delivery_job_id, driver_id, driver_name, vehicle_type, plate_number,
    pickup_location, destination, status, current_lat, current_lon,
    speed_kn, heading, last_location_at, location_accuracy_m,
    location_source, is_simulated, eta, distance_m
  ) VALUES (
    j.id, r.driver_id, d.full_name, d.vehicle_type, d.plate_number,
    r.pickup_location, r.delivery_location, 'active', NULL, NULL,
    NULL, NULL, NULL, NULL, 'unverified', FALSE, NULL, NULL
  );

  UPDATE public.agtrans_drivers
  SET remaining_capacity = remaining_capacity - r.quantity
  WHERE user_id = r.driver_id;

  RETURN j;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_agtrans_delivery_job(uuid, numeric) TO authenticated;

-- All status changes are checked against the role and current state. Buyer
-- confirmation is the only route from Delivered to Completed.
CREATE OR REPLACE FUNCTION public.transition_agtrans_delivery_job(
  p_job_id uuid,
  p_status text
)
RETURNS public.delivery_jobs
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  j public.delivery_jobs%ROWTYPE;
  allowed boolean := false;
BEGIN
  SELECT * INTO j FROM public.delivery_jobs WHERE id = p_job_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Delivery job not found'; END IF;

  IF public.has_role(auth.uid(), 'admin') THEN
    allowed := true;
  ELSIF auth.uid() = j.driver_id THEN
    allowed := CASE j.status
      WHEN 'Assigned' THEN p_status IN ('In Transit', 'Cancelled')
      WHEN 'Driver En Route' THEN p_status IN ('Loading', 'In Transit', 'Cancelled')
      WHEN 'Loading' THEN p_status IN ('Picked Up', 'Cancelled')
      WHEN 'Picked Up' THEN p_status IN ('In Transit', 'Cancelled')
      WHEN 'In Transit' THEN p_status IN ('Near Delivery', 'Delivered', 'Cancelled')
      WHEN 'Near Delivery' THEN p_status IN ('Delivered', 'Cancelled')
      ELSE false
    END;
  ELSIF auth.uid() = j.supplier_id THEN
    allowed := p_status = 'Cancelled' AND j.status NOT IN ('Delivered', 'Completed', 'Cancelled');
  ELSIF auth.uid() = j.buyer_id THEN
    allowed := p_status = 'Completed' AND j.status = 'Delivered';
  END IF;

  IF NOT allowed THEN RAISE EXCEPTION 'Invalid delivery status transition or insufficient permission'; END IF;

  UPDATE public.delivery_jobs SET status = p_status WHERE id = p_job_id RETURNING * INTO j;
  UPDATE public.transport_agreements SET delivery_status = p_status WHERE request_id = j.request_id;
  UPDATE public.tracking_sessions
    SET status = CASE WHEN p_status = 'Cancelled' THEN 'cancelled'
                      WHEN p_status IN ('Delivered', 'Completed') THEN 'completed'
                      ELSE 'active' END
    WHERE delivery_job_id = j.id;
  RETURN j;
END;
$$;

GRANT EXECUTE ON FUNCTION public.transition_agtrans_delivery_job(uuid, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.confirm_agtrans_delivery(p_request_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r public.agtrans_requests%ROWTYPE;
  j public.delivery_jobs%ROWTYPE;
  found_job boolean := false;
BEGIN
  SELECT * INTO r FROM public.agtrans_requests WHERE id = p_request_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Transport request not found'; END IF;
  IF auth.uid() <> r.buyer_id
     AND NOT (r.buyer_id IS NULL AND auth.uid() = r.supplier_id)
     AND NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Only the buyer can confirm this delivery';
  END IF;

  FOR j IN SELECT * FROM public.delivery_jobs WHERE request_id = p_request_id FOR UPDATE LOOP
    found_job := true;
    IF j.status <> 'Delivered' THEN
      RAISE EXCEPTION 'Delivery must be marked Delivered before buyer confirmation';
    END IF;
    UPDATE public.delivery_jobs SET status = 'Completed' WHERE id = j.id;
    UPDATE public.transport_agreements SET delivery_status = 'Completed' WHERE request_id = p_request_id;
    UPDATE public.tracking_sessions SET status = 'completed' WHERE delivery_job_id = j.id;
  END LOOP;

  IF NOT found_job THEN RAISE EXCEPTION 'No delivery job exists for this request'; END IF;
  UPDATE public.agtrans_requests SET status = 'delivery_confirmed' WHERE id = p_request_id;
  RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION public.confirm_agtrans_delivery(uuid) TO authenticated;

-- Job creation and status changes must go through the checked transactional RPCs.
REVOKE INSERT, UPDATE ON public.delivery_jobs FROM authenticated;
REVOKE INSERT ON public.tracking_sessions FROM authenticated;
REVOKE INSERT, UPDATE ON public.transport_agreements FROM authenticated;
-- Drivers may publish GPS observations, but cannot directly change job/session status.
REVOKE UPDATE ON public.tracking_sessions FROM authenticated;

CREATE OR REPLACE FUNCTION public.update_agtrans_tracking_location(
  p_job_id uuid,
  p_lat double precision,
  p_lon double precision,
  p_accuracy_m numeric,
  p_captured_at timestamptz,
  p_speed_kmh numeric DEFAULT NULL,
  p_heading numeric DEFAULT NULL,
  p_eta text DEFAULT NULL,
  p_distance_m numeric DEFAULT NULL,
  p_route jsonb DEFAULT NULL
)
RETURNS public.tracking_sessions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $
DECLARE
  j public.delivery_jobs%ROWTYPE;
  s public.tracking_sessions%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  SELECT * INTO j FROM public.delivery_jobs WHERE id = p_job_id FOR UPDATE;
  IF NOT FOUND OR j.driver_id <> auth.uid() THEN
    RAISE EXCEPTION 'Only the assigned driver can publish this trip GPS';
  END IF;
  IF j.status IN ('Delivered', 'Completed', 'Cancelled') THEN
    RAISE EXCEPTION 'GPS sharing is closed for this delivery';
  END IF;
  IF p_lat IS NULL OR p_lat < -90 OR p_lat > 90 OR p_lon IS NULL OR p_lon < -180 OR p_lon > 180 THEN
    RAISE EXCEPTION 'Invalid GPS coordinates';
  END IF;
  IF p_accuracy_m IS NULL OR p_accuracy_m <= 0 OR p_accuracy_m > 100 THEN
    RAISE EXCEPTION 'GPS accuracy must be between 0 and 100 metres';
  END IF;
  IF p_captured_at IS NULL OR p_captured_at > now() + interval '15 seconds'
     OR p_captured_at < now() - interval '90 seconds' THEN
    RAISE EXCEPTION 'GPS fix is stale or has an invalid timestamp';
  END IF;
  IF p_speed_kmh IS NOT NULL AND (p_speed_kmh < 0 OR p_speed_kmh > 150) THEN
    RAISE EXCEPTION 'Invalid vehicle speed';
  END IF;
  IF p_heading IS NOT NULL AND (p_heading < 0 OR p_heading >= 360) THEN
    RAISE EXCEPTION 'Invalid vehicle heading';
  END IF;

  UPDATE public.tracking_sessions
  SET current_lat = p_lat,
      current_lon = p_lon,
      speed_kn = p_speed_kmh,
      heading = p_heading,
      last_location_at = p_captured_at,
      location_accuracy_m = p_accuracy_m,
      location_source = 'device_gps',
      is_simulated = FALSE,
      eta = p_eta,
      distance_m = p_distance_m,
      route = p_route
  WHERE delivery_job_id = p_job_id
    AND driver_id = auth.uid()
  RETURNING * INTO s;

  IF NOT FOUND THEN RAISE EXCEPTION 'Active tracking session not found'; END IF;
  RETURN s;
END;
$;

GRANT EXECUTE ON FUNCTION public.update_agtrans_tracking_location(uuid, double precision, double precision, numeric, timestamptz, numeric, numeric, text, numeric, jsonb) TO authenticated;
