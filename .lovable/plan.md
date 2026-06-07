## Drone Operations & Aerial Intelligence Center

Upgrade the existing Flight Advisory page (`src/pages/DroneAdvisory.tsx`) into a full **Drone Operations Console** with aviation-style mission control UI, powered by Odeneho AI. AGNav stays as an embedded map component.

### Scope & Approach

Given the size (10 feature blocks), I'll deliver a **complete, production-ready scaffold** with real working logic where possible and clearly-architected simulation layers where physical hardware is required (drones aren't connectable from a browser without native bridges). Everything is wired so real MAVLink/DJI/Pixhawk bridges can be plugged into the same interfaces later.

---

### 1. New Route & Layout

- Replace `/drone-advisory` page with a new **Mission Control** layout:
  ```text
  ┌─────────────────────────────────────────────────────┐
  │  Header: Drone status • Battery • Signal • AI Alert │
  ├──────────────────────────┬──────────────────────────┤
  │  LIVE VIDEO PANEL        │  AGNav MAP (live pos)    │
  │  (telemetry overlay)     │  (waypoints, route, RTH) │
  ├──────────────────────────┴──────────────────────────┤
  │  Telemetry strip (alt, speed, GPS, wind, etc.)     │
  ├─────────────────────────────────────────────────────┤
  │  Tabs: Connection | Mission | Vision AI | Media |   │
  │        Analytics | Advisory                         │
  └─────────────────────────────────────────────────────┘
  ```
- Dark aviation theme using existing design tokens; HUD-style monospace readouts for telemetry.

### 2. Drone Connection Layer (`src/lib/drone/`)

- `src/lib/drone/types.ts` — `DroneConnection`, `DroneTelemetry`, `FlightStatus`, protocols (`wifi | mavlink | ardupilot | pixhawk | dji | custom`).
- `src/lib/drone/connectionManager.ts` — pluggable adapter pattern:
  - `ConnectionAdapter` interface (scan/connect/disconnect/sendCommand/onTelemetry).
  - `SimulatorAdapter` — generates realistic telemetry for demo/testing.
  - Stubs `MavlinkAdapter`, `DjiAdapter`, `PixhawkAdapter` that throw "requires native bridge" with clear pathway for future wiring.
- `useDrone()` React hook exposing connection state, telemetry stream, and commands.

### 3. Connection Center UI

Buttons: Scan, Connect, Disconnect, Pair, Calibrate, Start/Pause/Resume Mission, RTH, Emergency Land. Status cards: name, model, battery %, signal, camera, GPS, firmware, flight status.

### 4. Live Flight View

- `<LiveVideoPanel />` — `<video>` element with fallback placeholder; supports WebRTC stream URL.
- Controls: Fullscreen (Fullscreen API), PiP (`requestPictureInPicture`), Screenshot (canvas capture), Record (MediaRecorder).
- Telemetry HUD overlay (altitude, speed, distance, heading, battery, duration) rendered as absolutely-positioned semi-transparent panels.

### 5. AGNav Integration

- Embed existing AGNav as a `<MissionMap />` component on the right pane; pass live drone position, waypoints, mission boundary, home position, RTH path.
- Add map layer toggles (satellite/terrain/climate/flood/crop health) using existing AGNav layer system where present.

### 6. Telemetry Dashboard

- Real-time telemetry cards bound to telemetry stream (updates every 500 ms).
- Environmental data pulled from existing `useWeather` hook tied to drone's current GPS.

### 7. Odeneho AI Flight Advisory Engine

- New edge function `supabase/functions/odeneho-flight-ops/index.ts` using Lovable AI (`google/gemini-3-flash-preview`) with structured tool-calling output.
- Inputs: telemetry snapshot + weather + mission context.
- Outputs: risk scores, alerts (high wind, rain risk, low battery, signal loss, unsafe altitude, RTH recommendation, route optimization).
- Frontend hook `useFlightAdvisor()` polls every 30 s while flying; emits Live AI Alert Banner.

### 8. Odeneho Vision Module

- Edge function `supabase/functions/odeneho-vision/index.ts` — accepts captured frame (base64) + context, uses `google/gemini-2.5-pro` (multimodal).
- Detects: crop stress, pest damage, disease, flood, dry zones, nutrient deficiency, erosion, water accumulation, fire risk, vegetation health.
- Returns observations, risk scores, recommended actions, optional bounding-box hints (drawn over live frame).

### 9. Mission Planning Center

- New tables (see Technical Details).
- Form: name, mission type (mapping, inspection, irrigation, flood, pest, survey, spraying), farm selector, area polygon (draw on AGNav), altitude, speed, route pattern (grid/perimeter/spiral/manual), camera settings.
- Estimators: flight time, battery use, coverage area (calculated client-side from area + speed + altitude).

### 10. Drone Media Center

- Reuse existing storage bucket pattern; add `drone-media` storage bucket (private) for images/videos/logs/AI reports.
- Browser UI: grid of captures, filters (mission, date, type), actions: download, share (link copy), export (zip), archive (flag).

### 11. Analytics Dashboard

- Aggregations from `drone_missions`, telemetry logs, AI detections: total missions, flight time, distance, area surveyed, crop health index, risk counts, fleet utilization, battery performance, mission success rate.

### 12. Future-Ready

- Fleet/multi-drone schema in place (`drone_id` on missions, fleet table).
- `useFleet()` hook stub. Autonomous mission flag on missions table.

---

### Technical Details

**Database migration** (one migration, with GRANTs + RLS):
- Extend existing `drone_missions` (add: drone_id, mission_type, area_polygon jsonb, altitude_m, speed_ms, route_pattern, status, started_at, completed_at, estimated_battery_pct, estimated_duration_min, estimated_coverage_ha, success).
- New tables:
  - `drones` — user_id, name, model, protocol, firmware, serial, paired_at, status, last_seen, last_battery_pct.
  - `drone_telemetry_logs` — mission_id, captured_at, lat, lng, alt_m, speed_ms, heading, battery_pct, signal, gps_fix.
  - `drone_media` — user_id, mission_id, type (image/video/log/report), storage_path, captured_at, metadata jsonb.
  - `drone_ai_detections` — mission_id, captured_at, category, observation, risk_score, recommended_action, bounding_box jsonb, media_id.
- Storage bucket: `drone-media` (private). RLS so users see only their own.

**Edge functions**:
- `odeneho-flight-ops` — flight advisory (text → structured JSON).
- `odeneho-vision` — multimodal image analysis.
- Both use AI SDK + `LOVABLE_API_KEY` already configured.

**Frontend files**:
- `src/pages/DroneAdvisory.tsx` — rewritten as Mission Control shell.
- `src/components/drone/`:
  - `LiveVideoPanel.tsx`, `TelemetryHUD.tsx`, `MissionMap.tsx`, `ConnectionPanel.tsx`, `MissionPlanner.tsx`, `VisionPanel.tsx`, `MediaCenter.tsx`, `AnalyticsPanel.tsx`, `AdvisoryBanner.tsx`, `FloatingControls.tsx`.
- `src/hooks/`: `useDrone.ts`, `useFlightAdvisor.ts`, `useDroneVision.ts`, `useMissions.ts`, `useDroneMedia.ts`.
- `src/lib/drone/`: types, adapters, simulator.

**Honest constraint**: Real drone connection (MAVLink/DJI/Pixhawk) from a browser requires a native companion app or WebUSB/WebSerial bridge. The simulator adapter gives a fully functional demo; protocol adapters are scaffolded with clear "connect your bridge here" entry points so plugging real hardware later is a localized change.

**No mocked AI**: Both edge functions hit real Lovable AI. Only the drone telemetry source is simulated when no hardware bridge is connected.

---

### Out of Scope (will not be built in this pass)

- Native mobile bridge app for real MAVLink/DJI radios.
- Live RTMP/WebRTC ingest server (UI is ready for stream URL; you supply the source).
- Real-time multi-user mission collaboration.

Say **continue** and I'll execute the full build in one pass: migration → edge functions → drone lib → hooks → components → page integration.
