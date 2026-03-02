
-- Inventory Items (seeds, fertilizers, chemicals, feed, etc.)
CREATE TABLE public.inventory_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  item_name TEXT NOT NULL,
  item_type TEXT NOT NULL, -- free text: seeds, fertilizer, chemical, feed, etc.
  quantity NUMERIC NOT NULL DEFAULT 0,
  unit TEXT NOT NULL DEFAULT 'kg', -- kg, liters, bags, bottles, etc.
  price_per_unit NUMERIC NOT NULL DEFAULT 0,
  crop_name TEXT,
  season TEXT,
  farm_plot TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Labor records
CREATE TABLE public.labor_records (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  task_description TEXT NOT NULL,
  worker_count INTEGER DEFAULT 1,
  days_worked NUMERIC NOT NULL DEFAULT 1,
  cost_per_day NUMERIC NOT NULL DEFAULT 0,
  crop_name TEXT,
  season TEXT,
  farm_plot TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Land costs
CREATE TABLE public.land_costs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  land_description TEXT NOT NULL,
  size_acres NUMERIC NOT NULL DEFAULT 0,
  cost_type TEXT NOT NULL DEFAULT 'rent', -- rent or purchase
  cost_amount NUMERIC NOT NULL DEFAULT 0,
  season TEXT,
  farm_plot TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Harvest records
CREATE TABLE public.harvest_records (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  crop_name TEXT NOT NULL,
  quantity NUMERIC NOT NULL DEFAULT 0,
  unit TEXT NOT NULL DEFAULT 'kg',
  quality_grade TEXT,
  season TEXT,
  farm_plot TEXT,
  harvest_date DATE DEFAULT CURRENT_DATE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Harvest losses
CREATE TABLE public.harvest_losses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  crop_name TEXT NOT NULL,
  quantity_lost NUMERIC NOT NULL DEFAULT 0,
  unit TEXT NOT NULL DEFAULT 'kg',
  loss_reason TEXT NOT NULL DEFAULT 'spoilage', -- spoilage, pests, storage, theft, etc.
  season TEXT,
  farm_plot TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Sales records
CREATE TABLE public.sales_records (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  crop_name TEXT NOT NULL,
  quantity_sold NUMERIC NOT NULL DEFAULT 0,
  unit TEXT NOT NULL DEFAULT 'kg',
  price_per_unit NUMERIC NOT NULL DEFAULT 0,
  buyer_name TEXT,
  season TEXT,
  farm_plot TEXT,
  sale_date DATE DEFAULT CURRENT_DATE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.inventory_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.labor_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.land_costs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.harvest_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.harvest_losses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales_records ENABLE ROW LEVEL SECURITY;

-- RLS policies for all tables (CRUD for own data)
CREATE POLICY "Users can manage own inventory_items" ON public.inventory_items FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can manage own labor_records" ON public.labor_records FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can manage own land_costs" ON public.land_costs FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can manage own harvest_records" ON public.harvest_records FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can manage own harvest_losses" ON public.harvest_losses FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can manage own sales_records" ON public.sales_records FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Triggers for updated_at
CREATE TRIGGER update_inventory_items_updated_at BEFORE UPDATE ON public.inventory_items FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_labor_records_updated_at BEFORE UPDATE ON public.labor_records FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_land_costs_updated_at BEFORE UPDATE ON public.land_costs FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_harvest_records_updated_at BEFORE UPDATE ON public.harvest_records FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_harvest_losses_updated_at BEFORE UPDATE ON public.harvest_losses FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_sales_records_updated_at BEFORE UPDATE ON public.sales_records FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
