DROP POLICY IF EXISTS "ai logs any insert" ON public.ai_usage_logs;
CREATE POLICY "ai logs self insert" ON public.ai_usage_logs FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() OR user_id IS NULL);