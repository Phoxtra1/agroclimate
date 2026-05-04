DROP POLICY IF EXISTS "Farmers create contract proposals" ON public.market_contracts;
CREATE POLICY "Farmers create contract proposals"
ON public.market_contracts
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = farmer_id);
