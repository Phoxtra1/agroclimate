# AgroClimate Hardware Integration Foundation

**Status:** Architecture and compatibility baseline only  
**Scope:** Farm Handler and Post-Harvest Tracker first  
**Application impact:** None. This document does not change routes, screens, database tables, migrations, authentication, storage policies, or existing workflows.

## 1. Non-negotiable integration rules

1. The existing AgroClimate application remains the system of record. Hardware supplies observations and evidence; it does not replace existing application workflows.
2. Integrations are additive and opt-in. A user without a paired device must continue using the current phone/browser workflow exactly as before.
3. Do not add device SDKs, browser permissions, new routes, database migrations, background services, or UI controls until a specific device and its interface have been verified.
4. Never make a device connection a prerequisite for rendering a page. Device discovery and connection must be isolated behind optional adapters and must fail closed to the existing manual workflow.
5. Do not write guessed sensor fields into existing tables. Sensor observations require a reviewed data contract and a confirmed persistence design before implementation.
6. No automatic device control is in scope. Initial integration is read-only telemetry and evidence capture.
7. Every implementation change must be isolated on a feature branch, reviewed in a pull request, and pass CI before merge. No direct edits to `main`.

## 2. What the current code already supports

### Farm Handler

The current Handler Workspace already uses browser capabilities and existing Supabase workflows:

- Clock-in and clock-out through `work_sessions`.
- Optional browser geolocation for session and evidence coordinates.
- Task completion and task evidence through `handler_tasks` and `task_evidence`.
- Photo/video evidence upload through the existing `handler-evidence` storage bucket.
- Farmer-side handler, task, session, issue, and evidence management.

**Implication:** The first field device should be an ordinary Android smartphone or tablet with a camera, location services, a modern browser, and mobile data/Wi-Fi. No dedicated wearable, custom handheld, or new hardware is required to begin field validation.

### Post-Harvest Tracker

The existing tracker records harvest batches and supporting information, including crop, quantity/unit, harvest date, storage location/method, notes, and photos. It already has an offline harvest queue and a retry/synchronization path.

**Implication:** Existing manual harvest logging remains the fallback and baseline. A sensor must not be allowed to create or modify harvest batches implicitly. Sensor readings should be associated with a known storage location and, where the user explicitly selects it, a harvest batch.

## 3. Phase-one device compatibility matrix

| Area | Initial device class | Required baseline | Interface/capability | Phase-one role |
|---|---|---|---|---|
| Farm Handler | Android smartphone/tablet | Supported Android version, current Chrome or compatible browser, camera, location permission, adequate local storage, network access at least periodically | Camera, browser geolocation, HTTPS, cellular/Wi-Fi | Clock-in/out, task updates, photos/video, location-tagged evidence |
| Farm Handler (shared device) | Rugged Android handset/tablet, optional | Same baseline plus durable case, replaceable power, device lock and managed account sign-out | Same browser APIs | More durable field deployment; not a software prerequisite |
| Post-harvest monitoring | Standalone temperature/humidity logger with documented export/API | Manufacturer documentation, calibrated measurement range, timestamped readings, stable device identity, export method | Prefer documented BLE GATT or vendor gateway/API; USB/Wi-Fi acceptable when documented | Read-only storage-condition observations |
| Post-harvest multi-sensor site | Sensor gateway/data logger, optional | Local buffering, timestamp retention, documented interface, secure credential handling, recoverable connectivity | HTTPS API or MQTT over TLS from gateway; protocol selected only after model verification | Forward readings from one or more sensors |
| Future inventory capture | Bluetooth/USB barcode scanner or weighing scale | Documented HID/BLE/serial mode and units/precision | Keyboard wedge, BLE, USB or documented API | Separate future assessment; not part of this phase |

### Compatibility cautions

- Do not assume every Android browser exposes Bluetooth Low Energy. Browser support, permissions, device firmware, and pairing behavior vary.
- Do not assume browser Web Bluetooth is available on iOS or every Android browser. A gateway or manufacturer-supported companion app may be necessary.
- Do not assume a sensor supports BLE GATT, Modbus, MQTT, or any other protocol until its exact model and documentation are inspected.
- Do not connect industrial RS-485/Modbus sensors directly to a phone. Use a compatible, secured gateway where appropriate.
- USB serial access is browser/device dependent and must be validated against the actual handset, cable, adapter, and browser.
- Camera and location access require HTTPS and explicit user permission. Denial must not blank the page or block unrelated tasks.

## 4. Recommended system boundary

```text
Farm worker's Android phone/tablet
  ├─ Existing AgroClimate web app
  ├─ Existing Handler Workspace and Supabase workflows
  ├─ Camera and browser geolocation
  └─ Optional future device adapter (not yet implemented)

Storage area
  ├─ Temperature/humidity logger(s)
  └─ Optional sensor gateway
       └─ Authenticated HTTPS ingestion endpoint (future, after schema review)
            └─ Validated sensor observation store (future, separate from harvest batches)
                 └─ Post-Harvest Tracker presentation (future, additive)
```

The browser app must not become responsible for maintaining a permanent BLE connection or acting as an always-on sensor gateway. For continuous storage monitoring, a logger with local memory or a dedicated gateway is preferred. It should retain readings during internet outages and forward them when connectivity returns.

## 5. Data contract to agree before sensor code

A future sensor observation should carry, at minimum:

- `observation_id`: stable unique event identifier for retry-safe ingestion.
- `device_id`: registered device identifier, not a browser user-agent string.
- `farm_id` and `storage_location_id`: verified AgroClimate ownership/location references.
- `harvest_batch_id`: optional reference selected by the user; never inferred.
- `metric`: controlled value such as `temperature` or `relative_humidity`.
- `value` and `unit`: numeric measurement and explicit unit (for example °C or %RH).
- `measured_at`: device measurement time in ISO 8601 UTC.
- `received_at`: server receipt time in ISO 8601 UTC.
- `quality_status`: validated, suspect, or rejected, with reason where applicable.
- `source`: device/gateway and firmware metadata sufficient for traceability.

Ingestion must validate device registration, ownership, units, timestamp bounds, payload size, and duplicate event IDs. Preserve the original measurement timestamp. Do not silently convert missing, malformed, or out-of-range readings into zero. Mark stale/offline readings clearly rather than presenting them as current.

This is a proposed contract, not a claim that these columns or tables exist. Before implementation, inspect the deployed schema, existing RLS policies, storage policies, and generated Supabase types. Only then prepare a narrowly scoped migration, if one is necessary.

## 6. Offline and reliability requirements

- Existing Handler and harvest workflows remain usable when no hardware is paired.
- Do not place credentials, service-role keys, or long-lived device secrets in browser storage or frontend code.
- Device/gateway buffers readings locally during network loss and retries with stable observation IDs.
- The server treats duplicate submissions idempotently.
- Sync state distinguishes queued, sent, acknowledged, and rejected observations.
- Device time drift, stale data, low battery, sensor disconnection, and calibration expiry must be visible as data-quality states, not silently hidden.
- Failed device discovery, permission denial, unsupported APIs, and malformed readings must produce a recoverable message while leaving the rest of AgroClimate usable.

## 7. Implementation sequence and release gates

### Gate 0 — Architecture baseline (this change)
- Document current app boundaries and hardware compatibility assumptions.
- No runtime code, route, schema, or UI changes.

### Gate 1 — Select and verify actual devices
- Shortlist one Android handset/tablet for Farm Handler field testing.
- Shortlist one temperature/humidity logger for Post-Harvest Tracker.
- Obtain manufacturer model numbers, manuals, protocol/API documentation, power requirements, environmental rating, calibration details, and export behavior.
- Confirm local availability and support before purchase.
- Record the exact tested browser/OS/device combinations.

**Exit condition:** Each selected device has verified documentation and a repeatable connection/export test. No protocol is assumed from its product category.

### Gate 2 — Non-invasive Farm Handler field validation
- Test the existing Handler Workspace on the selected Android device.
- Verify sign-in, clock-in/out, task list, task completion, camera upload, geolocation permission denial, intermittent connectivity, and recovery after refresh.
- Do not add a new app wrapper or device SDK unless field testing proves it necessary.

**Exit condition:** Existing workflows pass on the target device without regression or blank screens.

### Gate 3 — Sensor proof of concept in isolation
- Build a separate adapter/prototype against the selected logger or gateway.
- Read-only data collection; no control commands.
- Validate units, timestamps, duplicate handling, offline buffering, and reconnect behavior using test data.
- Keep the prototype outside production routes until the contract and security review pass.

**Exit condition:** Repeatable readings are collected and validated without changing existing harvest records.

### Gate 4 — Backend and UI integration proposal
- Inspect live schema and RLS before proposing any migration.
- Review device enrollment, ownership, ingestion authentication, retention, alert thresholds, and auditability.
- Add a separate observation model and additive UI only through a reviewed PR.
- Keep the manual harvest workflow and all existing pages intact.

**Exit condition:** Tests cover authenticated access, cross-account isolation, malformed payloads, stale data, duplicate events, offline recovery, and fallback behavior.

### Gate 5 — Controlled field pilot
- Pilot with one farm and one storage location.
- Compare logger readings against a reference instrument.
- Record connectivity gaps, battery life, calibration drift, and user feedback.
- Expand only after the pilot meets agreed accuracy and reliability criteria.

## 8. Regression checklist for every future integration PR

- Existing landing page and authentication render.
- Existing routes load with and without a connected device.
- Handler clock-in/out and task workflows still work.
- Camera evidence upload still works; camera permission denial is handled.
- Geolocation denial does not block clock-in or task completion.
- Existing harvest create/list/photo workflows still work.
- Existing offline harvest queue remains account-isolated and syncs as before.
- No sensor reading can overwrite or fabricate a harvest batch.
- No new migration assumes unverified table columns, policy names, or grants.
- TypeScript, lint, unit tests, and production build pass.
- Preview and production deployment are checked separately; CI success alone is not proof of deployment health.

## 9. Explicitly out of scope for this first phase

- Custom AgroClimate hardware manufacturing.
- Phoxtra device/OS development.
- Drone flight-control integration.
- Direct satellite hardware integration.
- Automated irrigation, machinery, or other device control.
- New sensor tables or database migrations before schema verification.
- Replacing the current PWA/browser experience with a native mobile application.

**Decision:** Begin with the existing Android phone/tablet workflow for Farm Handler and one documented temperature/humidity logger for Post-Harvest Tracker. Device-specific implementation starts only after the exact hardware models and interfaces are verified.

## 10. Initial market scan — candidate loggers (not yet approved for purchase)

A first-pass scan of manufacturer documentation identifies the following candidates for a controlled Post-Harvest Tracker proof of concept:

| Candidate | Verified from published documentation | Integration assessment | Current decision |
|---|---|---|---|
| T&D TR43A | BLE 4.2; temperature and relative humidity; logger stores readings; T&D mobile app retrieves data and can upload to T&D WebStorage; sensor range 0–55°C and 10–95% RH; IP64 logger body (sensor itself is not water-resistant) | Strong candidate for a BLE/mobile field test. Public material reviewed confirms app-mediated retrieval and cloud upload, but does not yet establish an approved direct AgroClimate API or raw BLE GATT contract. | **First candidate to request a vendor integration/API answer for.** Do not promise direct ingestion yet. |
| LogTag HAXO-16BT | BLE; Android 7.0+ / iOS 15.6+ app support; 16,000 paired readings; configurable 1–60 minute interval; up to 40 m stated wireless range; LogTag Link app and LogTag Online | Useful alternative with explicit local logging and mobile retrieval. Direct third-party API / export automation still needs confirmation. | Reserve candidate; compare data export and gateway options with vendor. |
| Hioki LR8514 | Bluetooth data retrieval; 500,000 points per channel; requires separate temperature/humidity sensors; dedicated Android app | More configurable instrumentation, but sensor selection and total system cost/complexity are higher. | Not the first pilot choice; retain for a later multi-point or more demanding installation. |

Manufacturer references:
- T&D TR43A: https://tandd.com/product/tr43a/
- T&D TR4A series specifications: https://tandd.com/product/pdf/spec_tr4a-eng.pdf
- LogTag HAXO-16BT: https://www.logtag-recorders.com/en/hardware/haxo-16bt/
- Hioki LR8514: https://www.hioki.com/global/products/compact-data-loggers/wireless-compact/id_6070

### Farm Handler device selection

No separate Farm Handler hardware purchase is required for the first test. Use an existing Android smartphone/tablet that meets the baseline in section 3. If field conditions require a dedicated shared unit, choose a rugged Android device only after confirming:
- supported Android and Chrome versions;
- camera quality and camera permission behavior;
- GPS accuracy under local field conditions;
- battery life and replaceability/power-bank support;
- storage capacity for evidence queued before upload;
- repairability, local warranty, and replacement availability.

### Purchase and integration gate

This scan is not a purchase approval. Before buying any logger, obtain a current quotation and confirm supply to Ghana, warranty, replacement sensor availability, calibration service, app support, export formats, BLE protocol documentation, and whether a supported third-party API or gateway exists. A logger that only exports through a vendor app may still be useful for a manual pilot, but it must not be represented as an automated AgroClimate integration.
