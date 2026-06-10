
ALTER TABLE public.drones
  ADD COLUMN IF NOT EXISTS aircraft_type TEXT NOT NULL DEFAULT 'drone',
  ADD COLUMN IF NOT EXISTS manufacturer TEXT,
  ADD COLUMN IF NOT EXISTS operator TEXT,
  ADD COLUMN IF NOT EXISTS home_base TEXT,
  ADD COLUMN IF NOT EXISTS last_handshake_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS public.fleet_alert_thresholds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  is_default BOOLEAN NOT NULL DEFAULT false,
  battery_warning_pct NUMERIC NOT NULL DEFAULT 25,
  battery_critical_pct NUMERIC NOT NULL DEFAULT 15,
  signal_warning_pct NUMERIC NOT NULL DEFAULT 45,
  signal_critical_pct NUMERIC NOT NULL DEFAULT 30,
  stale_timeout_sec INTEGER NOT NULL DEFAULT 30,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS fleet_alert_thresholds_user_uniq ON public.fleet_alert_thresholds(user_id) WHERE user_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS fleet_alert_thresholds_default_uniq ON public.fleet_alert_thresholds(is_default) WHERE is_default = true;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.fleet_alert_thresholds TO authenticated;
GRANT ALL ON public.fleet_alert_thresholds TO service_role;

ALTER TABLE public.fleet_alert_thresholds ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own or default thresholds"
  ON public.fleet_alert_thresholds FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR is_default = true);

CREATE POLICY "Users manage own thresholds"
  ON public.fleet_alert_thresholds FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Admins manage all thresholds"
  ON public.fleet_alert_thresholds FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER fleet_alert_thresholds_updated_at
  BEFORE UPDATE ON public.fleet_alert_thresholds
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.fleet_alert_thresholds (is_default, user_id) VALUES (true, NULL)
  ON CONFLICT DO NOTHING;
