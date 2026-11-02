CREATE TABLE public.produce_scans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  farm_qr_id uuid REFERENCES public.farm_qr_codes(id) ON DELETE SET NULL,
  mode text NOT NULL DEFAULT 'visual',
  produce text NOT NULL,
  label text,
  outcome text NOT NULL,
  confidence text NOT NULL,
  summary text,
  observations jsonb NOT NULL DEFAULT '[]'::jsonb,
  latitude double precision,
  longitude double precision,
  location_accuracy_m double precision,
  place_label text,
  scanned_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX produce_scans_user_idx ON public.produce_scans(user_id, scanned_at DESC);
CREATE INDEX produce_scans_farm_idx ON public.produce_scans(farm_qr_id, scanned_at DESC);
GRANT SELECT, INSERT, DELETE ON public.produce_scans TO authenticated;
GRANT ALL ON public.produce_scans TO service_role;
ALTER TABLE public.produce_scans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own scans" ON public.produce_scans FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users insert own scans" ON public.produce_scans FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND (farm_qr_id IS NULL OR EXISTS (SELECT 1 FROM public.farm_qr_codes f WHERE f.id = farm_qr_id AND f.farmer_id = auth.uid())));
CREATE POLICY "Users delete own scans" ON public.produce_scans FOR DELETE TO authenticated USING (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.get_farm_scan_record(p_code text)
RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  WITH f AS (
    SELECT id, farm_name, farm_location, created_at FROM public.farm_qr_codes
    WHERE qr_code_data = p_code OR id::text = p_code LIMIT 1
  )
  SELECT CASE WHEN NOT EXISTS (SELECT 1 FROM f) THEN NULL ELSE jsonb_build_object(
    'farm_name', (SELECT farm_name FROM f),
    'farm_location', (SELECT farm_location FROM f),
    'registered_at', (SELECT created_at FROM f),
    'scans', COALESCE((SELECT jsonb_agg(jsonb_build_object(
        'produce', s.produce, 'outcome', s.outcome, 'confidence', s.confidence,
        'summary', s.summary, 'place_label', s.place_label, 'scanned_at', s.scanned_at)
        ORDER BY s.scanned_at DESC)
      FROM (SELECT * FROM public.produce_scans WHERE farm_qr_id = (SELECT id FROM f) ORDER BY scanned_at DESC LIMIT 30) s), '[]'::jsonb)
  ) END
$$;
GRANT EXECUTE ON FUNCTION public.get_farm_scan_record(text) TO anon, authenticated;