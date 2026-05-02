
-- Farmer-declared expected supply
CREATE TABLE public.farmer_inputs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  crop_name TEXT NOT NULL,
  region TEXT,
  expected_quantity NUMERIC NOT NULL DEFAULT 0,
  unit TEXT NOT NULL DEFAULT 'kg',
  harvest_start DATE,
  harvest_end DATE,
  risk_level TEXT NOT NULL DEFAULT 'low', -- low | medium | high
  status TEXT NOT NULL DEFAULT 'open',    -- open | committed | fulfilled | cancelled
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.farmer_inputs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners manage farmer_inputs"
ON public.farmer_inputs FOR ALL TO authenticated
USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Authenticated read farmer_inputs"
ON public.farmer_inputs FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins manage all farmer_inputs"
ON public.farmer_inputs FOR ALL TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER trg_farmer_inputs_updated
BEFORE UPDATE ON public.farmer_inputs
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


-- Buyer advance orders
CREATE TABLE public.buyer_orders (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  buyer_id UUID NOT NULL,
  buyer_name TEXT,
  crop_name TEXT NOT NULL,
  region TEXT,
  quantity_needed NUMERIC NOT NULL DEFAULT 0,
  unit TEXT NOT NULL DEFAULT 'kg',
  target_price NUMERIC NOT NULL DEFAULT 0,
  delivery_start DATE,
  delivery_end DATE,
  status TEXT NOT NULL DEFAULT 'open',    -- open | matched | fulfilled | cancelled
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.buyer_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Buyers manage own orders"
ON public.buyer_orders FOR ALL TO authenticated
USING (auth.uid() = buyer_id) WITH CHECK (auth.uid() = buyer_id);

CREATE POLICY "Authenticated read buyer_orders"
ON public.buyer_orders FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins manage all buyer_orders"
ON public.buyer_orders FOR ALL TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER trg_buyer_orders_updated
BEFORE UPDATE ON public.buyer_orders
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


-- Contracts linking farmers and buyers
CREATE TABLE public.market_contracts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  farmer_id UUID NOT NULL,
  buyer_id UUID NOT NULL,
  farmer_input_id UUID,
  buyer_order_id UUID,
  crop_name TEXT NOT NULL,
  quantity NUMERIC NOT NULL DEFAULT 0,
  unit TEXT NOT NULL DEFAULT 'kg',
  locked_price NUMERIC NOT NULL DEFAULT 0,
  delivery_start DATE,
  delivery_end DATE,
  state TEXT NOT NULL DEFAULT 'proposed',     -- proposed | accepted | rejected | cancelled | completed
  logistics_status TEXT NOT NULL DEFAULT 'pending', -- pending | scheduled | in_transit | delivered
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.market_contracts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Parties view contracts"
ON public.market_contracts FOR SELECT TO authenticated
USING (auth.uid() = farmer_id OR auth.uid() = buyer_id OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Buyers create contracts"
ON public.market_contracts FOR INSERT TO authenticated
WITH CHECK (auth.uid() = buyer_id);

CREATE POLICY "Parties update contracts"
ON public.market_contracts FOR UPDATE TO authenticated
USING (auth.uid() = farmer_id OR auth.uid() = buyer_id OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Parties delete contracts"
ON public.market_contracts FOR DELETE TO authenticated
USING (auth.uid() = farmer_id OR auth.uid() = buyer_id OR has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER trg_market_contracts_updated
BEFORE UPDATE ON public.market_contracts
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


-- Price intelligence (admin-managed reference)
CREATE TABLE public.price_intelligence (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  crop_name TEXT NOT NULL,
  region TEXT,
  current_price NUMERIC NOT NULL DEFAULT 0,
  suggested_price NUMERIC NOT NULL DEFAULT 0,
  trend TEXT NOT NULL DEFAULT 'stable',   -- rising | falling | stable
  unit TEXT NOT NULL DEFAULT 'kg',
  updated_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.price_intelligence ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated read prices"
ON public.price_intelligence FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins manage prices"
ON public.price_intelligence FOR ALL TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER trg_price_intelligence_updated
BEFORE UPDATE ON public.price_intelligence
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


-- Realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE public.farmer_inputs;
ALTER PUBLICATION supabase_realtime ADD TABLE public.buyer_orders;
ALTER PUBLICATION supabase_realtime ADD TABLE public.market_contracts;
ALTER PUBLICATION supabase_realtime ADD TABLE public.price_intelligence;
