# AgroClimate component device integration readiness

This register describes software paths present in the repository. A component being software-ready does not prove that a physical model, cloud migration, secret, or live device has been configured or tested.

## Component-by-component status

| Component | Device/data role | Software path now present | Remaining verification |
|---|---|---|---|
| Farm Handler | Phone camera and phone GNSS; no dedicated device required for the current workflow | Existing task/evidence and location workflows use browser camera/GPS. The shared gateway supports farm-handler records if a future dedicated tracker is provisioned. | Verify permissions, accuracy and offline behavior on target phones. Do not register a phone as an external gateway device unless its app actually sends gateway observations. |
| Agro Inventory | Barcode/QR scanner and weighing scale | Keyboard-wedge barcode input links codes to existing inventory items. Shared gateway observations feed the page. A fresh scale value in a supported mass unit can populate a weighed-input record. | Test actual scanner keyboard mode, scale HID/BLE/serial output, tare behavior and unit configuration. Stale scale values are display-only. |
| Post-Harvest | Storage temperature and relative-humidity station | Dedicated registration/revocation and token-based ingestion; numeric range checks, idempotency, owner binding, realtime dashboard readings. Sensor data is shown separately from age/storage-method estimates. | Apply migrations/deploy the post-harvest-station Edge Function, configure the station protocol/decoder, then test actual sensor accuracy and signal loss. No food-safety certification or pathogen detection is implied. |
| Market Link | Optional produce weighing scale and phone camera | Product photo capture is part of the listing workflow. Shared gateway weight readings are consumed; only a fresh reading whose unit matches the selected listing unit can be applied to quantity. | Test supported scales and confirm units/rounding. Scale weight is a quantity measurement, not quality or food-safety verification. |
| AGTrans | Driver phone GNSS and optional dedicated vehicle tracker | Assigned-driver GPS sharing remains opt-in and feeds the trip workflow. Dedicated tracker coordinates and speed are displayed as a separate provenance stream; tracker location does not silently replace driver location. | Test phone GPS accuracy, permissions, serial NMEA wiring and tracker model. Server-side tracker-to-vehicle binding is still required before tracker telemetry can become authoritative trip location. |
| AgroForecast | External weather provider plus optional physical weather station | Provider forecast remains separate from measured station readings. Persisted gateway observations are displayed. Fresh soil-moisture readings are used in irrigation advisories only when the device registry has a valid calibration due date. | Validate station metric mappings, rainfall/wind units, sensor placement, calibration and the selected weather provider. |
| AgroRisk | Soil/environment sensors | Persisted readings are displayed separately from model estimates. Fresh soil-moisture measurements with owner-managed calibration validity can feed the deterministic local risk calculation. | Sensor-specific calibration and location/farm binding are still required. pH, EC, soil temperature, rainfall and water-level readings remain informational until their domain-specific conversions and risk thresholds are validated. |
| Aerial Console | Aircraft telemetry and imagery | Simulator and live telemetry are labelled separately. Custom JSON/MAVLink-related telemetry paths are read-only where implemented. Shared gateway aircraft observations now appear in a separate read-only telemetry panel and cannot command flight controls. | Verify exact aircraft, flight controller, serial adapter and telemetry schema. Do not use the gateway feed for arming, takeoff, navigation, return-to-home or landing. |
| Satellite | External satellite imagery/geospatial APIs | Sentinel-2/STAC field monitoring and derived indices are software/API workflows; no user-owned satellite hardware is required. | Apply database migration, deploy satellite-field-monitor, configure its secret/Vault/cron prerequisites and verify scheduled execution/logs in the connected Supabase project. |

## Shared device provisioning and ingestion

- The shared gateway covers Agro Inventory, Market Link, AGTrans, AgroForecast, AgroRisk and Aerial Console, plus future Farm Handler/Satellite integrations. Post-Harvest intentionally retains its dedicated gateway.
- Owner registration issues a high-entropy device token once. Only its SHA-256 hash is stored server-side. The new component registry panel never saves the raw token to browser storage; it displays it once for secure transfer to the device.
- Revocation invalidates the credential and marks the device revoked.
- Ingestion binds component, owner, farm and site to the registered device record. Client payloads cannot reassign a device to another owner/farm/site.
- Observations are checked for metric/unit compatibility, numeric ranges, timestamps, coordinate ranges, metadata size and idempotency before persistence.
- Component consumers read persisted, owner-scoped observations and refresh from Supabase Realtime.
- A device appearing as Registered is not a connection confirmation. The device is considered to have signalled only after a successful accepted observation updates its last-seen timestamp.

## Not yet certified

The repository cannot certify hardware compatibility without named models and physical tests. No actual BLE sensor, USB/HID scale, NMEA tracker, MAVLink flight controller, storage station, or camera accessory has been tested as part of this software pass. Cloud deployment also remains unverified until migrations, Edge Functions, secrets, Realtime publication and scheduled jobs are confirmed in the target Supabase project.
