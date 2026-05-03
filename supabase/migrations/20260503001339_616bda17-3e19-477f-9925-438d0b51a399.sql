
DROP POLICY IF EXISTS "Self-assign buyer role" ON public.user_roles;
CREATE POLICY "Self-assign buyer role"
  ON public.user_roles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id AND role = 'buyer'::public.app_role);
