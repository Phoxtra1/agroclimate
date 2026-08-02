-- 1. Extend agtrans_drivers
ALTER TABLE public.agtrans_drivers
  ADD COLUMN IF NOT EXISTS approval_status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS rejection_reason text,
  ADD COLUMN IF NOT EXISTS admin_suspended boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS insurance_status text,
  ADD COLUMN IF NOT EXISTS roadworthiness_status text,
  ADD COLUMN IF NOT EXISTS cargo_categories text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS rate_information text,
  ADD COLUMN IF NOT EXISTS vehicle_images text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS current_location jsonb,
  ADD COLUMN IF NOT EXISTS driver_photo_url text,
  ADD COLUMN IF NOT EXISTS driver_rating numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS rating_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS vehicle_features text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS cargo_types_accepted text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS current_location_text text,
  ADD COLUMN IF NOT EXISTS pickup_area text,
  ADD COLUMN IF NOT EXISTS destination text,
  ADD COLUMN IF NOT EXISTS planned_route text,
  ADD COLUMN IF NOT EXISTS departure_date date,
  ADD COLUMN IF NOT EXISTS departure_time text,
  ADD COLUMN IF NOT EXISTS estimated_arrival text,
  ADD COLUMN IF NOT EXISTS route_flexibility text,
  ADD COLUMN IF NOT EXISTS pricing_type text NOT NULL DEFAULT 'Negotiable',
  ADD COLUMN IF NOT EXISTS suggested_fee numeric,
  ADD COLUMN IF NOT EXISTS offer_notes text,
  ADD COLUMN IF NOT EXISTS special_cargo_instructions text,
  ADD COLUMN IF NOT EXISTS offer_status text NOT NULL DEFAULT 'paused',
  ADD COLUMN IF NOT EXISTS remaining_capacity numeric NOT NULL DEFAULT 0;

-- 2. Extend agtrans_requests
ALTER TABLE public.agtrans_requests
  ADD COLUMN IF NOT EXISTS marketplace_order_id uuid,
  ADD COLUMN IF NOT EXISTS transport_offer_id uuid,
  ADD COLUMN IF NOT EXISTS request_type text,
  ADD COLUMN IF NOT EXISTS cargo_weight numeric,
  ADD COLUMN IF NOT EXISTS cargo_types text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS cargo_features text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS supplier_offer_price numeric,
  ADD COLUMN IF NOT EXISTS driver_counter_price numeric,
  ADD COLUMN IF NOT EXISTS agreed_fee numeric,
  ADD COLUMN IF NOT EXISTS agreement_timestamp timestamptz,
  ADD COLUMN IF NOT EXISTS negotiation_status text,
  ADD COLUMN IF NOT EXISTS rejection_reason text,
  ADD COLUMN IF NOT EXISTS counter_note text;

-- 3. delivery_jobs
CREATE TABLE IF NOT EXISTS public.delivery_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id uuid NOT NULL,
  buyer_id uuid,
  driver_id uuid NOT NULL,
  request_id uuid,
  agreement_id uuid,
  transport_agreement_id uuid,
  transport_fee numeric,
  product text NOT NULL,
  quantity numeric NOT NULL DEFAULT 0,
  pickup_location text NOT NULL,
  destination text NOT NULL,
  driver_name text,
  vehicle_type text,
  plate_number text,
  status text NOT NULL DEFAULT 'Assigned',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.delivery_jobs TO authenticated;
GRANT ALL ON public.delivery_jobs TO service_role;
ALTER TABLE public.delivery_jobs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Participants view delivery jobs" ON public.delivery_jobs FOR SELECT TO authenticated
  USING (auth.uid() IN (supplier_id, buyer_id, driver_id) OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Participants create delivery jobs" ON public.delivery_jobs FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IN (supplier_id, buyer_id, driver_id));
CREATE POLICY "Participants update delivery jobs" ON public.delivery_jobs FOR UPDATE TO authenticated
  USING (auth.uid() IN (supplier_id, buyer_id, driver_id) OR public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER trg_delivery_jobs_updated BEFORE UPDATE ON public.delivery_jobs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 4. transport_agreements
CREATE TABLE IF NOT EXISTS public.transport_agreements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid,
  supplier_id uuid NOT NULL,
  buyer_id uuid,
  driver_id uuid NOT NULL,
  marketplace_order_id uuid,
  agreed_fee numeric NOT NULL DEFAULT 0,
  agreement_timestamp timestamptz NOT NULL DEFAULT now(),
  delivery_status text NOT NULL DEFAULT 'Assigned',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.transport_agreements TO authenticated;
GRANT ALL ON public.transport_agreements TO service_role;
ALTER TABLE public.transport_agreements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Participants view transport agreements" ON public.transport_agreements FOR SELECT TO authenticated
  USING (auth.uid() IN (supplier_id, buyer_id, driver_id) OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Participants create transport agreements" ON public.transport_agreements FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IN (supplier_id, buyer_id, driver_id));
CREATE POLICY "Participants update transport agreements" ON public.transport_agreements FOR UPDATE TO authenticated
  USING (auth.uid() IN (supplier_id, buyer_id, driver_id) OR public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER trg_transport_agreements_updated BEFORE UPDATE ON public.transport_agreements
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 5. tracking_sessions
CREATE TABLE IF NOT EXISTS public.tracking_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  delivery_job_id uuid NOT NULL REFERENCES public.delivery_jobs(id) ON DELETE CASCADE,
  driver_id uuid NOT NULL,
  driver_name text,
  vehicle_type text,
  plate_number text,
  pickup_location text,
  destination text,
  route jsonb,
  eta text,
  distance_m numeric,
  current_lat numeric,
  current_lon numeric,
  speed_kn numeric,
  heading numeric,
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tracking_sessions TO authenticated;
GRANT ALL ON public.tracking_sessions TO service_role;
ALTER TABLE public.tracking_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Participants view tracking sessions" ON public.tracking_sessions FOR SELECT TO authenticated
  USING (
    auth.uid() = driver_id
    OR public.has_role(auth.uid(), 'admin')
    OR EXISTS (
      SELECT 1 FROM public.delivery_jobs j
      WHERE j.id = tracking_sessions.delivery_job_id
        AND auth.uid() IN (j.supplier_id, j.buyer_id, j.driver_id)
    )
  );
CREATE POLICY "Participants create tracking sessions" ON public.tracking_sessions FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = driver_id
    OR EXISTS (
      SELECT 1 FROM public.delivery_jobs j
      WHERE j.id = delivery_job_id
        AND auth.uid() IN (j.supplier_id, j.buyer_id, j.driver_id)
    )
  );
CREATE POLICY "Participants update tracking sessions" ON public.tracking_sessions FOR UPDATE TO authenticated
  USING (
    auth.uid() = driver_id
    OR public.has_role(auth.uid(), 'admin')
    OR EXISTS (
      SELECT 1 FROM public.delivery_jobs j
      WHERE j.id = tracking_sessions.delivery_job_id
        AND auth.uid() IN (j.supplier_id, j.buyer_id, j.driver_id)
    )
  );
CREATE TRIGGER trg_tracking_sessions_updated BEFORE UPDATE ON public.tracking_sessions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 6. transport_notifications
CREATE TABLE IF NOT EXISTS public.transport_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  type text NOT NULL,
  title text NOT NULL,
  message text NOT NULL DEFAULT '',
  data jsonb,
  is_read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.transport_notifications TO authenticated;
GRANT ALL ON public.transport_notifications TO service_role;
ALTER TABLE public.transport_notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own transport notifications" ON public.transport_notifications FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Authenticated can send transport notifications" ON public.transport_notifications FOR INSERT TO authenticated
  WITH CHECK (true);
CREATE POLICY "Users update own transport notifications" ON public.transport_notifications FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);

-- 7. Realtime
ALTER TABLE public.delivery_jobs REPLICA IDENTITY FULL;
ALTER TABLE public.tracking_sessions REPLICA IDENTITY FULL;
ALTER TABLE public.transport_agreements REPLICA IDENTITY FULL;
ALTER TABLE public.transport_notifications REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.delivery_jobs;
ALTER PUBLICATION supabase_realtime ADD TABLE public.tracking_sessions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.transport_agreements;
ALTER PUBLICATION supabase_realtime ADD TABLE public.transport_notifications;