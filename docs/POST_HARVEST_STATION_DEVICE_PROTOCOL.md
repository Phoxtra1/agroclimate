# Post-Harvest Station Device Protocol (Phase 1)

## Scope

This integration accepts storage-station temperature and relative-humidity observations. It provides owner-controlled provisioning, device authentication, persistent readings, idempotent retries, and revocation.

It does **not** claim that a physical station is connected, calibrated, or validated. No hardware model or sensor protocol has yet been selected. A device appears as recently connected only after it successfully uploads a reading.

## Data path

1. An authenticated farm owner opens Post-Harvest Tracker → Post-Harvest Station.
2. The owner registers a station using its unique hardware ID. The gateway issues a random 256-bit bearer token once.
3. The database stores only the token's SHA-256 hash in a service-role-only table.
4. The station sends readings to the Supabase Edge Function `post-harvest-station`.
5. The gateway validates the token, device status, owner/harvest association, value ranges and idempotency key, then stores the observation.
6. The owner dashboard reads only records allowed by row-level security. A station token can be revoked from the dashboard.

## Provisioning request

Authenticated application request:

```json
{
  "action": "register",
  "device_name": "Main Store Sensor",
  "hardware_id": "manufacturer-serial-number",
  "model": "sensor-model",
  "harvest_entry_id": "optional-harvest-entry-uuid"
}
```

The response contains `device` and `device_token`. Save the token in the device's protected configuration immediately. It is never returned by later registry reads.

## Sensor ingestion request

Send an HTTPS POST to:

```
<SUPABASE_URL>/functions/v1/post-harvest-station
```

Headers:

```
Content-Type: application/json
apikey: <SUPABASE_PUBLISHABLE_KEY>
x-device-token: <ONE_TIME_ISSUED_DEVICE_TOKEN>
```

Body:

```json
{
  "action": "ingest",
  "temperature_c": 27.4,
  "humidity_pct": 68.2,
  "observed_at": "2026-11-20T08:30:00.000Z",
  "idempotency_key": "device-serial:boot-id:sequence-000042",
  "sequence_no": 42,
  "firmware": "1.0.0",
  "sensor_model": "selected-sensor-part-number"
}
```

- Temperature accepted range: -40 to 85 °C.
- Relative humidity accepted range: 0 to 100 %RH.
- `observed_at` must be a valid timestamp and cannot be more than five minutes in the future.
- `idempotency_key` is required and unique per device. Repeating the same key returns the existing observation instead of creating a duplicate.
- Devices should retain readings locally and retry with the **same** idempotency key after network failures.
- The optional `harvest_entry_id` may associate a reading with a harvest record, but it must belong to the device owner.

## Revocation

The owner can revoke a station from the dashboard. Revocation invalidates its token and prevents further ingestion. Registering the same hardware ID again requires resolving the existing device record first.

## Hardware requirements before field deployment

Select and validate an actual station model and sensor pair. At minimum, document:
- MCU / gateway model and firmware version;
- temperature and humidity sensor model, operating range and accuracy;
- power source and expected backup duration;
- Wi-Fi, Ethernet or cellular transport and retry behaviour;
- enclosure / IP rating and installation environment;
- calibration method, calibration date and next due date;
- unique hardware serial and secure token storage.

A successful API upload proves that the gateway received a device-reported value. It does not prove sensor calibration, sensor accuracy, food safety, or contaminant absence. Chemical residue and pathogen detection are outside this protocol.
