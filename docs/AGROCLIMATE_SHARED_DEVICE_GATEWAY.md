# Shared AgroClimate Device Management and Communication

## Scope
This shared gateway serves Farm Handler, Agro Inventory, Market Link, AGTrans, AgroForecast, AgroRisk, Aerial Console and Satellite when a component later needs an owner-provisioned device or a device-originated observation.

**Post-Harvest is deliberately excluded.** It keeps using `post_harvest_station_devices`, `post_harvest_station_credentials`, `post_harvest_station_observations` and the `post-harvest-station` Edge Function. Do not migrate those records or issue shared-gateway credentials for Post-Harvest.

## What this establishes
- One owner-scoped registry for non-Post-Harvest devices.
- Per-device one-time bearer credentials; only SHA-256 token hashes are stored.
- Owner-authenticated registration and revocation.
- Device-authenticated HTTPS observation ingestion.
- Component identity is taken from the registered device, never trusted from the payload.
- Server receipt time, device last-seen heartbeat, timezone-aware measurement time and idempotency keys.
- Owner-only read access through RLS; credential table has no client-role access.
- Repeated idempotency keys are accepted only when the stored observation matches; conflicting reuse returns HTTP 409.

## Edge Function contract
Deploy `agroclimate-device-gateway` and invoke it with POST JSON.

### Register (owner session required)
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
The response contains `device` and `device_token`. The token is shown once; store it in the device/gateway's protected secret store. Never place it in browser local storage, logs, source code or URLs.

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

### Revoke (owner session required)
```json
{"action":"revoke","device_id":"registered-device-uuid"}
```
Revocation marks the device and its credential revoked. It does not delete historical observations.

## Component boundaries
- **Farm Handler:** the phone camera/GNSS workflow remains the primary path. This registry is for future optional accessories; it does not replace attendance or task evidence.
- **Agro Inventory / Market Link:** scanner and scale support is possible after exact HID/BLE/serial behavior and units are verified. Manual entry remains available.
- **AGTrans:** driver-phone GPS and third-party vehicle tracker data remain separate provenance streams. Do not replace the existing tracking workflow with generic observations.
- **AgroForecast:** station observations are measured data; external forecasts remain forecasts. Do not merge the two.
- **AgroRisk:** sensor readings require sensor-specific calibration, unit conversion and validity checks before they influence risk calculations.
- **Aerial Console:** this gateway is not a MAVLink flight-control implementation. Keep live telemetry read-only and distinguish it from simulator data.
- **Satellite:** imagery/provider scenes are not physical-device observations. The registry is only for a future provider/device integration if justified.

## Not yet verified
No physical device model, BLE GATT service/characteristic, USB mode, MQTT broker/topic contract, vendor API, calibration procedure or field connectivity has been certified by this shared gateway. A protocol value in the registry is descriptive metadata, not proof of compatibility. Select and verify each exact model and its official interface documentation before writing its adapter.

## Operational rollout gates
1. Apply the migration in a reviewed Supabase migration run.
2. Deploy the Edge Function and confirm its environment secrets are present.
3. Test owner registration, duplicate hardware IDs, one-time token behavior, owner isolation, ingestion, retry, conflicting idempotency reuse and revocation in a non-production project.
4. Confirm RLS and credential-table privileges using separate anon, authenticated and service-role contexts.
5. Only then implement model-specific adapters and connect component dashboards to the resulting data.
