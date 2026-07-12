-- Fix AGTrans RLS policies
-- 1. The newer "Authenticated can view approved drivers" policy from 20260710 migration
--    conflicts with the original "Authenticated can view verified drivers" policy.
--    Drop the old one and keep the new stricter one.
DROP POLICY IF EXISTS "Authenticated can view verified drivers" ON public.agtrans_drivers;

-- 2. The "Approved drivers see open requests" policy from 20260710 migration
--    conflicts with the original "Verified drivers see open requests" from 20260601.
--    Drop the old ones and keep the newer ones.
DROP POLICY IF EXISTS "Verified drivers see open requests" ON public.agtrans_requests;
DROP POLICY IF EXISTS "Verified drivers can claim open requests" ON public.agtrans_requests;

-- 3. Add missing: suppliers must be able to INSERT their own transport requests.
--    The original "Supplier manages own requests" policy (FOR ALL) should cover INSERT,
--    but re-create it explicitly as FOR INSERT to be safe in case it was not applied.
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

-- 4. Ensure suppliers can also SELECT their own requests regardless of status.
--    This was included in "Supplier manages own requests" (FOR ALL), but in case
--    only a SELECT policy exists, add a dedicated one.
CREATE POLICY IF NOT EXISTS "Supplier reads own requests" ON public.agtrans_requests
  FOR SELECT TO authenticated
  USING (auth.uid() = supplier_id);
