-- Owner-scoped saved Agro Inventory profitability scenarios.
-- These are user-entered or estimated calculations, not independently verified financial results.
CREATE TABLE IF NOT EXISTS public.agri_cost_scenarios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  scenario_title text NOT NULL,
  crop_name text NOT NULL,
  land_prep_cost numeric NOT NULL DEFAULT 0 CHECK (land_prep_cost >= 0),
  seed_cost numeric NOT NULL DEFAULT 0 CHECK (seed_cost >= 0),
  fertilizer_cost numeric NOT NULL DEFAULT 0 CHECK (fertilizer_cost >= 0),
  other_input_cost numeric NOT NULL DEFAULT 0 CHECK (other_input_cost >= 0),
  labor_cost numeric NOT NULL DEFAULT 0 CHECK (labor_cost >= 0),
  irrigation_cost numeric NOT NULL DEFAULT 0 CHECK (irrigation_cost >= 0),
  transport_cost numeric NOT NULL DEFAULT 0 CHECK (transport_cost >= 0),
  harvest_cost numeric NOT NULL DEFAULT 0 CHECK (harvest_cost >= 0),
  storage_cost numeric NOT NULL DEFAULT 0 CHECK (storage_cost >= 0),
  estimated_yield_units numeric NOT NULL DEFAULT 0 CHECK (estimated_yield_units >= 0),
  unit text NOT NULL DEFAULT 'kg',
  market_price_per_unit numeric NOT NULL DEFAULT 0 CHECK (market_price_per_unit >= 0),
  currency_code text CHECK (currency_code IS NULL OR char_length(currency_code) = 3),
  data_source_type text NOT NULL DEFAULT 'estimated'
    CHECK (data_source_type IN ('user_entered', 'estimated', 'ai_derived')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.agri_cost_scenarios
  ADD COLUMN IF NOT EXISTS other_input_cost numeric NOT NULL DEFAULT 0 CHECK (other_input_cost >= 0);
ALTER TABLE public.agri_cost_scenarios
  ADD COLUMN IF NOT EXISTS currency_code text CHECK (currency_code IS NULL OR char_length(currency_code) = 3);

ALTER TABLE public.agri_cost_scenarios ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.agri_cost_scenarios FROM PUBLIC, anon;

DROP POLICY IF EXISTS "Users manage own agri cost scenarios" ON public.agri_cost_scenarios;
CREATE POLICY "Users manage own agri cost scenarios"
  ON public.agri_cost_scenarios FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.agri_cost_scenarios TO authenticated;
CREATE INDEX IF NOT EXISTS idx_agri_cost_scenarios_owner_created
  ON public.agri_cost_scenarios(user_id, created_at DESC);

DROP TRIGGER IF EXISTS update_agri_cost_scenarios_updated_at ON public.agri_cost_scenarios;
CREATE TRIGGER update_agri_cost_scenarios_updated_at
  BEFORE UPDATE ON public.agri_cost_scenarios
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Ensure owner-filtered realtime refreshes can observe all six Agro Inventory tables.
DO $$
DECLARE
  table_name text;
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    FOREACH table_name IN ARRAY ARRAY[
      'inventory_items', 'labor_records', 'land_costs',
      'harvest_records', 'harvest_losses', 'sales_records'
    ] LOOP
      IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime'
          AND schemaname = 'public'
          AND tablename = table_name
      ) THEN
        EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', table_name);
      END IF;
    END LOOP;
  END IF;
END;
$$;
