-- Create delivery_jobs table
CREATE TABLE IF NOT EXISTS public.delivery_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  driver_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  product text NOT NULL,
  quantity numeric NOT NULL,
  pickup_location text NOT NULL,
  destination text NOT NULL,
  status text NOT NULL DEFAULT 'Pending',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create tracking_sessions table
CREATE TABLE IF NOT EXISTS public.tracking_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  delivery_job_id uuid REFERENCES public.delivery_jobs(id) ON DELETE CASCADE,
  driver_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  driver_name text,
  vehicle_type text,
  plate_number text,
  pickup_location text,
  destination text,
  route jsonb,
  eta text,
  distance_m numeric,
  current_lat double precision,
  current_lon double precision,
  speed_kn numeric,
  heading numeric,
  status text DEFAULT 'active',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Add helper columns to agtrans_drivers
ALTER TABLE public.agtrans_drivers
  ADD COLUMN IF NOT EXISTS insurance_status text DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS roadworthiness_status text DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS cargo_categories text[] DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS rate_information text DEFAULT 'Negotiable',
  ADD COLUMN IF NOT EXISTS vehicle_images text[] DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS current_location jsonb DEFAULT '{}'::jsonb;

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON public.delivery_jobs TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.delivery_jobs TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tracking_sessions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tracking_sessions TO service_role;

-- Enable Row Level Security (RLS)
ALTER TABLE public.delivery_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tracking_sessions ENABLE ROW LEVEL SECURITY;

-- Create simple RLS policies
CREATE POLICY "authenticated_select_delivery_jobs" ON public.delivery_jobs FOR SELECT TO authenticated USING (true);
CREATE POLICY "authenticated_all_delivery_jobs" ON public.delivery_jobs FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "authenticated_select_tracking_sessions" ON public.tracking_sessions FOR SELECT TO authenticated USING (true);
CREATE POLICY "authenticated_all_tracking_sessions" ON public.tracking_sessions FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Add tables to realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE public.delivery_jobs;
ALTER PUBLICATION supabase_realtime ADD TABLE public.tracking_sessions;
