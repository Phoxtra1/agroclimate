ALTER TABLE public.user_subscriptions
  ADD COLUMN IF NOT EXISTS provider text NOT NULL DEFAULT 'paystack',
  ADD COLUMN IF NOT EXISTS provider_reference text;
UPDATE public.user_subscriptions SET provider_reference = paystack_reference WHERE provider_reference IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS user_subscriptions_provider_ref_idx ON public.user_subscriptions(provider, provider_reference) WHERE provider_reference IS NOT NULL;