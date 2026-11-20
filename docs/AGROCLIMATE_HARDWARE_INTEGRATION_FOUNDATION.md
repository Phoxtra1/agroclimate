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


## 11. Full AgroClimate component-by-component hardware readiness map

This section covers the full existing AgroClimate product scope. It does not mean every integration is already implemented or that every component needs its own physical device.

| AgroClimate component | Existing software responsibility | Hardware / external source boundary | Software work required before real-device testing |
|---|---|---|---|
| Farm Handler | Worker identity, clock-in/out, assigned tasks, task completion, photos/video evidence, optional location | Android phone/tablet camera and GNSS; optional rugged shared handset | Keep browser workflow as default; make permission failures non-blocking; standardize optional capture metadata; verify offline session/task behavior and evidence retry without changing current records. |
| Agro Inventory | Farm inputs, labour/land costs, harvest, losses and sales | Optional barcode/QR scanner, weighing scale, label printer | Define optional scan/weight input adapters and explicit unit conversion/precision rules. Manual entry must remain available. Do not infer inventory quantities from unverified device output. |
| Post-Harvest Tracker | Harvest batches, storage location/method, photos and risk overview; existing offline harvest queue | Temperature/humidity logger first; later moisture or gas sensors only if a validated use case requires them | Add a separate sensor-observation contract, device enrollment, storage-location association, quality/staleness states, idempotent ingestion and offline buffer rules. Sensor observations must not silently create or alter harvest batches. |
| Market Link | Produce supply/demand listings, buyer/supplier communication, orders/contracts and transport hand-off | Phone/computer, camera, connectivity; optional scale/barcode data may be supplied from Agro Inventory | Keep listing and negotiation workflows independent of device availability; define verified quantity/grade evidence hand-off from inventory/post-harvest. Do not create a second transport matcher. |
| AGTrans | Driver onboarding, transport requests, matching, delivery jobs, tracking and trip status | Driver Android phone GNSS first; optional vehicle tracker/telematics gateway later | Standardize trusted GPS provenance, timestamp, accuracy, freshness, driver/job ownership and tracking consent. Treat phone GPS and dedicated tracker feeds as different sources. Preserve the existing AGTrans supplier/driver workflow. |
| AgroForecast | Weather forecasts, advisories and alerts | External weather provider initially; optional local weather station (rainfall, temperature, humidity, wind, solar) | Define source precedence, station registration, calibration metadata, units, observation timestamps, provider-vs-station provenance and stale-data behavior. Do not label derived estimates as measured sensor observations. |
| AgroRisk / Environmental Monitor | Environmental conditions, soil/flood/disaster risk assessment and farm alerts | Optional soil moisture/temperature, pH/EC, rainfall and water-level sensors; weather provider and geospatial layers | Define per-sensor units/ranges, farm/location ownership, quality checks, confidence/provenance and risk-engine input boundaries. Risk calculations must distinguish measured readings from modelled estimates. |
| Aerial Console / Drone Operations | Mission planning, flight advisory, fleet views, imagery/media and telemetry presentation | Compatible drone and manufacturer SDK/API or documented MAVLink/PX4/ArduPilot bridge; camera payloads where supported | Separate simulator from live hardware sources; add vendor/protocol adapters only after a model is selected; validate aircraft identity, telemetry freshness, operator authorization and safety interlocks. Phase one is read-only telemetry/media ingestion; no arm/takeoff/mission commands. |
| Satellite | Farm boundaries, imagery layers, vegetation indices, geospatial analysis, navigation and map overlays | Satellite imagery/geospatial service APIs; no user-owned satellite device required | Verify provider terms, attribution, coverage, refresh timestamps, tile/API credentials, quotas and fallback behavior. Satellite imagery must be clearly distinguished from live local sensor readings. |
| Livestock, Alerts, Produce Safety, Farm Check and Agro Learning | Supporting farm operations, alerts, safety checks and learning content | Mostly phone/tablet/computer; may consume verified data from the above components | No separate hardware driver is required. Integrate only through validated shared farm/location/batch references and existing application services. |

### Shared device integration services required across components

Before any live device is paired, the software integration layer must define and test these cross-cutting capabilities:

1. **Device registry:** unique device identity, device class, manufacturer/model, firmware, owner/tenant, farm/site assignment, supported capabilities, registration state and revocation.
2. **Connection adapters:** protocol-specific drivers isolated from page components. A page must never import a vendor SDK directly.
3. **Normalized observations:** common envelope for source/device ID, tenant/farm/site, optional component entity, metric, numeric value, unit, measured timestamp, received timestamp, quality, location and provenance.
4. **Authentication and authorization:** short-lived scoped credentials; no service-role key, permanent vendor token or device secret in frontend storage. Tenant/farm ownership enforced server-side.
5. **Transport and gateway:** HTTPS ingestion for supported vendor APIs; MQTT over TLS only through an authenticated gateway; BLE/USB/serial adapters only for verified device models and supported runtime environments.
6. **Offline buffer and idempotency:** durable device/gateway queue, stable event IDs, retry with backoff, duplicate rejection, explicit acknowledgements and account isolation.
7. **Health and diagnostics:** connected/disconnected, last seen, signal/battery where available, last successful sync, error reason, stale-data indicator and calibration status.
8. **Audit and lifecycle:** pairing, ownership assignment, credential rotation, access revocation, data export/deletion and event audit.
9. **Safe fallback:** every current manual workflow remains usable when a device, permission, API, network or gateway is unavailable.
10. **Observability:** structured logs and actionable error states; never let device initialization block the application shell or route rendering.

### Existing code that must not be mistaken for live hardware integration

- The Aerial Integration Hub contains a `TelemetryGateway` that can publish simulated telemetry. Its presence is not proof of a physical drone connection.
- The aircraft registry includes sample/default aircraft entries and protocol labels. These are not verified connected aircraft.
- The drone fleet hook generates a virtual fleet/telemetry stream. Simulated aircraft must be explicitly identified as simulation in all operational status and must never be represented as live telemetry.
- The existing weather hook can derive agricultural metrics when the provider does not supply them. Derived values must not be presented as direct measurements from a physical soil/weather sensor.
- The current browser GPS path in Farm Handler and AGTrans is a handset location source, not a dedicated vehicle tracker or precision GNSS receiver.

## 12. Amineva Global platform integration boundary

The main Amineva Global application is the repository `Phoxtra1/agsuite`; AgroClimate is `Phoxtra1/agroclimate`.

### Existing main-platform connection points verified in source

- Amineva's default admin product catalogue already contains AgroClimate with the destination `https://agro.amineva.com`.
- Amineva product routing already maps the `agroclimate` product key to that same destination.
- Amineva's public Explore page already lists AgroClimate and links to that destination.
- Amineva has an AgroClimate communications hook for weather alerts and crop advisories through its ComsSDK.
- The product-selection gateway's default category catalogue did not explicitly categorize AgroClimate. A separate additive PR is being prepared to place it under an Agriculture category instead of allowing it to appear under the generic “Other Applications” grouping.

### Required platform integration before declaring the ecosystem complete

- **Product discovery and launch:** AgroClimate appears consistently in the Amineva Global product catalogue, category gateway, Explore page and product routing, with one canonical destination.
- **Account and identity:** determine and implement a secure account hand-off/SSO flow. The current AgroClimate application uses Supabase Auth while the Amineva Global portal uses its own Appwrite/SEAL auth stack. A matching email address or opening the subdomain is not proof of SSO. Do not pass raw passwords or long-lived bearer tokens in query strings/local storage.
- **Account linking:** map the Amineva Global principal to an AgroClimate principal using a server-verified, short-lived, single-use identity assertion, with explicit account linking and revocation. Do not merge accounts by email alone.
- **Access and entitlements:** Amineva Global remains the central product discovery/billing authority under the agreed central-billing direction; AgroClimate enforces its own server-side product entitlements. A central catalogue listing does not itself grant a subscription.
- **Billing feed:** Amineva Switch currently describes application billing feeds as not connected. Connect verified AgroClimate invoices/payment/subscription events only after an authenticated server-to-server contract is agreed. Do not claim billing synchronization is complete.
- **Notifications:** route AgroClimate notifications through the agreed ComsSDK contract with tenant/user identity verified; escape untrusted text before inserting it into email HTML.
- **Navigation and return path:** preserve the user’s originating Amineva route and provide a safe return-to-Amineva link without weakening AgroClimate authorization.
- **Operational status:** distinguish product availability, user entitlement, service health and hardware connectivity as separate states.

The current catalogue/launch link is a product-navigation integration. Full SSO, account linking, entitlement enforcement and billing-feed integration are separate work and must not be described as already complete.

## 13. Completion gates before any physical-device test

A physical-device test must not begin until all of the following are complete:

- All existing AgroClimate component routes and core workflows pass the software regression suite.
- The shared hardware integration contracts and per-component adapter boundaries are implemented and reviewed.
- Simulated telemetry is clearly separated from live device telemetry.
- Farm Handler and Post-Harvest fallback workflows pass without any device.
- The normalized observation contract, security model, device registry lifecycle and offline/idempotent sync tests are complete.
- No device failure or permission denial can blank a route or block the app shell.
- Amineva Global product catalogue/category/navigation integration is complete.
- The SSO/account-linking decision and implementation are complete before promising one-login access; otherwise the portal must clearly use the existing independent sign-in flow.
- Central entitlement and billing-feed boundaries are implemented or explicitly marked not connected; no false payment/subscription state is shown.
- CI passes type-check, lint, unit tests and production build on the exact final commit.
- Preview deployment and production deployment are independently verified.
- Only after these gates pass do we choose actual phone/sensor models for physical validation.
