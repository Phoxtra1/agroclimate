-- Post-Harvest Station: authenticated device provisioning and idempotent sensor ingestion.
-- Device credentials are isolated by table privileges and RLS; only the edge function uses service_role.

CREATE TABLE IF NOT EXISTS public.post_harvest_station_devices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  harvest_entry_id uuid REFERENCES public.post_harvest_entries(id) ON DELETE SET NULL,
  device_name text NOT NULL,
  hardware_id text NOT NULL,
  model text,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'revoked')),
  last_seen_at timestamptz,
  calibration_due_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, hardware_id)
);

CREATE TABLE IF NOT EXISTS public.post_harvest_station_credentials (
  device_id uuid PRIMARY KEY REFERENCES public.post_harvest_station_devices(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz
);
ALTER TABLE public.post_harvest_station_credentials ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.post_harvest_station_credentials FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.post_harvest_station_credentials TO service_role;

CREATE TABLE IF NOT EXISTS public.post_harvest_station_observations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id uuid NOT NULL REFERENCES public.post_harvest_station_devices(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  harvest_entry_id uuid REFERENCES public.post_harvest_entries(id) ON DELETE SET NULL,
  observed_at timestamptz NOT NULL,
  received_at timestamptz NOT NULL DEFAULT now(),
  temperature_c numeric NOT NULL CHECK (temperature_c >= -40 AND temperature_c <= 85),
  humidity_pct numeric NOT NULL CHECK (humidity_pct >= 0 AND humidity_pct <= 100),
  sequence_no bigint,
  idempotency_key text NOT NULL,
  raw_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  UNIQUE (device_id, idempotency_key)
);

ALTER TABLE public.post_harvest_station_devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.post_harvest_station_observations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Owners read post-harvest station devices" ON public.post_harvest_station_devices;
CREATE POLICY "Owners read post-harvest station devices"
  ON public.post_harvest_station_devices FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Owners read post-harvest station observations" ON public.post_harvest_station_observations;
CREATE POLICY "Owners read post-harvest station observations"
  ON public.post_harvest_station_observations FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

GRANT SELECT ON public.post_harvest_station_devices TO authenticated;
GRANT SELECT ON public.post_harvest_station_observations TO authenticated;
GRANT ALL ON public.post_harvest_station_devices TO service_role;
GRANT ALL ON public.post_harvest_station_observations TO service_role;

CREATE INDEX IF NOT EXISTS idx_ph_station_devices_owner ON public.post_harvest_station_devices(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ph_station_observations_entry_time ON public.post_harvest_station_observations(harvest_entry_id, observed_at DESC);
CREATE INDEX IF NOT EXISTS idx_ph_station_observations_owner_time ON public.post_harvest_station_observations(user_id, observed_at DESC);

CREATE OR REPLACE FUNCTION public.update_post_harvest_station_device_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS update_post_harvest_station_device_updated_at ON public.post_harvest_station_devices;
CREATE TRIGGER update_post_harvest_station_device_updated_at
  BEFORE UPDATE ON public.post_harvest_station_devices
  FOR EACH ROW EXECUTE FUNCTION public.update_post_harvest_station_device_updated_at();

-- Realtime is optional for ingestion, but enables owner dashboards to refresh on new readings.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'post_harvest_station_devices'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.post_harvest_station_devices;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'post_harvest_station_observations'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.post_harvest_station_observations;
  END IF;
END $$;
