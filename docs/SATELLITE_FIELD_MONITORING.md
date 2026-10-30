# Satellite field monitoring

AgroClimate can monitor farmer-saved field polygons and create in-app alerts when a new Sentinel-2 observation shows an unusual vegetation decline.

## What the monitor does

1. Reads fields where `monitoring_enabled = true`.
2. Searches the free Element 84 Earth Search Sentinel-2 L2A STAC collection for new scenes intersecting each field.
3. Filters by the configured scene-level `eo:cloud_cover` threshold.
4. Calculates field-mean NDVI (NIR/red) and NDMI (NIR/SWIR) using the public TiTiler STAC statistics endpoint.
5. Stores observations in `satellite_field_observations`.
6. Requires three previous valid observations before comparing a new scene against the median baseline.
7. Creates a deduplicated `satellite_field_alerts` record when NDVI drops by at least the field's configured absolute threshold and at least 20% relative to its baseline. NDMI decline is corroborating evidence and increases the confidence indicator.
8. Adds an in-app notification to the farmer's existing notification stream.

The detector identifies unusual spectral change, not a crop disease. It does not currently perform pixel-level cloud/shadow masking, crop-specific growth-stage modelling, or automated causal diagnosis. Scene cloud percentage is a scene-wide value and does not guarantee that a particular field is clear. Farmers should inspect the field before applying treatments.

## Deploy the Edge Function

From the repository root, link the correct Supabase project and deploy:

```sh
supabase link --project-ref apoqexuhlysoirtcvgfo
supabase functions deploy satellite-field-monitor
```

Set the function secrets. Generate a long random secret and keep it private:

```sh
openssl rand -hex 32
supabase secrets set SATELLITE_MONITOR_SECRET='<generated-secret>'
```

The Supabase project already uses `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` for Edge Functions. Supabase supplies these automatically in hosted Edge Function environments; verify they are available in the deployed project.

## Apply the database migration

Apply `supabase/migrations/20261030000000_satellite_field_monitoring.sql` using the project's normal migration workflow:

```sh
supabase db push
```

This creates field, observation and alert tables; farmer-scoped RLS; and realtime publication for new satellite alerts.

## Schedule automatic checks

The function is intentionally protected by a separate `x-satellite-monitor-secret` header and has JWT verification disabled for the scheduled server-to-server call. Store the same generated secret in Supabase Vault. In the Supabase SQL editor (with Vault, pg_cron and pg_net enabled), run:

```sql
select vault.create_secret(
  '<the-same-generated-secret>',
  'satellite_monitor_secret',
  'Authentication secret for scheduled satellite field monitoring'
);

select cron.schedule(
  'satellite-field-monitor-every-6-hours',
  '15 */6 * * *',
  $$
  select net.http_post(
    url := 'https://apoqexuhlysoirtcvgfo.supabase.co/functions/v1/satellite-field-monitor',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-satellite-monitor-secret',
      (select decrypted_secret
       from vault.decrypted_secrets
       where name = 'satellite_monitor_secret'
       limit 1)
    ),
    body := '{}'::jsonb
  );
  $$
);
```

Do not commit the generated secret to Git or place it in frontend environment variables. Confirm the cron job is active in Supabase Cron, then inspect Edge Function logs after its first scheduled run. To remove the schedule:

```sql
select cron.unschedule('satellite-field-monitor-every-6-hours');
```

## Farmer experience

Farmers open Satellite, draw a field boundary, enter a field name and select **Save & monitor this field**. Monitoring can be paused or resumed per field. The page displays stored alerts and supports acknowledgement/resolution. A new field builds its baseline first; no stress alert is generated until three earlier valid observations exist.

## Free-service considerations

Earth Search and TiTiler are public services. There is no paid satellite API key in this implementation, but public endpoints can enforce fair-use limits, rate limits or availability restrictions. Monitor Edge Function errors and do not represent a missed scheduled run as a healthy field.
