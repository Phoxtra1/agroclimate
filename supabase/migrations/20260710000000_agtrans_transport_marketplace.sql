-- AGTrans Transport Marketplace refinement
-- Adds driver approval status, transport offer fields, negotiation columns,
-- transport agreements, and in-app notifications.

-- 1. Extend agtrans_drivers with approval and transport-offer fields
ALTER TABLE public.agtrans_drivers
  ADD COLUMN IF NOT EXISTS approval_status TEXT NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS rejection_reason TEXT,
  ADD COLUMN IF NOT EXISTS admin_suspended BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS driver_photo_url TEXT,
  ADD COLUMN IF NOT EXISTS driver_rating NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS rating_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS vehicle_features TEXT[] DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS cargo_types_accepted TEXT[] DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS current_location_text TEXT,
  ADD COLUMN IF NOT EXISTS pickup_area TEXT,
  ADD COLUMN IF NOT EXISTS destination TEXT,
  ADD COLUMN IF NOT EXISTS planned_route TEXT,
  ADD COLUMN IF NOT EXISTS departure_date DATE,
  ADD COLUMN IF NOT EXISTS departure_time TEXT,
  ADD COLUMN IF NOT EXISTS estimated_arrival TEXT,
  ADD COLUMN IF NOT EXISTS route_flexibility TEXT,
  ADD COLUMN IF NOT EXISTS pricing_type TEXT DEFAULT 'Negotiable',
  ADD COLUMN IF NOT EXISTS suggested_fee NUMERIC,
  ADD COLUMN IF NOT EXISTS offer_notes TEXT,
  ADD COLUMN IF NOT EXISTS special_cargo_instructions TEXT,
  ADD COLUMN IF NOT EXISTS offer_status TEXT DEFAULT 'paused',
  ADD COLUMN IF NOT EXISTS remaining_capacity NUMERIC DEFAULT 0;

-- Migrate existing verification_status values into the new approval_status model
UPDATE public.agtrans_drivers
SET approval_status = CASE
  WHEN verification_status = 'verified' THEN 'approved'
  WHEN verification_status = 'rejected' THEN 'rejected'
  ELSE 'pending'
END,
admin_suspended = (verification_status = 'suspended')
WHERE approval_status = 'pending';

-- 2. Extend agtrans_requests with negotiation and marketplace linkage
ALTER TABLE public.agtrans_requests
  ADD COLUMN IF NOT EXISTS transport_offer_id UUID,
  ADD COLUMN IF NOT EXISTS request_type TEXT DEFAULT 'supplier_request',
  ADD COLUMN IF NOT EXISTS cargo_weight NUMERIC,
  ADD COLUMN IF NOT EXISTS cargo_types TEXT[] DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS cargo_features TEXT[] DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS supplier_offer_price NUMERIC,
  ADD COLUMN IF NOT EXISTS driver_counter_price NUMERIC,
  ADD COLUMN IF NOT EXISTS negotiation_status TEXT DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS rejection_reason TEXT,
  ADD COLUMN IF NOT EXISTS counter_note TEXT,
  ADD COLUMN IF NOT EXISTS agreed_fee NUMERIC,
  ADD COLUMN IF NOT EXISTS agreement_timestamp TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS agreement_id UUID,
  ADD COLUMN IF NOT EXISTS marketplace_order_id UUID;

-- 3. Extend delivery_jobs with transport agreement linkage and driver metadata
ALTER TABLE public.delivery_jobs
  ADD COLUMN IF NOT EXISTS request_id UUID,
  ADD COLUMN IF NOT EXISTS agreement_id UUID,
  ADD COLUMN IF NOT EXISTS transport_agreement_id UUID,
  ADD COLUMN IF NOT EXISTS transport_fee NUMERIC,
  ADD COLUMN IF NOT EXISTS driver_name TEXT,
  ADD COLUMN IF NOT EXISTS vehicle_type TEXT,
  ADD COLUMN IF NOT EXISTS plate_number TEXT,
  ADD COLUMN IF NOT EXISTS buyer_id UUID;

-- 4. Transport agreements
CREATE TABLE IF NOT EXISTS public.transport_agreements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID REFERENCES public.agtrans_requests(id) ON DELETE SET NULL,
  supplier_id UUID NOT NULL,
  buyer_id UUID,
  driver_id UUID NOT NULL,
  marketplace_order_id UUID,
  agreed_fee NUMERIC NOT NULL DEFAULT 0,
  agreement_timestamp TIMESTAMPTZ NOT NULL DEFAULT now(),
  delivery_status TEXT NOT NULL DEFAULT 'Assigned',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.transport_agreements TO authenticated;
GRANT ALL ON public.transport_agreements TO service_role;

ALTER TABLE public.transport_agreements ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "transport_agreement_parties_read" ON public.transport_agreements
  FOR SELECT TO authenticated
  USING (
    auth.uid() = supplier_id
    OR auth.uid() = buyer_id
    OR auth.uid() = driver_id
    OR public.has_role(auth.uid(), 'admin')
  );

CREATE POLICY IF NOT EXISTS "transport_agreement_parties_write" ON public.transport_agreements
  FOR ALL TO authenticated
  USING (
    auth.uid() = supplier_id
    OR auth.uid() = driver_id
    OR public.has_role(auth.uid(), 'admin')
  )
  WITH CHECK (
    auth.uid() = supplier_id
    OR auth.uid() = driver_id
    OR public.has_role(auth.uid(), 'admin')
  );

CREATE TRIGGER IF NOT EXISTS transport_agreements_updated
  BEFORE UPDATE ON public.transport_agreements
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER PUBLICATION supabase_realtime ADD TABLE public.transport_agreements;

-- 5. In-app transport notifications
CREATE TABLE IF NOT EXISTS public.transport_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  data JSONB DEFAULT '{}'::jsonb,
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_transport_notifications_user_unread
  ON public.transport_notifications (user_id, created_at DESC)
  WHERE is_read = FALSE;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.transport_notifications TO authenticated;
GRANT ALL ON public.transport_notifications TO service_role;

ALTER TABLE public.transport_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "transport_notifications_self" ON public.transport_notifications
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

ALTER PUBLICATION supabase_realtime ADD TABLE public.transport_notifications;

-- 6. Updated driver visibility policy (approved + not suspended + published offer)
CREATE POLICY IF NOT EXISTS "Authenticated can view approved drivers" ON public.agtrans_drivers
  FOR SELECT TO authenticated
  USING (
    approval_status = 'approved'
    AND admin_suspended = FALSE
    AND offer_status = 'published'
    AND availability_status = 'online'
    AND remaining_capacity > 0
  );

-- 7. Approved drivers may see/claim open requests
CREATE POLICY IF NOT EXISTS "Approved drivers see open requests" ON public.agtrans_requests
  FOR SELECT TO authenticated
  USING (
    status = 'searching_driver'
    AND EXISTS (
      SELECT 1 FROM public.agtrans_drivers d
      WHERE d.user_id = auth.uid()
        AND d.approval_status = 'approved'
        AND d.admin_suspended = FALSE
    )
  );

CREATE POLICY IF NOT EXISTS "Approved drivers claim open requests" ON public.agtrans_requests
  FOR UPDATE TO authenticated
  USING (
    driver_id IS NULL
    AND status = 'searching_driver'
    AND EXISTS (
      SELECT 1 FROM public.agtrans_drivers d
      WHERE d.user_id = auth.uid()
        AND d.approval_status = 'approved'
        AND d.admin_suspended = FALSE
    )
  );
