
-- Post-Harvest Tracker tables
CREATE TABLE IF NOT EXISTS public.post_harvest_entries (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  crop_name TEXT NOT NULL,
  quantity NUMERIC NOT NULL DEFAULT 0,
  unit TEXT NOT NULL DEFAULT 'kg',
  harvest_date DATE NOT NULL DEFAULT CURRENT_DATE,
  storage_location TEXT,
  storage_method TEXT,
  notes TEXT,
  photos TEXT[] DEFAULT '{}',
  risk_override TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.post_harvest_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own post-harvest entries"
  ON public.post_harvest_entries
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins view all post-harvest entries"
  ON public.post_harvest_entries
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins update post-harvest entries"
  ON public.post_harvest_entries
  FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_post_harvest_entries_updated_at
  BEFORE UPDATE ON public.post_harvest_entries
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_post_harvest_user ON public.post_harvest_entries(user_id);
CREATE INDEX IF NOT EXISTS idx_post_harvest_date ON public.post_harvest_entries(harvest_date DESC);

-- Storage bucket for harvest photos
INSERT INTO storage.buckets (id, name, public)
VALUES ('harvest-photos', 'harvest-photos', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Public read harvest photos"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'harvest-photos');

CREATE POLICY "Users upload own harvest photos"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'harvest-photos' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users update own harvest photos"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'harvest-photos' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users delete own harvest photos"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'harvest-photos' AND auth.uid()::text = (storage.foldername(name))[1]);
