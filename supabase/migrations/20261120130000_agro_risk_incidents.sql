-- Persistent, owner-scoped AgroRisk incident reports.
-- Reports remain unverified community/user submissions, not official hazard detections.
CREATE TABLE IF NOT EXISTS public.agro_risk_incidents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  farm_id uuid REFERENCES public.farms(id) ON DELETE SET NULL,
  lat double precision NOT NULL CHECK (lat BETWEEN -90 AND 90),
  lon double precision NOT NULL CHECK (lon BETWEEN -180 AND 180),
  incident_type text NOT NULL CHECK (incident_type IN ('Flooding','Waterlogging','Soil Erosion','Landslide','Drought')),
  description text NOT NULL CHECK (char_length(trim(description)) BETWEEN 1 AND 2000),
  status text NOT NULL DEFAULT 'unverified' CHECK (status = 'unverified'),
  source text NOT NULL DEFAULT 'user_report' CHECK (source = 'user_report'),
  reported_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.agro_risk_incidents ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.agro_risk_incidents FROM PUBLIC, anon;
GRANT SELECT, INSERT, DELETE ON public.agro_risk_incidents TO authenticated;

DROP POLICY IF EXISTS "Users read own AgroRisk incidents" ON public.agro_risk_incidents;
CREATE POLICY "Users read own AgroRisk incidents"
  ON public.agro_risk_incidents FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users report own AgroRisk incidents" ON public.agro_risk_incidents;
CREATE POLICY "Users report own AgroRisk incidents"
  ON public.agro_risk_incidents FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND status = 'unverified' AND source = 'user_report');

DROP POLICY IF EXISTS "Users delete own AgroRisk incidents" ON public.agro_risk_incidents;
CREATE POLICY "Users delete own AgroRisk incidents"
  ON public.agro_risk_incidents FOR DELETE TO authenticated
  USING (user_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_agro_risk_incidents_owner_date
  ON public.agro_risk_incidents(user_id, reported_at DESC);
CREATE INDEX IF NOT EXISTS idx_agro_risk_incidents_farm
  ON public.agro_risk_incidents(farm_id) WHERE farm_id IS NOT NULL;
