GRANT SELECT, INSERT, UPDATE, DELETE ON public.agtrans_drivers TO authenticated;
GRANT ALL ON public.agtrans_drivers TO service_role;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'agtrans_drivers'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.agtrans_drivers;
  END IF;
END
$$;