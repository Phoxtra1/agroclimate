
-- Add 'handler' to app_role enum
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'handler';

-- Handlers profile table
CREATE TABLE public.handlers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  farmer_id uuid NOT NULL,
  handler_name text NOT NULL,
  handler_type text NOT NULL DEFAULT 'labourer',
  assigned_farm text,
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.handlers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Farmers can manage their handlers"
  ON public.handlers FOR ALL
  TO authenticated
  USING (farmer_id = auth.uid())
  WITH CHECK (farmer_id = auth.uid());

CREATE POLICY "Handlers can view own profile"
  ON public.handlers FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Admins can view all handlers"
  ON public.handlers FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Handler tasks
CREATE TABLE public.handler_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  farmer_id uuid NOT NULL,
  handler_id uuid NOT NULL REFERENCES public.handlers(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  field_location text,
  deadline timestamptz,
  evidence_required boolean DEFAULT false,
  status text NOT NULL DEFAULT 'pending',
  quantity_label text,
  quantity_expected numeric,
  quantity_completed numeric,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.handler_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Farmers can manage their tasks"
  ON public.handler_tasks FOR ALL
  TO authenticated
  USING (farmer_id = auth.uid())
  WITH CHECK (farmer_id = auth.uid());

CREATE POLICY "Handlers can view assigned tasks"
  ON public.handler_tasks FOR SELECT
  TO authenticated
  USING (handler_id IN (SELECT id FROM public.handlers WHERE user_id = auth.uid()));

CREATE POLICY "Handlers can update assigned tasks"
  ON public.handler_tasks FOR UPDATE
  TO authenticated
  USING (handler_id IN (SELECT id FROM public.handlers WHERE user_id = auth.uid()));

CREATE POLICY "Admins can view all tasks"
  ON public.handler_tasks FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Work sessions
CREATE TABLE public.work_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  handler_id uuid NOT NULL REFERENCES public.handlers(id) ON DELETE CASCADE,
  farm_qr_id uuid,
  clock_in timestamptz NOT NULL DEFAULT now(),
  clock_out timestamptz,
  gps_lat numeric,
  gps_lon numeric,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.work_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Handlers can manage own sessions"
  ON public.work_sessions FOR ALL
  TO authenticated
  USING (handler_id IN (SELECT id FROM public.handlers WHERE user_id = auth.uid()))
  WITH CHECK (handler_id IN (SELECT id FROM public.handlers WHERE user_id = auth.uid()));

CREATE POLICY "Farmers can view handler sessions"
  ON public.work_sessions FOR SELECT
  TO authenticated
  USING (handler_id IN (SELECT id FROM public.handlers WHERE farmer_id = auth.uid()));

CREATE POLICY "Admins can view all sessions"
  ON public.work_sessions FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Task evidence
CREATE TABLE public.task_evidence (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES public.handler_tasks(id) ON DELETE CASCADE,
  handler_id uuid NOT NULL REFERENCES public.handlers(id) ON DELETE CASCADE,
  evidence_type text NOT NULL DEFAULT 'photo',
  file_url text,
  notes text,
  gps_lat numeric,
  gps_lon numeric,
  device_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.task_evidence ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Handlers can manage own evidence"
  ON public.task_evidence FOR ALL
  TO authenticated
  USING (handler_id IN (SELECT id FROM public.handlers WHERE user_id = auth.uid()))
  WITH CHECK (handler_id IN (SELECT id FROM public.handlers WHERE user_id = auth.uid()));

CREATE POLICY "Farmers can view handler evidence"
  ON public.task_evidence FOR SELECT
  TO authenticated
  USING (handler_id IN (SELECT id FROM public.handlers WHERE farmer_id = auth.uid()));

CREATE POLICY "Admins can view all evidence"
  ON public.task_evidence FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Handler issue reports
CREATE TABLE public.handler_issues (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  handler_id uuid NOT NULL REFERENCES public.handlers(id) ON DELETE CASCADE,
  farmer_id uuid NOT NULL,
  issue_type text NOT NULL,
  description text,
  photo_url text,
  gps_lat numeric,
  gps_lon numeric,
  status text NOT NULL DEFAULT 'open',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.handler_issues ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Handlers can manage own issues"
  ON public.handler_issues FOR ALL
  TO authenticated
  USING (handler_id IN (SELECT id FROM public.handlers WHERE user_id = auth.uid()))
  WITH CHECK (handler_id IN (SELECT id FROM public.handlers WHERE user_id = auth.uid()));

CREATE POLICY "Farmers can view handler issues"
  ON public.handler_issues FOR SELECT
  TO authenticated
  USING (farmer_id = auth.uid());

CREATE POLICY "Farmers can update handler issues"
  ON public.handler_issues FOR UPDATE
  TO authenticated
  USING (farmer_id = auth.uid());

CREATE POLICY "Admins can view all issues"
  ON public.handler_issues FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Farm QR codes
CREATE TABLE public.farm_qr_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  farmer_id uuid NOT NULL,
  farm_name text NOT NULL,
  farm_location text,
  qr_code_data text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.farm_qr_codes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Farmers can manage own QR codes"
  ON public.farm_qr_codes FOR ALL
  TO authenticated
  USING (farmer_id = auth.uid())
  WITH CHECK (farmer_id = auth.uid());

CREATE POLICY "Anyone authenticated can read QR codes"
  ON public.farm_qr_codes FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can view all QR codes"
  ON public.farm_qr_codes FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Timestamps triggers
CREATE TRIGGER update_handlers_updated_at BEFORE UPDATE ON public.handlers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_handler_tasks_updated_at BEFORE UPDATE ON public.handler_tasks
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_handler_issues_updated_at BEFORE UPDATE ON public.handler_issues
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Storage bucket for handler evidence
INSERT INTO storage.buckets (id, name, public) VALUES ('handler-evidence', 'handler-evidence', true);

CREATE POLICY "Handlers can upload evidence"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'handler-evidence');

CREATE POLICY "Anyone can view evidence"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'handler-evidence');
