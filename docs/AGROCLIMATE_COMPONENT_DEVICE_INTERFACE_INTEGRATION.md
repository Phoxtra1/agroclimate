# AgroClimate Component Interface Connection to Shared Device Gateway

## Purpose
This change connects the component interfaces to the shared registry and HTTPS observation gateway introduced in the shared-device-gateway foundation. It adds an optional device panel to existing component pages. It does not replace or alter the established operational workflows.

## Shared interface behavior
The reusable `SharedDevicePanel`:
- Loads only the signed-in owner's devices and observations through the existing Supabase client and RLS policies.
- Filters both datasets by the current component.
- Registers devices through `agroclimate-device-gateway` using the current authenticated session.
- Shows the newly issued device token once in component memory and offers a copy action. It is not saved to local storage, cookies, URLs or application database plaintext.
- Revokes a device through the owner-authenticated gateway.
- Displays device status, declared protocol, last authenticated message time and recent persisted observations.
- Refreshes on manual request and Supabase Realtime events for the owner's device and observation rows.
- Describes protocol as declared metadata, not verified compatibility. An active registration with no last-seen timestamp is displayed as awaiting its first message.

## Component placement

| Component | Existing interface extended | Existing workflow preserved |
|---|---|---|
| Farm Handler | Handler Workspace | Phone camera, optional GPS, clock-in/out, task completion and evidence uploads remain unchanged. |
| Agro Inventory | Agro Inventory | Manual stock entry, adjustments, harvest, loss and sales records remain unchanged. Device observations do not mutate stock or harvest records. |
| Market Link | Market Link | Listings, orders, negotiations, agreements, messaging and Produce Safety remain unchanged. |
| AGTrans | Driver Hub | Driver onboarding, offers, trip requests, job status and existing phone-based location tracking remain unchanged. Vehicle tracker readings are a separate provenance stream. |
| AgroForecast | Weather | External forecasts, alerts and weather-derived estimates remain unchanged and are not relabelled as measured station readings. |
| AgroRisk | Environmental Monitor | Existing map, local/AI risk assessment and weather-derived analysis remain unchanged. Sensor readings are displayed as a separate observation stream. |
| Aerial Console | Drone Advisory / Operations | Existing simulator and read-only telemetry paths remain unchanged. No flight-control command path is added. |
| Satellite | Satellite workspace | Existing imagery, monitored fields and alert workflows remain unchanged. The optional registry can describe a future provider/API connector; it does not imply user-owned satellite hardware. |

Post-Harvest is not mounted on this shared panel. It continues to use its dedicated station registry and ingestion panel.

## Registration workflow
1. Open the relevant component page and expand/register a device in its Device connections panel.
2. Enter the device's actual serial or assigned hardware ID, manufacturer, exact model and firmware where known.
3. Select only the protocol confirmed by the device documentation. Until verified, keep the descriptive value as `manual`.
4. The gateway returns a one-time token. Store it only in the device or trusted gateway's protected secret store.
5. Configure the verified adapter/gateway to POST observations to the Edge Function using the `x-device-token` header and the documented metric, unit, observed timestamp and idempotency key.
6. The component panel displays persisted observations and the last authenticated message time. Revoking a device prevents further authenticated ingestion and retains historical observations.

## Workflow-preservation boundaries
- The new panel is additive and optional. No existing form, workflow, page route, permission, or business record is made dependent on device registration.
- No sensor reading creates or changes an inventory record, harvest batch, task, transport job, drone mission, field boundary or risk assessment automatically.
- Existing phone/browser GPS and camera features remain in place. Registering an accessory does not replace those sources.
- Forecast, estimate, simulation, provider imagery and physical measurement remain separate data provenance categories.
- No physical model or vendor protocol is certified by this interface work.

## Validation still required
The interface code and integration paths have been added, but the Supabase migration and Edge Function must be deployed before live use. Validate in a non-production project:
- signed-out state and signed-in owner isolation;
- register, duplicate hardware ID and one-time token behavior;
- device list and observation list under RLS;
- Realtime updates for registry and observations;
- token-based ingestion and idempotent retries;
- revocation and rejected post-revocation ingestion;
- each original workflow with zero devices registered.

A physical device is not considered connected until a verified model-specific adapter sends an authenticated reading and the component interface receives that persisted observation.
