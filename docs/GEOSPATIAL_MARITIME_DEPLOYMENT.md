# AgroClimate geospatial and maritime deployment runbook

This branch is prepared for review in PR #20. Do not deploy the application before the database migrations are applied to the matching Supabase project.

## 1. Stage first

- Back up the target Supabase project and use a staging project before production.
- Confirm the repository is linked to the intended project: `supabase projects list` and `supabase migration list`.
- Confirm PostGIS is available in the `extensions` schema. The migration creates the extension there if it is not already installed.
- Review any pending migrations before running `supabase db push`; that command applies all pending migrations in this repository, not only the two listed below.

## 2. Apply database migrations

Apply these files in timestamp order:

1. `supabase/migrations/20261031000000_shared_geospatial_maritime.sql`
2. `supabase/migrations/20261031002000_agtrans_location_provenance.sql`

From the repository root, with the correct Supabase project linked:

```sh
supabase migration list
supabase db push
```

If using the Supabase Dashboard SQL Editor instead, run the two migration files in the same order and verify the resulting schema and RLS policies afterwards. Do not run the SQL against a production project until the staging pass is complete.

Useful verification queries:

```sql
select e.extname, n.nspname as extension_schema
from pg_extension e
join pg_namespace n on n.oid = e.extnamespace
where e.extname = 'postgis';

select to_regclass('public.geo_features') as geo_features,
       to_regclass('public.geo_observations') as geo_observations,
       to_regclass('public.geo_routes') as geo_routes,
       to_regclass('public.vessels') as vessels,
       to_regclass('public.vessel_locations') as vessel_locations,
       to_regclass('public.sos_events') as sos_events;
```

## 3. Deploy the Edge Functions

Deploy both the trusted maritime handler and the SMS sender:

```sh
supabase functions deploy maritime-sos
supabase functions deploy send-sms
```

The `send-sms` function is now configured with JWT verification and an additional server-role authorization check. It must only be invoked by trusted server-side code, such as `maritime-sos` using the service-role client. Do not make the service-role key available in browser code.

## 4. Configure optional SMS

In-app realtime SOS alerts work without SMS. SMS is deliberately disabled by default.

Only after the Africa's Talking account, approved sender, recipients and operational process have been configured, set these Supabase function secrets:

```sh
supabase secrets set MARITIME_SMS_ENABLED=false
supabase secrets set AFRICASTALKING_API_KEY=<provider-api-key>
supabase secrets set AFRICASTALKING_USERNAME=<sandbox-or-approved-live-username>
```

Keep `MARITIME_SMS_ENABLED=false` until the provider credentials and production sender are verified. Use `sandbox` for provider sandbox testing; use the actual approved Africa's Talking username for a live account. The username is passed explicitly to the SMS function so live requests do not accidentally use the sandbox identity.

## 5. Staging smoke tests

1. Sign in as an ordinary user and confirm that they can only read and manage their own private geospatial records and vessel.
2. Save a point and a polygon in Satellite; confirm both appear and their popups show source and quality metadata.
3. Register a vessel, explicitly enable device GPS sharing, and confirm the recorded location includes capture time and accuracy.
4. Try to submit an old, inaccurate or mismatched GPS fix; the server must reject SOS broadcast and rescue acceptance.
5. Broadcast a test SOS between controlled test accounts, accept it from another test vessel, send a message and resolve it. Do not use a real emergency as a test.
6. Confirm an ordinary authenticated account cannot directly insert or update SOS events/messages and cannot read external responder phone numbers. Admin access should remain available.
7. Call `send-sms` without a trusted service-role authorization header; expect HTTP 401.
8. In Post-Harvest Tracker, save a harvest and capture the storage site's device GPS. The feature should appear in Satellite as private and observed. The GPS point proves the device position and reported accuracy; it does not independently prove the facility's identity.
9. In AGTrans, share a driver device GPS fix and confirm stale, simulated or inaccurate positions are not presented as verified live tracking.
10. In Aerial Console, confirm only fresh non-simulator telemetry with a valid GPS fix and acceptable reported accuracy can be sent to Satellite.

## 6. Known data and routing limits

- Crop suitability is a low-confidence climate-screening result using NASA POWER climatology and broad FAO EcoCrop species references. It is not a soil test, farm survey, yield prediction or planting guarantee.
- SoilGrids point access is not used while its REST service is paused; FAO GAEZ raster layers are not yet ingested. Do not treat either as a measured input.
- Port records discovered from OpenStreetMap represent mapped features only. Port operating status, cargo handling capacity, access permission and berth availability are not verified by OSM geometry.
- Road paths use the public OSRM demo routing endpoint. The result is a route-planning estimate, not live traffic, freight regulation or heavy-vehicle clearance. Cached routes must remain visibly dated and may be stale.
- Maritime rescue ETA is a straight-line estimate, not a marine route. Local emergency services and marine radio remain the primary emergency channels.

## 7. Promote only after staging passes

After successful migration verification and the smoke tests above, review and merge PR #20, then deploy the app using the repository's normal production process. Keep SMS disabled until its separate provider and operational checks are completed.
