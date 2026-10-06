CREATE TABLE IF NOT EXISTS public.agrofund_opportunities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fingerprint TEXT UNIQUE NOT NULL,
  organisation_name TEXT NOT NULL,
  title TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'agriculture',
  funding_amount NUMERIC DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'USD',
  eligible_countries TEXT[] DEFAULT ARRAY['Ghana','Africa'],
  eligibility_requirements TEXT NOT NULL DEFAULT '',
  required_documents TEXT[] DEFAULT ARRAY[]::TEXT[],
  deadline TIMESTAMPTZ,
  official_application_link TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending_review'
    CHECK (status IN ('pending_review','approved','rejected','needs_verification','duplicate','archived')),
  is_published BOOLEAN NOT NULL DEFAULT false,
  eligibility_assessment TEXT NOT NULL DEFAULT '',
  eligibility_reasons TEXT NOT NULL DEFAULT '',
  relevance_score NUMERIC DEFAULT 85,
  is_unclear_unverified BOOLEAN DEFAULT false,
  unclear_details TEXT,
  is_expired BOOLEAN DEFAULT false,
  is_broken_link BOOLEAN DEFAULT false,
  is_suspicious_source BOOLEAN DEFAULT false,
  missing_info_flags TEXT[] DEFAULT ARRAY[]::TEXT[],
  source_url TEXT NOT NULL DEFAULT '',
  source_evidence_summary TEXT NOT NULL DEFAULT '',
  source_snippet TEXT,
  source_credibility_score NUMERIC DEFAULT 90,
  released_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  last_verified_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT check_published_only_when_approved CHECK (is_published = false OR status = 'approved')
);

CREATE TABLE IF NOT EXISTS public.agrofund_refresh_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  refresh_type TEXT NOT NULL DEFAULT 'scheduled' CHECK (refresh_type IN ('scheduled','manual','background')),
  status TEXT NOT NULL DEFAULT 'success' CHECK (status IN ('success','error','in_progress')),
  opportunities_found INT DEFAULT 0,
  new_inserted INT DEFAULT 0,
  records_updated INT DEFAULT 0,
  error_message TEXT,
  completed_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.agrofund_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  opportunity_id UUID REFERENCES public.agrofund_opportunities(id) ON DELETE CASCADE,
  admin_id UUID,
  action TEXT NOT NULL,
  previous_state JSONB,
  new_state JSONB,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.agrofund_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  opportunity_id UUID REFERENCES public.agrofund_opportunities(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('new_opportunity','material_change','approaching_deadline','closure_expired')),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  read BOOLEAN DEFAULT false,
  notification_key TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.agrofund_application_trackers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  opportunity_id UUID UNIQUE REFERENCES public.agrofund_opportunities(id) ON DELETE CASCADE,
  stage TEXT NOT NULL DEFAULT 'not_applied' CHECK (stage IN ('not_applied','preparing','submitted','shortlisted','awarded','rejected')),
  internal_notes TEXT,
  assigned_to TEXT,
  submission_date TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.agrofund_bookmarks_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  opportunity_id UUID REFERENCES public.agrofund_opportunities(id) ON DELETE CASCADE,
  user_id UUID,
  is_bookmarked BOOLEAN DEFAULT false,
  note TEXT,
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (opportunity_id, user_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.agrofund_opportunities, public.agrofund_refresh_logs, public.agrofund_audit_logs, public.agrofund_notifications, public.agrofund_application_trackers, public.agrofund_bookmarks_notes TO anon, authenticated;
GRANT ALL ON public.agrofund_opportunities, public.agrofund_refresh_logs, public.agrofund_audit_logs, public.agrofund_notifications, public.agrofund_application_trackers, public.agrofund_bookmarks_notes TO service_role;

ALTER TABLE public.agrofund_opportunities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agrofund_refresh_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agrofund_audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agrofund_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agrofund_application_trackers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agrofund_bookmarks_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin console access agrofund_opportunities" ON public.agrofund_opportunities FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Admin console access agrofund_refresh_logs" ON public.agrofund_refresh_logs FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Admin console access agrofund_audit_logs" ON public.agrofund_audit_logs FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Admin console access agrofund_notifications" ON public.agrofund_notifications FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Admin console access agrofund_application_trackers" ON public.agrofund_application_trackers FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Admin console access agrofund_bookmarks_notes" ON public.agrofund_bookmarks_notes FOR ALL USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_agrofund_opps_status ON public.agrofund_opportunities(status);
CREATE INDEX IF NOT EXISTS idx_agrofund_opps_deadline ON public.agrofund_opportunities(deadline);
CREATE INDEX IF NOT EXISTS idx_agrofund_opps_released_at ON public.agrofund_opportunities(released_at);

CREATE TRIGGER trg_agrofund_opps_updated BEFORE UPDATE ON public.agrofund_opportunities FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER PUBLICATION supabase_realtime ADD TABLE public.agrofund_opportunities;
ALTER PUBLICATION supabase_realtime ADD TABLE public.agrofund_notifications;
ALTER PUBLICATION supabase_realtime ADD TABLE public.agrofund_refresh_logs;

NOTIFY pgrst, 'reload schema';