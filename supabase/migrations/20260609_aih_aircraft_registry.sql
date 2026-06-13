-- Migration: Create aircraft_registry table to support universal aerial assets.
CREATE TABLE IF NOT EXISTS public.aircraft_registry (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    type TEXT NOT NULL, -- e.g. drone, helicopter, fixed_wing, air_ambulance, cargo, evtol, survey, maritime_patrol, custom
    manufacturer TEXT NOT NULL,
    model TEXT NOT NULL,
    protocol TEXT NOT NULL, -- e.g. simulator, wifi, mavlink, px4, ardupilot, dji, autel, rtsp, webrtc, adsb, custom
    status TEXT NOT NULL DEFAULT 'disconnected', -- e.g. disconnected, connecting, connected, lost
    last_connected TIMESTAMPTZ,
    operator TEXT,
    home_base TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);

-- Enable Row Level Security (RLS)
ALTER TABLE public.aircraft_registry ENABLE ROW LEVEL SECURITY;

-- Drop policy if it exists and create
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'aircraft_registry' AND policyname = 'Users can manage their own registered aircraft'
    ) THEN
        CREATE POLICY "Users can manage their own registered aircraft" 
        ON public.aircraft_registry
        FOR ALL 
        TO authenticated
        USING (auth.uid() = user_id)
        WITH CHECK (auth.uid() = user_id);
    END IF;
END $$;

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_aircraft_registry_user_id ON public.aircraft_registry(user_id);
CREATE INDEX IF NOT EXISTS idx_aircraft_registry_type ON public.aircraft_registry(type);
