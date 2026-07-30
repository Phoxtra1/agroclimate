
-- Extend drone_missions with new columns
ALTER TABLE public.drone_missions
  ADD COLUMN IF NOT EXISTS drone_id uuid,
  ADD COLUMN IF NOT EXISTS name text,
  ADD COLUMN IF NOT EXISTS area_polygon jsonb,
  ADD COLUMN IF NOT EXISTS speed_ms numeric,
  ADD COLUMN IF NOT EXISTS route_pattern text,
  ADD COLUMN IF NOT EXISTS camera_settings jsonb,
  ADD COLUMN IF NOT EXISTS started_at timestamptz,
  ADD COLUMN IF NOT EXISTS completed_at timestamptz,
  ADD COLUMN IF NOT EXISTS estimated_battery_pct numeric,
  ADD COLUMN IF NOT EXISTS estimated_duration_min numeric,
  ADD COLUMN IF NOT EXISTS estimated_coverage_ha numeric,
  ADD COLUMN IF NOT EXISTS autonomous boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS success boolean;

-- Drones (fleet) table
CREATE TABLE IF NOT EXISTS public.drones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  model text,
  protocol text NOT NULL DEFAULT 'simulator',
  firmware text,
  serial text,
  paired_at timestamptz DEFAULT now(),
  last_seen_at timestamptz,
  last_battery_pct numeric,
  status text NOT NULL DEFAULT 'offline',
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.drones TO authenticated;
GRANT ALL ON public.drones TO service_role;
ALTER TABLE public.drones ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own drones" ON public.drones FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER update_drones_updated_at BEFORE UPDATE ON public.drones FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Drone media center
CREATE TABLE IF NOT EXISTS public.drone_media (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  mission_id uuid,
  drone_id uuid,
  media_type text NOT NULL,
  storage_path text NOT NULL,
  captured_at timestamptz NOT NULL DEFAULT now(),
  metadata jsonb DEFAULT '{}'::jsonb,
  archived boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.drone_media TO authenticated;
GRANT ALL ON public.drone_media TO service_role;
ALTER TABLE public.drone_media ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own drone media" ON public.drone_media FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- AI detections (Dipa Vision results)
CREATE TABLE IF NOT EXISTS public.drone_ai_detections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  mission_id uuid,
  media_id uuid,
  category text NOT NULL,
  observation text NOT NULL,
  risk_score numeric DEFAULT 0,
  recommended_action text,
  bounding_box jsonb,
  captured_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.drone_ai_detections TO authenticated;
GRANT ALL ON public.drone_ai_detections TO service_role;
ALTER TABLE public.drone_ai_detections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own detections" ON public.drone_ai_detections FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Telemetry logs (per-mission breadcrumbs)
CREATE TABLE IF NOT EXISTS public.drone_telemetry_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  mission_id uuid,
  drone_id uuid,
  captured_at timestamptz NOT NULL DEFAULT now(),
  lat numeric,
  lng numeric,
  altitude_m numeric,
  ground_speed_ms numeric,
  vertical_speed_ms numeric,
  heading numeric,
  battery_pct numeric,
  signal_strength numeric,
  gps_accuracy_m numeric,
  payload jsonb DEFAULT '{}'::jsonb
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.drone_telemetry_logs TO authenticated;
GRANT ALL ON public.drone_telemetry_logs TO service_role;
ALTER TABLE public.drone_telemetry_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own telemetry" ON public.drone_telemetry_logs FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS drone_telemetry_logs_mission_idx ON public.drone_telemetry_logs(mission_id, captured_at DESC);
CREATE INDEX IF NOT EXISTS drone_media_user_idx ON public.drone_media(user_id, captured_at DESC);
CREATE INDEX IF NOT EXISTS drone_ai_detections_user_idx ON public.drone_ai_detections(user_id, captured_at DESC);
