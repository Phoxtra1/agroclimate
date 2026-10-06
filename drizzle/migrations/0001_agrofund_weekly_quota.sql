ALTER TABLE public.agrofund_opportunities ADD COLUMN IF NOT EXISTS discovery_week TEXT;
ALTER TABLE public.agrofund_opportunities ADD COLUMN IF NOT EXISTS portal_verified_at TIMESTAMPTZ;
UPDATE public.agrofund_opportunities SET discovery_week = to_char(created_at, 'IYYY-"W"IW') WHERE discovery_week IS NULL;
CREATE INDEX IF NOT EXISTS idx_agrofund_opps_week ON public.agrofund_opportunities(discovery_week);
CREATE UNIQUE INDEX IF NOT EXISTS uq_agrofund_opps_link ON public.agrofund_opportunities (lower(rtrim(official_application_link, '/')));
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;