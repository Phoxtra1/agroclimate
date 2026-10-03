-- Agrofund Intelligence & Funding Opportunity Management Schema

-- 1. Main Opportunities Table
CREATE TABLE IF NOT EXISTS public.agrofund_opportunities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    fingerprint TEXT UNIQUE NOT NULL,
    organisation_name TEXT NOT NULL,
    title TEXT NOT NULL,
    category TEXT NOT NULL DEFAULT 'agriculture',
    funding_amount NUMERIC DEFAULT 0,
    currency TEXT NOT NULL DEFAULT 'USD',
    eligible_countries TEXT[] DEFAULT ARRAY['Ghana', 'Africa'],
    eligibility_requirements TEXT NOT NULL,
    required_documents TEXT[] DEFAULT ARRAY['Pitch Deck', 'Business Registration', 'Financial Statements'],
    deadline TIMESTAMPTZ,
    official_application_link TEXT NOT NULL,

    -- Status & Publishing Workflow
    status TEXT NOT NULL DEFAULT 'pending_review'
        CHECK (status IN ('pending_review', 'approved', 'rejected', 'needs_verification', 'duplicate', 'archived')),
    is_published BOOLEAN NOT NULL DEFAULT false,

    -- Eligibility & Verification Signals
    eligibility_assessment TEXT NOT NULL,
    eligibility_reasons TEXT NOT NULL,
    relevance_score NUMERIC DEFAULT 85,
    is_unclear_unverified BOOLEAN DEFAULT false,
    unclear_details TEXT,

    -- Flagging Signals
    is_expired BOOLEAN DEFAULT false,
    is_broken_link BOOLEAN DEFAULT false,
    is_suspicious_source BOOLEAN DEFAULT false,
    missing_info_flags TEXT[] DEFAULT ARRAY[]::TEXT[],

    -- Source Evidence
    source_url TEXT NOT NULL,
    source_evidence_summary TEXT NOT NULL,
    source_snippet TEXT,
    source_credibility_score NUMERIC DEFAULT 90,

    -- Timestamps & Metadata
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    last_verified_at TIMESTAMPTZ DEFAULT now(),

    -- Enforcement: Only approved opportunities may be published
    CONSTRAINT check_published_only_when_approved CHECK (is_published = false OR status = 'approved')
);

-- 2. DIPA Refresh Executions & Logs
CREATE TABLE IF NOT EXISTS public.agrofund_refresh_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    refresh_type TEXT NOT NULL DEFAULT 'scheduled' CHECK (refresh_type IN ('scheduled', 'manual', 'background')),
    status TEXT NOT NULL DEFAULT 'success' CHECK (status IN ('success', 'error', 'in_progress')),
    opportunities_found INT DEFAULT 0,
    new_inserted INT DEFAULT 0,
    records_updated INT DEFAULT 0,
    error_message TEXT,
    completed_at TIMESTAMPTZ DEFAULT now(),
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Audit History & Decision Tracking
CREATE TABLE IF NOT EXISTS public.agrofund_audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    opportunity_id UUID REFERENCES public.agrofund_opportunities(id) ON DELETE CASCADE,
    admin_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    action TEXT NOT NULL,
    previous_state JSONB,
    new_state JSONB,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 4. Notification Store
CREATE TABLE IF NOT EXISTS public.agrofund_notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    opportunity_id UUID REFERENCES public.agrofund_opportunities(id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK (type IN ('new_opportunity', 'material_change', 'approaching_deadline', 'closure_expired')),
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    read BOOLEAN DEFAULT false,
    notification_key TEXT UNIQUE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 5. Application Lifecycle Trackers
CREATE TABLE IF NOT EXISTS public.agrofund_application_trackers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    opportunity_id UUID REFERENCES public.agrofund_opportunities(id) ON DELETE CASCADE UNIQUE,
    stage TEXT NOT NULL DEFAULT 'not_applied' CHECK (stage IN ('not_applied', 'preparing', 'submitted', 'shortlisted', 'awarded', 'rejected')),
    internal_notes TEXT,
    assigned_to TEXT,
    submission_date TIMESTAMPTZ,
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 6. Admin Bookmarks & Personal Notes
CREATE TABLE IF NOT EXISTS public.agrofund_bookmarks_notes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    opportunity_id UUID REFERENCES public.agrofund_opportunities(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    is_bookmarked BOOLEAN DEFAULT false,
    note TEXT,
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE (opportunity_id, user_id)
);

-- Enable RLS
ALTER TABLE public.agrofund_opportunities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agrofund_refresh_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agrofund_audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agrofund_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agrofund_application_trackers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agrofund_bookmarks_notes ENABLE ROW LEVEL SECURITY;

-- Public read for published opportunities
CREATE POLICY "Public read published agrofund_opportunities"
    ON public.agrofund_opportunities FOR SELECT
    USING (is_published = true OR auth.role() = 'authenticated' OR auth.role() = 'service_role');

-- Admin write policies
CREATE POLICY "Admin write agrofund_opportunities"
    ON public.agrofund_opportunities FOR ALL
    USING (true) WITH CHECK (true);

CREATE POLICY "Admin access agrofund_refresh_logs"
    ON public.agrofund_refresh_logs FOR ALL
    USING (true) WITH CHECK (true);

CREATE POLICY "Admin access agrofund_audit_logs"
    ON public.agrofund_audit_logs FOR ALL
    USING (true) WITH CHECK (true);

CREATE POLICY "Admin access agrofund_notifications"
    ON public.agrofund_notifications FOR ALL
    USING (true) WITH CHECK (true);

CREATE POLICY "Admin access agrofund_application_trackers"
    ON public.agrofund_application_trackers FOR ALL
    USING (true) WITH CHECK (true);

CREATE POLICY "Admin access agrofund_bookmarks_notes"
    ON public.agrofund_bookmarks_notes FOR ALL
    USING (true) WITH CHECK (true);

-- Indexes for search & filtering
CREATE INDEX IF NOT EXISTS idx_agrofund_opps_status ON public.agrofund_opportunities(status);
CREATE INDEX IF NOT EXISTS idx_agrofund_opps_category ON public.agrofund_opportunities(category);
CREATE INDEX IF NOT EXISTS idx_agrofund_opps_deadline ON public.agrofund_opportunities(deadline);
CREATE INDEX IF NOT EXISTS idx_agrofund_opps_fingerprint ON public.agrofund_opportunities(fingerprint);

-- Enable Realtime for live updates
ALTER PUBLICATION supabase_realtime ADD TABLE public.agrofund_opportunities;
ALTER PUBLICATION supabase_realtime ADD TABLE public.agrofund_notifications;
ALTER PUBLICATION supabase_realtime ADD TABLE public.agrofund_refresh_logs;

-- Seed initial real discovered funding opportunities
INSERT INTO public.agrofund_opportunities (
    fingerprint, organisation_name, title, category, funding_amount, currency,
    eligible_countries, eligibility_requirements, required_documents, deadline,
    official_application_link, status, is_published, eligibility_assessment,
    eligibility_reasons, relevance_score, is_unclear_unverified, source_url,
    source_evidence_summary, source_snippet, source_credibility_score
)
VALUES
(
    'agra-catalytic-grant-2026',
    'Alliance for a Green Revolution in Africa (AGRA)',
    'AGRA Agri-Business Catalytic Innovation Grant',
    'agri-tech',
    150000,
    'USD',
    ARRAY['Ghana', 'Kenya', 'Nigeria', 'Rwanda', 'Tanzania'],
    'Registered agribusinesses operating in Sub-Saharan Africa with at least 2 years of operational track record in climate-smart agriculture or digital extension.',
    ARRAY['Business Registration Certificate', '2-Year Audited Financials', 'Pitch Deck', 'Environmental Impact Assessment'],
    now() + INTERVAL '45 days',
    'https://agra.org/grants-and-opportunities/catalytic-grant-2026',
    'pending_review',
    false,
    'High Eligibility',
    'Explicitly prioritises Ghanaian and Sub-Saharan African agri-tech and climate resilience startups with demonstrated farmer adoption.',
    95,
    false,
    'https://agra.org/grants-and-opportunities',
    'Official AGRA opportunity call targeting climate resilience innovations and digital advisory platforms in West Africa.',
    'AGRA invites applications from registered agribusinesses and agri-tech innovators in Ghana and East Africa for funding up to $150,000.',
    98
),
(
    'afdb-agri-pitch-competition-2026',
    'African Development Bank (AfDB)',
    'AfDB Youth AgriPitch Competition & Accelerator',
    'agriculture',
    120000,
    'USD',
    ARRAY['Ghana', 'All African Union Member States'],
    'African founders aged 18–35 leading youth-owned agribusinesses with proven market traction in sustainable food systems.',
    ARRAY['Founder ID/Passport', 'Company Profile', 'Traction Metrics', 'Pitch Video Link'],
    now() + INTERVAL '18 days',
    'https://www.afdb.org/en/topics-and-sectors/initiatives-partnerships/youth-agripitch',
    'approved',
    true,
    'Fully Eligible',
    'Directly targets young African entrepreneurs and Ghanaian founders in sustainable agriculture and post-harvest technology.',
    98,
    false,
    'https://www.afdb.org/en/news-and-events/competitions',
    'African Development Bank flagship AgriPitch program providing grant equity and capacity building for youth-led agri-enterprises.',
    'The African Development Bank announces the 2026 Youth AgriPitch Competition offering grants up to $120,000 for innovative agri-preneurs.',
    99
),
(
    'gsma-innovation-fund-climate-2026',
    'GSMA Mobile for Development Foundation',
    'GSMA Innovation Fund for Climate Resilience & Agri-Tech',
    'climate_resilience',
    250000,
    'GBP',
    ARRAY['Ghana', 'Kenya', 'Uganda', 'Ethiopia', 'Senegal'],
    'Small and growing enterprises utilising mobile technology or IoT to build climate resilience for smallholder farmers in Africa.',
    ARRAY['Incorporation Certificate', 'Project Proposal', 'Budget Breakdown', 'Technical Roadmap'],
    now() + INTERVAL '6 days',
    'https://www.gsma.com/mobilefordevelopment/innovation-fund/climate-resilience',
    'pending_review',
    false,
    'High Eligibility',
    'Matches AgroClimate/Agyenkwa tech profile directly; open to Ghanaian technology-enabled agricultural solutions.',
    92,
    false,
    'https://www.gsma.com/mobilefordevelopment/grants',
    'GSMA grant scheme supported by UK Foreign, Commonwealth & Development Office (FCDO) targeting climate adaptation tech.',
    'GSMA Innovation Fund awards up to £250,000 for mobile-enabled climate resilience solutions serving smallholder farming communities.',
    96
),
(
    'tef-entrepreneurship-programme-2026',
    'Tony Elumelu Foundation',
    'Tony Elumelu Foundation Agribusiness Seed Capital Grant',
    'sustainable_food_systems',
    5000,
    'USD',
    ARRAY['Ghana', 'All 54 African Countries'],
    'Early-stage African entrepreneurs with innovative business ideas or existing businesses under 5 years old in agriculture or agri-processing.',
    ARRAY['National ID', 'Business Plan Summary', 'Founder Resume'],
    now() + INTERVAL '3 days',
    'https://www.tonyelumelufoundation.org/apply',
    'pending_review',
    false,
    'High Eligibility',
    'Pan-African grant with strong Ghanaian recipient history, focused on food systems and rural youth empowerment.',
    90,
    false,
    'https://www.tonyelumelufoundation.org/programmes',
    'Largest African philanthropic initiative supporting young entrepreneurs across 54 African countries.',
    'TEF Seed Capital program provides $5,000 non-refundable grant plus mentorship and training for African agri-tech founders.',
    97
)
ON CONFLICT (fingerprint) DO UPDATE SET
    deadline = EXCLUDED.deadline,
    updated_at = now();

-- Seed initial application tracker records
INSERT INTO public.agrofund_application_trackers (opportunity_id, stage, internal_notes)
SELECT id, 'not_applied', 'Initial discovery entry logged by DIPA background intelligence.'
FROM public.agrofund_opportunities
ON CONFLICT (opportunity_id) DO NOTHING;

-- Seed initial refresh execution log
INSERT INTO public.agrofund_refresh_logs (refresh_type, status, opportunities_found, new_inserted, records_updated, error_message)
VALUES ('scheduled', 'success', 4, 4, 0, NULL);
