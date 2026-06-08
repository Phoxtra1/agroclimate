ALTER TABLE public.agtrans_drivers
ADD COLUMN IF NOT EXISTS cancelled_trips integer DEFAULT 0;

UPDATE public.agtrans_drivers
SET cancelled_trips = COALESCE(cancelled_trips, cancellations, 0),
    cancellations = COALESCE(cancellations, cancelled_trips, 0)
WHERE cancelled_trips IS DISTINCT FROM COALESCE(cancelled_trips, cancellations, 0)
   OR cancellations IS DISTINCT FROM COALESCE(cancellations, cancelled_trips, 0);

CREATE OR REPLACE FUNCTION public.sync_agtrans_driver_cancellations()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  NEW.cancellations := COALESCE(NEW.cancellations, NEW.cancelled_trips, 0);
  NEW.cancelled_trips := COALESCE(NEW.cancelled_trips, NEW.cancellations, 0);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sync_agtrans_driver_cancellations_trigger ON public.agtrans_drivers;
CREATE TRIGGER sync_agtrans_driver_cancellations_trigger
BEFORE INSERT OR UPDATE ON public.agtrans_drivers
FOR EACH ROW
EXECUTE FUNCTION public.sync_agtrans_driver_cancellations();