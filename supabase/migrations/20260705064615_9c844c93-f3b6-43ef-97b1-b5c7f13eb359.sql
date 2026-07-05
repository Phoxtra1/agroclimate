
CREATE TABLE IF NOT EXISTS public.activity (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  action text NOT NULL,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.activity TO authenticated;
GRANT SELECT, INSERT ON public.activity TO anon;
GRANT ALL ON public.activity TO service_role;
ALTER TABLE public.activity ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can insert their own activity" ON public.activity FOR INSERT WITH CHECK (auth.uid() = user_id OR user_id IS NULL);
CREATE POLICY "Users can view their own activity" ON public.activity FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admins can view all activity" ON public.activity FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Anon can view activity for admin console" ON public.activity FOR SELECT TO anon USING (true);
CREATE INDEX IF NOT EXISTS activity_created_at_idx ON public.activity (created_at DESC);
CREATE INDEX IF NOT EXISTS activity_action_idx ON public.activity (action);

CREATE TABLE IF NOT EXISTS public.alert_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_id uuid,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  alert_type text,
  severity text,
  delivered boolean NOT NULL DEFAULT true,
  opened boolean NOT NULL DEFAULT false,
  delivered_at timestamptz NOT NULL DEFAULT now(),
  opened_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.alert_logs TO authenticated;
GRANT SELECT ON public.alert_logs TO anon;
GRANT ALL ON public.alert_logs TO service_role;
ALTER TABLE public.alert_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own alert logs" ON public.alert_logs FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update own alert logs" ON public.alert_logs FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Authenticated can insert alert logs" ON public.alert_logs FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Admins can view all alert logs" ON public.alert_logs FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Anon can view alert logs for admin console" ON public.alert_logs FOR SELECT TO anon USING (true);
CREATE INDEX IF NOT EXISTS alert_logs_delivered_at_idx ON public.alert_logs (delivered_at DESC);
CREATE INDEX IF NOT EXISTS alert_logs_user_id_idx ON public.alert_logs (user_id);
