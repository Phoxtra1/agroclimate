
-- 1) Add buyer role
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'buyer';

-- 2) Extend farmer_inputs
ALTER TABLE public.farmer_inputs
  ADD COLUMN IF NOT EXISTS image_url text,
  ADD COLUMN IF NOT EXISTS category text,
  ADD COLUMN IF NOT EXISTS quality_grade text,
  ADD COLUMN IF NOT EXISTS suggested_price numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS delivery_timeline text,
  ADD COLUMN IF NOT EXISTS contact_email text,
  ADD COLUMN IF NOT EXISTS contact_phone text,
  ADD COLUMN IF NOT EXISTS verified boolean DEFAULT false;

-- 3) Extend buyer_orders
ALTER TABLE public.buyer_orders
  ADD COLUMN IF NOT EXISTS quality text,
  ADD COLUMN IF NOT EXISTS grade text,
  ADD COLUMN IF NOT EXISTS moisture text,
  ADD COLUMN IF NOT EXISTS contact_email text,
  ADD COLUMN IF NOT EXISTS contact_phone text;

-- 4) Make supply + orders publicly readable for the marketplace
DROP POLICY IF EXISTS "Public read farmer_inputs" ON public.farmer_inputs;
CREATE POLICY "Public read farmer_inputs"
  ON public.farmer_inputs FOR SELECT
  TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "Public read buyer_orders" ON public.buyer_orders;
CREATE POLICY "Public read buyer_orders"
  ON public.buyer_orders FOR SELECT
  TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "Public read prices" ON public.price_intelligence;
CREATE POLICY "Public read prices"
  ON public.price_intelligence FOR SELECT
  TO anon, authenticated
  USING (true);

-- 5) Market chat
CREATE TABLE IF NOT EXISTS public.market_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_key text NOT NULL,
  sender_id uuid NOT NULL,
  recipient_id uuid NOT NULL,
  related_supply_id uuid,
  related_order_id uuid,
  body text NOT NULL,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_market_messages_thread ON public.market_messages(thread_key, created_at);
CREATE INDEX IF NOT EXISTS idx_market_messages_recipient ON public.market_messages(recipient_id);

ALTER TABLE public.market_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Parties read messages"
  ON public.market_messages FOR SELECT TO authenticated
  USING (auth.uid() = sender_id OR auth.uid() = recipient_id OR has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Sender writes messages"
  ON public.market_messages FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = sender_id);
CREATE POLICY "Recipient updates read"
  ON public.market_messages FOR UPDATE TO authenticated
  USING (auth.uid() = recipient_id);

-- 6) Presence
CREATE TABLE IF NOT EXISTS public.market_presence (
  user_id uuid PRIMARY KEY,
  last_seen timestamptz NOT NULL DEFAULT now(),
  display_name text
);
ALTER TABLE public.market_presence ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated read presence"
  ON public.market_presence FOR SELECT TO authenticated USING (true);
CREATE POLICY "User upserts own presence"
  ON public.market_presence FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "User updates own presence"
  ON public.market_presence FOR UPDATE TO authenticated USING (auth.uid() = user_id);

-- 7) Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.market_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.market_presence;

-- 8) Storage bucket for supply images (public read)
INSERT INTO storage.buckets (id, name, public)
VALUES ('supply-images', 'supply-images', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Public read supply images"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'supply-images');
CREATE POLICY "Auth upload supply images"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'supply-images' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Owner manage supply images"
  ON storage.objects FOR ALL TO authenticated
  USING (bucket_id = 'supply-images' AND auth.uid()::text = (storage.foldername(name))[1])
  WITH CHECK (bucket_id = 'supply-images' AND auth.uid()::text = (storage.foldername(name))[1]);
