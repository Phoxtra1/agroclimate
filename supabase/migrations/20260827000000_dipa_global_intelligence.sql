-- Dipa Global Intelligence & Decision Support Schema Upgrade
CREATE TABLE IF NOT EXISTS public.dipa_outcomes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    module_domain TEXT NOT NULL,
    prediction_data JSONB,
    decision_made TEXT,
    action_taken TEXT,
    outcome_recorded TEXT,
    outcome_score NUMERIC,
    validation_status TEXT DEFAULT 'pending' CHECK (validation_status IN ('pending', 'verified', 'rejected')),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.potential_buyers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_name TEXT NOT NULL,
    country TEXT NOT NULL,
    region TEXT,
    website TEXT,
    public_contact_channel TEXT,
    public_email TEXT,
    product_interest TEXT NOT NULL,
    source TEXT DEFAULT 'public_directory',
    relevance_score NUMERIC DEFAULT 80,
    status TEXT DEFAULT 'admin_review' CHECK (status IN ('admin_review', 'approved', 'rejected', 'outreach_sent')),
    outreach_draft TEXT,
    discovered_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.logistics_providers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    country TEXT DEFAULT 'Ghana',
    regions_served TEXT[] DEFAULT ARRAY['Greater Accra', 'Ashanti', 'Volta', 'Northern', 'Western'],
    vehicle_types TEXT[] DEFAULT ARRAY['flatbed_truck', 'covered_truck', 'light_van'],
    capacity_tons NUMERIC DEFAULT 10,
    cold_chain_capable BOOLEAN DEFAULT false,
    public_phone TEXT,
    public_email TEXT,
    verified BOOLEAN DEFAULT true,
    rating NUMERIC DEFAULT 4.5,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.agricultural_investment_evaluations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    project_name TEXT NOT NULL,
    location_name TEXT NOT NULL,
    country TEXT NOT NULL,
    parcel_size_ha NUMERIC,
    crop_type TEXT NOT NULL,
    suitability_score NUMERIC DEFAULT 0,
    climate_resilience_score NUMERIC DEFAULT 0,
    market_accessibility_score NUMERIC DEFAULT 0,
    logistics_score NUMERIC DEFAULT 0,
    environmental_risk_score NUMERIC DEFAULT 0,
    overall_score NUMERIC DEFAULT 0,
    analysis_summary TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.agri_cost_scenarios (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    scenario_title TEXT NOT NULL,
    crop_name TEXT NOT NULL,
    location TEXT,
    land_prep_cost NUMERIC DEFAULT 0,
    seed_cost NUMERIC DEFAULT 0,
    fertilizer_cost NUMERIC DEFAULT 0,
    labor_cost NUMERIC DEFAULT 0,
    irrigation_cost NUMERIC DEFAULT 0,
    transport_cost NUMERIC DEFAULT 0,
    harvest_cost NUMERIC DEFAULT 0,
    storage_cost NUMERIC DEFAULT 0,
    estimated_yield_units NUMERIC DEFAULT 0,
    unit TEXT DEFAULT 'kg',
    market_price_per_unit NUMERIC DEFAULT 0,
    data_source_type TEXT DEFAULT 'estimated' CHECK (data_source_type IN ('verified', 'user_entered', 'estimated', 'ai_derived')),
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS & policies
ALTER TABLE public.dipa_outcomes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.potential_buyers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.logistics_providers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agricultural_investment_evaluations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agri_cost_scenarios ENABLE ROW LEVEL SECURITY;

-- Permissive public read & authenticated insert policies where appropriate
CREATE POLICY "Public read logistics_providers" ON public.logistics_providers FOR SELECT USING (true);
CREATE POLICY "Admin write logistics_providers" ON public.logistics_providers FOR ALL USING (true);

CREATE POLICY "Admin access potential_buyers" ON public.potential_buyers FOR ALL USING (true);

CREATE POLICY "User dipa_outcomes policy" ON public.dipa_outcomes FOR ALL USING (true);
CREATE POLICY "User agricultural_investment_evaluations policy" ON public.agricultural_investment_evaluations FOR ALL USING (true);
CREATE POLICY "User agri_cost_scenarios policy" ON public.agri_cost_scenarios FOR ALL USING (true);

-- Seed initial logistics providers for Ghana and global demo
INSERT INTO public.logistics_providers (name, country, regions_served, vehicle_types, capacity_tons, cold_chain_capable, public_phone, public_email, rating)
VALUES 
('TransAgro Ghana Express', 'Ghana', ARRAY['Greater Accra', 'Ashanti', 'Eastern', 'Volta'], ARRAY['flatbed_truck', 'covered_truck', 'light_van'], 15, true, '+233 24 123 4567', 'logistics@transagrogh.com', 4.8),
('Volta Basin Cargo & Marine', 'Ghana', ARRAY['Volta', 'Eastern', 'Greater Accra'], ARRAY['cargo_boat', 'flatbed_truck'], 30, false, '+233 20 987 6543', 'info@voltabasin.com', 4.6),
('Savannah Belt Freight Lines', 'Ghana', ARRAY['Northern', 'Upper East', 'Upper West', 'Ashanti'], ARRAY['heavy_tipper', 'flatbed_truck'], 40, false, '+233 55 444 3322', 'dispatch@savannahfreight.com', 4.7),
('EuroAgri Fresh Cold Logistics', 'Netherlands', ARRAY['South Holland', 'Gelderland', 'North Brabant'], ARRAY['refrigerated_truck', 'electric_van'], 20, true, '+31 20 555 0192', 'contact@euroagrifresh.nl', 4.9),
('AgriLink Express Transport', 'United States', ARRAY['Iowa', 'Illinois', 'Nebraska', 'Kansas'], ARRAY['grain_hopper', 'flatbed_truck'], 35, true, '+1 515 555 0188', 'dispatch@agrilinkexpress.com', 4.8)
ON CONFLICT DO NOTHING;

-- Seed sample potential buyers for discovery queue
INSERT INTO public.potential_buyers (company_name, country, region, website, public_contact_channel, public_email, product_interest, source, relevance_score, status, outreach_draft)
VALUES
('XYZ Foods BV', 'Netherlands', 'South Holland', 'https://xyzfoods.example.nl', 'Public business desk', 'sourcing@xyzfoods.example.nl', 'Cocoa & Coffee Beans', 'Public Directory', 92, 'admin_review', 'Dear Sourcing Team at XYZ Foods BV,\n\nWe noted your public interest in sustainable Cocoa & Coffee Beans. AgroClimate has verified producers with available supply ready for export.\n\nBest regards,\nAmineva Global Team\nrep@amineva.com'),
('Global Grain Processors Inc', 'United States', 'Illinois', 'https://globalgrainproc.example.com', 'Supplier Relations Portal', 'procurement@globalgrainproc.example.com', 'Yellow Maize & Soybeans', 'Public Directory', 88, 'admin_review', 'Dear Procurement Team,\n\nWe identified your public requirements for high-grade Yellow Maize & Soybeans. High-quality supply is currently available on Market Link.\n\nBest regards,\nAmineva Global Team\nrep@amineva.com'),
('AfriMills Milling Co', 'Ghana', 'Greater Accra', 'https://afrimills.example.gh', 'Commercial Purchasing Unit', 'buy@afrimills.example.gh', 'White Maize & Rice', 'Public Directory', 95, 'admin_review', 'Dear AfriMills Purchasing Unit,\n\nOur Market Link intelligence indicates high matching availability for Grade A White Maize in the Eastern & Volta regions.\n\nBest regards,\nAmineva Global Team\nrep@amineva.com')
ON CONFLICT DO NOTHING;
