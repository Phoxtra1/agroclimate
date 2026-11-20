# AgroClimate managed hardware integration

## Architecture boundary

Amineva Global is intended to be the user's installed software environment and primary gateway to AgroClimate. Ordinary farmers, workers and customers should not be asked to register devices, select communication protocols, copy bearer tokens or configure gateways.

AgroClimate remains a product service with its own backend and authorisation rules. Hardware provisioning belongs to an authorised deployment/operations process. Component screens consume approved, assigned device data; they do not expose the provisioning API as a customer workflow.

## Scope of this shared telemetry gateway

The generic gateway is intentionally limited to components that need timestamped, device-originated telemetry:

- **AGTrans:** optional vehicle-tracker telemetry. Driver-phone location continues through the existing AGTrans workflow.
- **AgroForecast:** measured weather-station observations. External forecasts remain forecast data.
- **AgroRisk:** calibrated soil and environmental sensor observations.
- **Aerial Console:** read-only aircraft telemetry. This gateway does not issue flight-control commands.

The following are deliberately excluded because they do not need this generic time-series registry:

- **Post-Harvest:** retains its existing dedicated station registry, credential store, observations and post-harvest-station Edge Function.
- **Agro Inventory:** barcode scanners and scales are input peripherals. Their scan/weight events should enter the active inventory workflow and must not be accumulated as generic telemetry rows.
- **Farm Handler:** phone camera and optional phone GNSS workflows remain the primary tools.
- **Market Link:** listings, orders, negotiation and camera evidence do not require a generic device registry.
- **Satellite:** imagery and geospatial information come from external providers, not user-owned satellite hardware.

This keeps the generic device registry focused and avoids storing operational events that belong in product transactions.

## Gateway behavior

- Owner-scoped device metadata.
- Per-device one-time bearer credential; only SHA-256 token hashes are stored.
- Device-authenticated HTTPS observation ingestion.
- Component identity is taken from the registered device, never trusted from the payload.
- Server receipt time, timezone-aware measurement time and idempotency keys.
- Owner-only reads through RLS; credential table has no client-role access.
- Duplicate idempotency keys are accepted only when the existing observation matches; conflicting reuse returns HTTP 409.
- Observation queries should be bounded and paginated by consumers. Do not stream every sensor event into a continuously refreshed dashboard.

The registration/revocation API is a provisioning capability, not a customer-facing feature. It must only be exposed through an authorised deployment/operations workflow. Do not place registration forms or one-time device tokens in ordinary component screens or persist tokens in browser storage.

## Observation contract

Send the x-device-token header and a JSON body containing:

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

The gateway enforces metric/unit allowlists, finite numeric values, plausible ranges, timezone-aware timestamps, coordinate bounds, request-size limits and metadata limits. Payload values must be JSON numbers, not numeric strings.

## Data minimisation

- Do not store barcode scans, POS actions, employee attendance, camera uploads, forecast API responses or satellite imagery in the telemetry table.
- Do not duplicate Post-Harvest readings in this registry.
- Keep only compact measurements and essential provenance metadata.
- Use bounded reads and avoid unnecessary Realtime subscriptions for high-frequency observations.
- Define retention periods for each sensor class before production rollout; do not silently delete historical agricultural records without an agreed retention policy.
- Large photos, videos, maps and imagery must use dedicated storage/provider policies rather than database rows.

## Not yet verified

No physical device model, BLE GATT characteristic, USB mode, MQTT topic, vendor API, calibration procedure or field connectivity has been certified. A protocol value is descriptive metadata, not proof of compatibility. Verify each exact model and its official interface documentation before implementing its adapter.

## Rollout gates

1. Review and apply the migration in a non-production Supabase project.
2. Deploy the Edge Function and confirm environment secrets.
3. Test registration, owner isolation, ingestion, retries, conflicting idempotency reuse and revocation.
4. Confirm RLS and credential-table privileges using separate anon, authenticated and service-role contexts.
5. Verify existing component workflows with no optional hardware configured.
6. Add the device-specific adapter only after the exact model and documentation are known.
