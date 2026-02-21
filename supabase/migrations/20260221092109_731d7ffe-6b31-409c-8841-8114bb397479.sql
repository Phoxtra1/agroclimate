
-- Create profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  display_name TEXT,
  phone TEXT,
  farm_size TEXT,
  preferred_language TEXT DEFAULT 'en',
  region TEXT,
  district TEXT,
  community TEXT,
  country TEXT DEFAULT 'Ghana',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own profile" ON public.profiles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own profile" ON public.profiles FOR UPDATE USING (auth.uid() = user_id);

-- Farmer crops junction
CREATE TABLE public.farmer_crops (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  crop_name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.farmer_crops ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own crops" ON public.farmer_crops FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own crops" ON public.farmer_crops FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own crops" ON public.farmer_crops FOR DELETE USING (auth.uid() = user_id);

-- Fish ponds for aquaculture
CREATE TABLE public.fish_ponds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  species TEXT NOT NULL,
  stock_count INTEGER DEFAULT 0,
  pond_size_sqm NUMERIC,
  water_temp NUMERIC,
  ph_level NUMERIC,
  dissolved_oxygen NUMERIC,
  last_feeding TIMESTAMPTZ,
  feeding_schedule TEXT DEFAULT 'twice_daily',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.fish_ponds ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own ponds" ON public.fish_ponds FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own ponds" ON public.fish_ponds FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own ponds" ON public.fish_ponds FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own ponds" ON public.fish_ponds FOR DELETE USING (auth.uid() = user_id);

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (user_id, display_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.email));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Updated_at trigger
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_fish_ponds_updated_at BEFORE UPDATE ON public.fish_ponds FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
