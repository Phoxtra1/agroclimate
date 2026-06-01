
-- 1. Extend app_role enum with 'driver'
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'driver';

-- 2. AGTrans drivers
CREATE TABLE public.agtrans_drivers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE,
  full_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  region TEXT,
  district TEXT,
  vehicle_type TEXT NOT NULL,
  plate_number TEXT NOT NULL,
  vehicle_capacity_kg NUMERIC DEFAULT 0,
  route_coverage TEXT[] DEFAULT '{}',
  preferred_corridors TEXT[] DEFAULT '{}',
  license_url TEXT,
  license_class TEXT DEFAULT 'D',
  availability_status TEXT NOT NULL DEFAULT 'offline',
  verification_status TEXT NOT NULL DEFAULT 'pending',
  reliability_score NUMERIC DEFAULT 100,
  completed_deliveries INTEGER DEFAULT 0,
  late_deliveries INTEGER DEFAULT 0,
  cancellations INTEGER DEFAULT 0,
  disputes INTEGER DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.agtrans_drivers TO authenticated;
GRANT ALL ON public.agtrans_drivers TO service_role;
ALTER TABLE public.agtrans_drivers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Driver manages own profile" ON public.agtrans_drivers
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins manage all drivers" ON public.agtrans_drivers
  FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin')) WITH CHECK (has_role(auth.uid(), 'admin'));
CREATE POLICY "Authenticated can view verified drivers" ON public.agtrans_drivers
  FOR SELECT TO authenticated USING (verification_status = 'verified');

CREATE TRIGGER agtrans_drivers_updated
  BEFORE UPDATE ON public.agtrans_drivers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3. AGTrans transport requests
CREATE TABLE public.agtrans_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id UUID NOT NULL,
  buyer_id UUID,
  agreement_id UUID,
  tracking_code TEXT NOT NULL UNIQUE DEFAULT upper(substr(replace(gen_random_uuid()::text,'-',''),1,10)),
  pickup_location TEXT NOT NULL,
  pickup_lat NUMERIC,
  pickup_lon NUMERIC,
  delivery_location TEXT NOT NULL,
  delivery_lat NUMERIC,
  delivery_lon NUMERIC,
  product_type TEXT NOT NULL,
  quantity NUMERIC NOT NULL DEFAULT 0,
  unit TEXT NOT NULL DEFAULT 'kg',
  preferred_pickup_at TIMESTAMPTZ,
  urgency TEXT NOT NULL DEFAULT 'standard',
  status TEXT NOT NULL DEFAULT 'searching_driver',
  driver_id UUID,
  estimated_price NUMERIC,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.agtrans_requests TO authenticated;
GRANT ALL ON public.agtrans_requests TO service_role;
ALTER TABLE public.agtrans_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Supplier manages own requests" ON public.agtrans_requests
  FOR ALL TO authenticated USING (auth.uid() = supplier_id) WITH CHECK (auth.uid() = supplier_id);
CREATE POLICY "Buyer reads linked request" ON public.agtrans_requests
  FOR SELECT TO authenticated USING (auth.uid() = buyer_id);
CREATE POLICY "Assigned driver reads request" ON public.agtrans_requests
  FOR SELECT TO authenticated
  USING (driver_id IN (SELECT id FROM public.agtrans_drivers WHERE user_id = auth.uid()));
CREATE POLICY "Assigned driver updates status" ON public.agtrans_requests
  FOR UPDATE TO authenticated
  USING (driver_id IN (SELECT id FROM public.agtrans_drivers WHERE user_id = auth.uid()));
CREATE POLICY "Verified drivers can claim open requests" ON public.agtrans_requests
  FOR UPDATE TO authenticated
  USING (
    driver_id IS NULL
    AND status = 'searching_driver'
    AND EXISTS (SELECT 1 FROM public.agtrans_drivers d
                WHERE d.user_id = auth.uid() AND d.verification_status = 'verified')
  );
CREATE POLICY "Verified drivers see open requests" ON public.agtrans_requests
  FOR SELECT TO authenticated
  USING (
    status = 'searching_driver'
    AND EXISTS (SELECT 1 FROM public.agtrans_drivers d
                WHERE d.user_id = auth.uid() AND d.verification_status = 'verified')
  );
CREATE POLICY "Admins manage all requests" ON public.agtrans_requests
  FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin')) WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE TRIGGER agtrans_requests_updated
  BEFORE UPDATE ON public.agtrans_requests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX idx_agtrans_requests_status ON public.agtrans_requests(status);
CREATE INDEX idx_agtrans_requests_supplier ON public.agtrans_requests(supplier_id);
CREATE INDEX idx_agtrans_requests_driver ON public.agtrans_requests(driver_id);

-- 4. Tracking events
CREATE TABLE public.agtrans_tracking_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID NOT NULL REFERENCES public.agtrans_requests(id) ON DELETE CASCADE,
  driver_id UUID,
  event_type TEXT NOT NULL DEFAULT 'status_change',
  status TEXT,
  lat NUMERIC,
  lon NUMERIC,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.agtrans_tracking_events TO authenticated;
GRANT ALL ON public.agtrans_tracking_events TO service_role;
ALTER TABLE public.agtrans_tracking_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Parties read tracking" ON public.agtrans_tracking_events
  FOR SELECT TO authenticated
  USING (
    request_id IN (
      SELECT id FROM public.agtrans_requests
      WHERE supplier_id = auth.uid() OR buyer_id = auth.uid()
         OR driver_id IN (SELECT id FROM public.agtrans_drivers WHERE user_id = auth.uid())
    )
    OR has_role(auth.uid(), 'admin')
  );
CREATE POLICY "Driver writes tracking" ON public.agtrans_tracking_events
  FOR INSERT TO authenticated
  WITH CHECK (
    driver_id IN (SELECT id FROM public.agtrans_drivers WHERE user_id = auth.uid())
  );
CREATE POLICY "Supplier writes confirmation" ON public.agtrans_tracking_events
  FOR INSERT TO authenticated
  WITH CHECK (
    request_id IN (SELECT id FROM public.agtrans_requests WHERE supplier_id = auth.uid())
  );

CREATE INDEX idx_agtrans_tracking_request ON public.agtrans_tracking_events(request_id);

-- 5. Driver ratings
CREATE TABLE public.agtrans_ratings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID NOT NULL REFERENCES public.agtrans_requests(id) ON DELETE CASCADE,
  driver_id UUID NOT NULL,
  rater_id UUID NOT NULL,
  rater_role TEXT NOT NULL DEFAULT 'supplier',
  score INTEGER NOT NULL CHECK (score BETWEEN 1 AND 5),
  comment TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.agtrans_ratings TO authenticated;
GRANT ALL ON public.agtrans_ratings TO service_role;
ALTER TABLE public.agtrans_ratings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Rater creates own rating" ON public.agtrans_ratings
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = rater_id);
CREATE POLICY "Driver reads own ratings" ON public.agtrans_ratings
  FOR SELECT TO authenticated
  USING (driver_id IN (SELECT id FROM public.agtrans_drivers WHERE user_id = auth.uid()));
CREATE POLICY "Rater reads own ratings" ON public.agtrans_ratings
  FOR SELECT TO authenticated USING (auth.uid() = rater_id);
CREATE POLICY "Admins read all ratings" ON public.agtrans_ratings
  FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'));

-- 6. Storage bucket for driver license uploads
INSERT INTO storage.buckets (id, name, public) VALUES ('agtrans-licenses', 'agtrans-licenses', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Driver uploads own license" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'agtrans-licenses' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Driver reads own license" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'agtrans-licenses' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Driver updates own license" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'agtrans-licenses' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Admins read all licenses" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'agtrans-licenses' AND has_role(auth.uid(), 'admin'));
