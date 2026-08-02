DROP POLICY IF EXISTS "Authenticated can send transport notifications" ON public.transport_notifications;

CREATE POLICY "Participants send transport notifications"
ON public.transport_notifications FOR INSERT TO authenticated
WITH CHECK (
  auth.uid() = user_id
  OR public.has_role(auth.uid(), 'admin')
  OR EXISTS (
    SELECT 1 FROM public.agtrans_requests r
    WHERE auth.uid() IN (r.supplier_id, r.buyer_id, r.driver_id)
      AND user_id IN (r.supplier_id, r.buyer_id, r.driver_id)
  )
  OR EXISTS (
    SELECT 1 FROM public.delivery_jobs j
    WHERE auth.uid() IN (j.supplier_id, j.buyer_id, j.driver_id)
      AND user_id IN (j.supplier_id, j.buyer_id, j.driver_id)
  )
);