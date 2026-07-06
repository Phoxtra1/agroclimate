CREATE TABLE IF NOT EXISTS public.system_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.system_settings TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.system_settings TO authenticated;
GRANT ALL ON public.system_settings TO service_role;
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "settings readable by all" ON public.system_settings;
CREATE POLICY "settings readable by all" ON public.system_settings FOR SELECT USING (true);
DROP POLICY IF EXISTS "settings writable by admin" ON public.system_settings;
CREATE POLICY "settings writable by admin" ON public.system_settings FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP TRIGGER IF EXISTS trg_system_settings_updated ON public.system_settings;
CREATE TRIGGER trg_system_settings_updated
BEFORE UPDATE ON public.system_settings
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- AI usage logs (lightweight)
CREATE TABLE IF NOT EXISTS public.ai_usage_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  model TEXT NOT NULL,
  action TEXT NOT NULL,
  latency_ms INTEGER,
  ok BOOLEAN NOT NULL DEFAULT true,
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.ai_usage_logs TO authenticated;
GRANT INSERT ON public.ai_usage_logs TO authenticated;
GRANT ALL ON public.ai_usage_logs TO service_role;
ALTER TABLE public.ai_usage_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "ai logs admin read" ON public.ai_usage_logs;
CREATE POLICY "ai logs admin read" ON public.ai_usage_logs FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR user_id = auth.uid());
DROP POLICY IF EXISTS "ai logs any insert" ON public.ai_usage_logs;
CREATE POLICY "ai logs any insert" ON public.ai_usage_logs FOR INSERT TO authenticated WITH CHECK (true);

-- Seed default active model row (idempotent)
INSERT INTO public.system_settings (key, value)
VALUES ('active_ai_model', '{"id":"odeai-1.0","gateway_model":"google/gemini-3-flash-preview","label":"OdeAI 1.0"}'::jsonb)
ON CONFLICT (key) DO NOTHING;