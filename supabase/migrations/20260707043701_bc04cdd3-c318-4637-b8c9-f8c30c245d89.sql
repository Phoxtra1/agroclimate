
CREATE TABLE IF NOT EXISTS public.user_preferences (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  prefs JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_preferences TO authenticated;
GRANT ALL ON public.user_preferences TO service_role;
ALTER TABLE public.user_preferences ENABLE ROW LEVEL SECURITY;
CREATE POLICY "prefs self read" ON public.user_preferences FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "prefs self write" ON public.user_preferences FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "prefs self update" ON public.user_preferences FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "prefs self delete" ON public.user_preferences FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE TRIGGER trg_user_preferences_updated BEFORE UPDATE ON public.user_preferences FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.user_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan TEXT NOT NULL DEFAULT 'freemium',
  status TEXT NOT NULL DEFAULT 'active',
  paystack_reference TEXT,
  amount_usd NUMERIC(10,2),
  currency TEXT,
  amount_local NUMERIC(14,2),
  activated_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS user_subscriptions_user_active
  ON public.user_subscriptions(user_id) WHERE status = 'active';
GRANT SELECT ON public.user_subscriptions TO authenticated;
GRANT ALL ON public.user_subscriptions TO service_role;
ALTER TABLE public.user_subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sub self read" ON public.user_subscriptions FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "sub admin read" ON public.user_subscriptions FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER trg_user_subscriptions_updated BEFORE UPDATE ON public.user_subscriptions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.user_alert_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  alert_id TEXT NOT NULL,
  alert_type TEXT,
  severity TEXT,
  event TEXT NOT NULL DEFAULT 'delivered',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS user_alert_events_user_day ON public.user_alert_events (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS user_alert_events_day ON public.user_alert_events (created_at DESC);
GRANT SELECT, INSERT ON public.user_alert_events TO authenticated;
GRANT ALL ON public.user_alert_events TO service_role;
ALTER TABLE public.user_alert_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "uae self insert" ON public.user_alert_events FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "uae self read" ON public.user_alert_events FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "uae admin read" ON public.user_alert_events FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

ALTER PUBLICATION supabase_realtime ADD TABLE public.user_alert_events;
ALTER PUBLICATION supabase_realtime ADD TABLE public.user_subscriptions;

INSERT INTO public.system_settings (key, value)
VALUES ('global_pilot_mode', '{"enabled": false}'::jsonb)
ON CONFLICT (key) DO NOTHING;
