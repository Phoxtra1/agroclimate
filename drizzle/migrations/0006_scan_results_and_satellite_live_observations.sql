ALTER TABLE public.produce_scans ADD COLUMN IF NOT EXISTS result jsonb, ADD COLUMN IF NOT EXISTS product_type text;
DO $$ BEGIN
IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='produce_scans') THEN ALTER PUBLICATION supabase_realtime ADD TABLE public.produce_scans; END IF;
IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='satellite_field_observations') THEN ALTER PUBLICATION supabase_realtime ADD TABLE public.satellite_field_observations; END IF;
END $$;
CREATE OR REPLACE FUNCTION public.get_farm_scan_record(p_code text) RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
WITH f AS (SELECT id,farm_name,farm_location,created_at FROM public.farm_qr_codes WHERE qr_code_data=p_code LIMIT 1)
SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM f) THEN NULL ELSE jsonb_build_object('farm_name',(SELECT farm_name FROM f),'farm_location',(SELECT farm_location FROM f),'registered_at',(SELECT created_at FROM f),'scans',COALESCE((SELECT jsonb_agg(jsonb_build_object('produce',s.produce,'outcome',s.outcome,'confidence',s.confidence,'summary',s.summary,'place_label',s.place_label,'scanned_at',s.scanned_at) ORDER BY s.scanned_at DESC) FROM (SELECT * FROM public.produce_scans WHERE farm_qr_id=(SELECT id FROM f) ORDER BY scanned_at DESC LIMIT 30) s),'[]'::jsonb)) END $$;
REVOKE ALL ON FUNCTION public.get_farm_scan_record(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_farm_scan_record(text) TO anon,authenticated,service_role;