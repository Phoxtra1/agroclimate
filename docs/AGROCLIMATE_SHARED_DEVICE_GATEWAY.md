# Shared AgroClimate Device Management and Communication

## Scope
This shared gateway serves Farm Handler, Agro Inventory, Market Link, AGTrans, AgroForecast, AgroRisk, Aerial Console and Satellite when a component needs an owner-provisioned device or a device-originated observation.

**All listed components remain in scope.** Their existing capabilities and planned hardware/electronic-device integrations must not be removed because a particular event is not a sensor measurement. Component-specific workflows may use different integration paths: telemetry ingestion, direct peripheral input, platform camera/location APIs, vendor SDKs, provider APIs or dedicated connectors.

**Post-Harvest is deliberately excluded from this generic registry only because it already has its own dedicated implementation.** It keeps using `post_harvest_station_devices`, `post_harvest_station_credentials`, `post_harvest_station_observations` and the `post-harvest-station` Edge Function. Its functionality and hardware integration remain fully in scope for AgroClimate.

## Amineva Global operating model
Amineva Global is intended to be the installed software environment and primary gateway through which users access AgroClimate. Ordinary users should not need a separate AgroClimate installation or be asked to manage technical device credentials and protocols. AgroClimate retains its backend, data model, product permissions and specialised services. The eventual Amineva host/runtime and secure authentication hand-off will be defined during the Amineva Global refinement; do not invent a client-side secret or bypass AgroClimate authorisation.

Device provisioning, pairing and technical configuration should be performed through an authorised deployment or administration workflow. Component users should encounter the agricultural capability, not low-level connection setup.

## What this shared gateway establishes
- One owner-scoped registry for non-Post-Harvest devices.
- Per-device one-time bearer credentials; only SHA-256 token hashes are stored.
- Owner-authenticated registration and revocation.
- Device-authenticated HTTPS observation ingestion.
- Component identity is taken from the registered device, never trusted from the payload.
- Server receipt time, device last-seen heartbeat, timezone-aware measurement time and idempotency keys.
- Owner-only read access through RLS; credential table has no client-role access.
- Repeated idempotency keys are accepted only when the stored observation matches; conflicting reuse returns HTTP 409.

The registry is one integration mechanism, not a limitation on which components can use hardware. Not every peripheral event belongs in a time-series observations table.

## Component boundaries and preserved capabilities
- **Farm Handler:** preserve phone camera, GNSS, attendance, tasks and evidence. The shared registry can support optional accessories where justified; it does not replace the existing workflows.
- **Agro Inventory:** preserve barcode scanners, scales, printers, inventory terminals and other supported peripherals. Scan and weight inputs should enter the active inventory workflow as operational events; they need not be stored as generic sensor observations.
- **Market Link:** preserve listings, orders, negotiation, communication and camera evidence. Add hardware or kiosk integration through the appropriate workflow-specific connector where needed.
- **AGTrans:** preserve driver-phone GPS and transport workflows. Optional vehicle trackers remain a separate provenance stream and may use the shared telemetry gateway.
- **AgroForecast:** preserve external forecasts, alerts and location features. Weather-station measurements are measured data and remain distinct from forecasts.
- **AgroRisk:** preserve land, soil and environmental analysis. Sensor readings require sensor-specific calibration, unit conversion and validity checks before influencing risk calculations.
- **Aerial Console:** preserve all approved aerial/drone features, planning, mission-related workflows, simulator functionality and telemetry. This gateway supports read-only telemetry only; it does not silently introduce or remove flight-control functionality.
- **Satellite:** preserve satellite imagery, provider scenes, geospatial analysis, land/field assessment and farm-device access to those capabilities. Satellite/provider imagery is not a physical sensor observation and should use its appropriate imagery/provider pipeline; the shared device registry may describe a future provider/device integration where justified.
- **Post-Harvest:** preserve its complete dedicated station-device and observation implementation. Do not migrate those records or issue shared-gateway credentials for Post-Harvest.

## Edge Function contract
Deploy `agroclimate-device-gateway` and invoke it with POST JSON.

### Register (authorised owner/deployment session required)
```json
{
  "action": "register",
  "component": "agrorisk",
  "device_name": "North field sensor",
  "hardware_id": "vendor-serial-or-owner-assigned-id",
  "manufacturer": "Manufacturer",
  "model": "Exact model",
  "firmware_version": "Version",
  "protocol": "https-api",
  "capabilities": ["soil-moisture", "soil-ph"],
  "farm_id": "optional-existing-farm-reference",
  "site_id": "optional-site-reference"
}
```
The response contains `device` and `device_token`. The token is shown once; store it only in the device/gateway's protected secret store. Never place it in browser local storage, logs, source code or URLs.

### Ingest (device token required)
Send `x-device-token` header and:
```json
{
  "action": "ingest",
  "metric": "soil_moisture",
  "value": 0.31,
  "unit": "m³/m³",
  "observed_at": "2026-11-20T09:15:00Z",
  "idempotency_key": "device-serial:sequence-123",
  "latitude": 5.6,
  "longitude": -0.2,
  "metadata": {"sensor_channel": "probe-1"}
}
```
Supported metric/unit pairs are enforced by the gateway. Payload values must be JSON numbers, not numeric strings. The observed timestamp must include a timezone and cannot be more than five minutes in the future. Coordinates must be supplied together and within geographic bounds. The gateway imposes request-size and metadata limits.

### Revoke (authorised owner/deployment session required)
```json
{"action":"revoke","device_id":"registered-device-uuid"}
```
Revocation marks the device and its credential revoked. It does not delete historical observations.

## Data handling and storage discipline
- Keep time-series sensor measurements in the observation store; route inventory scans, sales, staff attendance, photos, video, imagery and other business events to their appropriate product workflows and storage.
- Do not duplicate Post-Harvest readings in the generic registry.
- Preserve useful user records and historical agricultural evidence. No deletion or retention period should be introduced without an explicit product/data-retention decision.
- Use bounded and paginated reads. Realtime should be used only where a component genuinely needs it; do not remove existing capabilities solely to reduce database activity.
- Large photos, videos, maps and satellite imagery must use the appropriate object-storage/provider strategy rather than database rows.

## Not yet verified
No physical device model, BLE GATT service/characteristic, USB mode, MQTT broker/topic contract, vendor API, calibration procedure or field connectivity has been certified by this shared gateway. A protocol value in the registry is descriptive metadata, not proof of compatibility. Select and verify each exact model and its official interface documentation before writing its adapter.

## Operational rollout gates
1. Apply the migration in a reviewed Supabase migration run.
2. Deploy the Edge Function and confirm its environment secrets are present.
3. Test owner registration, duplicate hardware IDs, one-time token behavior, owner isolation, ingestion, retry, conflicting idempotency reuse and revocation in a non-production project.
4. Confirm RLS and credential-table privileges using separate anon, authenticated and service-role contexts.
5. Verify every existing component workflow with no optional hardware configured.
6. Verify each device/provider integration against exact model or provider documentation before certification.
