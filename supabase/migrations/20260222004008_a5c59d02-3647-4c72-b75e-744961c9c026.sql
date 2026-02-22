
-- Add farmer type and drone fields to profiles
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS farmer_type text DEFAULT 'smallholder',
ADD COLUMN IF NOT EXISTS drone_ownership boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS drone_type text;

-- Create app_role enum
DO $$ BEGIN
  CREATE TYPE public.app_role AS ENUM ('admin', 'moderator', 'user');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Create user_roles table
CREATE TABLE IF NOT EXISTS public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Security definer function for role checking
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- RLS: users can read own roles
CREATE POLICY "Users can view own roles"
ON public.user_roles FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- RLS: admins can manage roles
CREATE POLICY "Admins can manage roles"
ON public.user_roles FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Create drone_missions table
CREATE TABLE IF NOT EXISTS public.drone_missions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  mission_type text NOT NULL DEFAULT 'monitoring',
  target_lat numeric,
  target_lon numeric,
  target_location text,
  planned_date timestamptz,
  drone_type text,
  altitude_m numeric,
  status text NOT NULL DEFAULT 'planned',
  advisory_result text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.drone_missions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own missions"
ON public.drone_missions FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Create disaster_alerts table for admin-managed alerts
CREATE TABLE IF NOT EXISTS public.disaster_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  severity text NOT NULL DEFAULT 'warning',
  alert_type text NOT NULL,
  affected_regions text[],
  active boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz
);

ALTER TABLE public.disaster_alerts ENABLE ROW LEVEL SECURITY;

-- Everyone can read active alerts
CREATE POLICY "Anyone can read active alerts"
ON public.disaster_alerts FOR SELECT
TO authenticated
USING (active = true);

-- Admins can manage alerts
CREATE POLICY "Admins can manage alerts"
ON public.disaster_alerts FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Trigger for updated_at on drone_missions
CREATE TRIGGER update_drone_missions_updated_at
BEFORE UPDATE ON public.drone_missions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
