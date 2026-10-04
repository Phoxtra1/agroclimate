ALTER TABLE public.agrofund_opportunities ADD COLUMN IF NOT EXISTS released_at TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS idx_agrofund_opps_released_at ON public.agrofund_opportunities(released_at);
