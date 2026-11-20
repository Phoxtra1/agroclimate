-- Stable client keys prevent duplicate harvest records when an offline retry follows
-- a successful server insert whose response was lost.
ALTER TABLE public.post_harvest_entries
  ADD COLUMN IF NOT EXISTS client_idempotency_key text;

CREATE UNIQUE INDEX IF NOT EXISTS idx_post_harvest_entries_user_idempotency
  ON public.post_harvest_entries (user_id, client_idempotency_key);
