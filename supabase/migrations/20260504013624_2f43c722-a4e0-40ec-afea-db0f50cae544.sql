ALTER TABLE public.farmer_inputs
ADD COLUMN IF NOT EXISTS price_label text;

ALTER TABLE public.buyer_orders
ADD COLUMN IF NOT EXISTS price_label text;

CREATE INDEX IF NOT EXISTS idx_farmer_inputs_owner_status_created
ON public.farmer_inputs (user_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_buyer_orders_owner_status_created
ON public.buyer_orders (buyer_id, status, created_at DESC);
