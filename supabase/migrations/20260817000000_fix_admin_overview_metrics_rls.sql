-- Migration: Fix Admin Overview Metrics RLS Policies & Realtime Publication
-- Ensures authenticated admin workspace sessions can read platform-wide metrics
-- and receive real-time postgres_changes updates without RLS filtering drops.

-- 1. Profiles policy for admin metrics aggregation
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'profiles' AND policyname = 'Authenticated view all profiles for overview'
  ) THEN
    CREATE POLICY "Authenticated view all profiles for overview" ON public.profiles
      FOR SELECT TO authenticated
      USING (true);
  END IF;
END $$;

-- 2. Drivers policy for admin metrics aggregation and management
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'agtrans_drivers' AND policyname = 'Authenticated view all drivers for overview'
  ) THEN
    CREATE POLICY "Authenticated view all drivers for overview" ON public.agtrans_drivers
      FOR SELECT TO authenticated
      USING (true);
  END IF;
END $$;

-- 3. Transport requests policy for admin metrics aggregation
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'agtrans_requests' AND policyname = 'Authenticated view all requests for overview'
  ) THEN
    CREATE POLICY "Authenticated view all requests for overview" ON public.agtrans_requests
      FOR SELECT TO authenticated
      USING (true);
  END IF;
END $$;

-- 4. Transport agreements policy for admin metrics aggregation
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'transport_agreements' AND policyname = 'Authenticated view all agreements for overview'
  ) THEN
    CREATE POLICY "Authenticated view all agreements for overview" ON public.transport_agreements
      FOR SELECT TO authenticated
      USING (true);
  END IF;
END $$;

-- 5. Activity policy for admin metrics aggregation
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'activity' AND policyname = 'Authenticated view activity for overview'
  ) THEN
    CREATE POLICY "Authenticated view activity for overview" ON public.activity
      FOR SELECT TO authenticated
      USING (true);
  END IF;
END $$;

-- 6. Disaster alerts policy for admin overview metrics
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'disaster_alerts' AND policyname = 'Authenticated view all alerts for overview'
  ) THEN
    CREATE POLICY "Authenticated view all alerts for overview" ON public.disaster_alerts
      FOR SELECT TO authenticated
      USING (true);
  END IF;
END $$;

-- 7. Ensure key tables are included in supabase_realtime publication
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.agtrans_drivers;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.agtrans_requests;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.delivery_jobs;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.farmer_inputs;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.buyer_orders;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.activity;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.disaster_alerts;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
END $$;
