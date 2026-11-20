# Aerial Console: Read-Only Telemetry Phase

## Current supported modes

- **Built-in Simulator:** simulated telemetry and virtual flight operations for UI testing. Simulator sessions are not written as physical aircraft connections or physical flight telemetry.
- **Custom JSON Telemetry Bridge:** read-only telemetry over a configured WebSocket endpoint or selected USB serial port. A connection is confirmed only after a valid JSON measurement frame is received.
- **Other protocol adapters:** MAVLink, ArduPilot, Pixhawk, DJI, Autel, ADS-B, RTSP, WebRTC, MQTT, Wi-Fi and the AIH live adapter remain unavailable until a specific protocol/device implementation is completed and validated.

## JSON telemetry frame

The generic bridge accepts JSON objects with one or more finite numeric measurements from this set:

- `lat`, `lng` (must be supplied together and within WGS84 ranges);
- `altitude` or `alt`;
- `groundSpeed` or `speed`;
- `verticalSpeed`;
- `heading` or `yaw`;
- `battery` or `batteryPct` (0–100);
- `signal` or `rssi` (0–100);
- `gpsAccuracy` (non-negative).

Optional string fields include `gpsFix` (`none`, `2d`, `3d`), `cameraStatus` and `flightMode`.

WebSocket messages must contain JSON text. Serial telemetry must be newline-delimited JSON text at 57600 baud. An open socket, selected USB port, BLE advertisement, registered asset or empty JSON object is not proof of telemetry. The bridge must deliver a valid measurement frame within 12 seconds or the connection attempt fails.

## Safety boundary

The generic live adapter is read-only. It does not send calibration, arm, takeoff, pause, resume, return-to-home or landing commands. These controls remain disabled in the live telemetry UI and throw if invoked directly. Use the aircraft's verified physical safety controls for any immediate flight intervention.

Flight control may be implemented only after selecting an actual aircraft model, confirming its documented protocol and command semantics, adding safety interlocks and testing against that model in a controlled environment. No physical aircraft or hardware test is claimed by this phase.
