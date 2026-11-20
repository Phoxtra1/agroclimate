# Satellite field monitoring operations

## What the software now does

- A signed-in user can draw a field boundary, validate it, and save it to `satellite_fields`.
- The field record is owned by the authenticated user and is protected by row-level security.
- Users can pause/resume monitoring and delete their own saved fields. Deleting a field cascades to its observations and alerts.
- The `satellite-field-monitor` Edge Function queries Sentinel-2 scenes from Earth Search, calculates field NDVI/NDMI statistics through TiTiler, persists unique observations, and creates a vegetation-decline alert only after three earlier valid observations are available.
- Alerts are shown in Satellite and can be acknowledged or resolved by the field owner.
- The monitor rejects non-Earth-Search scene item URLs. Satellite alerts stay in the Satellite alert table and are not sent through AGTrans transport notifications.

## Required project configuration

The Edge Function is a protected scheduled-job endpoint, not a public browser action. Configure the Supabase function secret:

```sh
supabase secrets set SATELLITE_MONITOR_SECRET="<long-random-secret>"
```

Deploy the function:

```sh
supabase functions deploy satellite-field-monitor
```

Configure the project's scheduler (Supabase Cron or an external trusted scheduler) to POST to:

```
<SUPABASE_URL>/functions/v1/satellite-field-monitor
```

with headers:

```
Content-Type: application/json
x-satellite-monitor-secret: <same-secret>
```

An empty JSON body is sufficient. Start with a daily schedule. Monitor the returned JSON fields: `fieldsChecked`, `scenesProcessed`, `alertsCreated`, `skipped`, and `errors`.

## Important operational boundary

This repository does not contain the deployed project's secret or scheduler configuration. Therefore, saving and managing fields is implemented in the application, and the monitor processing function is implemented in code, but automated periodic execution is **not confirmed** until the project secret is set, the function is deployed, and a scheduled invocation succeeds.

## Data interpretation

- Sentinel-2 imagery is remote-sensing data, not a ground sensor measurement.
- NDVI/NDMI are indicators, not a crop diagnosis or a substitute for field inspection.
- The first three valid observations establish a baseline; the monitor intentionally does not create a decline alert before that baseline exists.
- Cloud cover, crop stage, harvest, pests, disease, field geometry and mixed pixels can affect index values.
