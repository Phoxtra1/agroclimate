-- Fix AGTrans RLS policies
-- 1. Drop the old conflicting driver visibility policy (uses verification_status='verified')
--    The newer one from 20260710 uses approval_status='approved' with stricter conditions.
DROP POLICY IF EXISTS "Authenticated can view verified drivers" ON public.agtrans_drivers;

-- 2. Drop old conflicting request policies (use verification_status instead of approval_status)
DROP POLICY IF EXISTS "Verified drivers see open requests" ON public.agtrans_requests;
DROP POLICY IF EXISTS "Verified drivers can claim open requests" ON public.agtrans_requests;
DROP POLICY IF EXISTS "Supplier reads own requests" ON public.agtrans_requests;

-- 3. Ensure "Supplier manages own requests" FOR ALL policy exists (covers INSERT + SELECT)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'agtrans_requests'
      AND policyname = 'Supplier manages own requests'
  ) THEN
    CREATE POLICY "Supplier manages own requests" ON public.agtrans_requests
      FOR ALL TO authenticated
      USING (auth.uid() = supplier_id)
      WITH CHECK (auth.uid() = supplier_id);
  END IF;
END $$;

-- 4. Add a dedicated SELECT policy so suppliers always see their own requests
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'agtrans_requests'
      AND policyname = 'Supplier reads own requests'
  ) THEN
    CREATE POLICY "Supplier reads own requests" ON public.agtrans_requests
      FOR SELECT TO authenticated
      USING (auth.uid() = supplier_id);
  END IF;
END $$;
