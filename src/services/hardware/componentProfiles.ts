import type { DeviceCapability, DeviceProtocol, HardwareComponent } from "./types";

export interface ComponentHardwareProfile {
  component: HardwareComponent;
  capabilities: readonly DeviceCapability[];
  candidateProtocols: readonly DeviceProtocol[];
  requiresPhysicalDevice: boolean;
  notes: string;
}

/**
 * Compatibility guidance only. A candidate protocol is not proof that a
 * specific device implements it; verify the exact model and vendor docs first.
 */
export const COMPONENT_HARDWARE_PROFILES: Record<HardwareComponent, ComponentHardwareProfile> = {
  "farm-handler": {
    component: "farm-handler",
    capabilities: ["image-capture", "video-capture", "location"],
    candidateProtocols: ["browser-camera", "browser-geolocation"],
    requiresPhysicalDevice: false,
    notes: "Existing phone/browser workflow remains primary; no dedicated hardware is required.",
  },
  "agro-inventory": {
    component: "agro-inventory",
    capabilities: ["barcode-scan", "weight-measurement"],
    candidateProtocols: ["usb-hid", "ble-gatt", "usb-serial"],
    requiresPhysicalDevice: false,
    notes: "Manual item and quantity entry remains available; validate scanner mode and scale units per model.",
  },
  "post-harvest": {
    component: "post-harvest",
    capabilities: ["temperature", "relative-humidity"],
    candidateProtocols: ["ble-gatt", "https-api", "mqtt-tls"],
    requiresPhysicalDevice: false,
    notes: "Initial logger scope is read-only temperature/humidity; keep sensor readings separate from harvest records.",
  },
  "market-link": {
    component: "market-link",
    capabilities: ["image-capture", "weight-measurement"],
    candidateProtocols: ["browser-camera", "usb-hid", "ble-gatt"],
    requiresPhysicalDevice: false,
    notes: "Market listings, communication and agreements must work without paired devices.",
  },
  agtrans: {
    component: "agtrans",
    capabilities: ["vehicle-location", "vehicle-speed"],
    candidateProtocols: ["browser-geolocation", "usb-serial", "https-api", "mqtt-tls"],
    requiresPhysicalDevice: false,
    notes: "Driver phone GNSS and dedicated vehicle-tracker telemetry are distinct provenance sources.",
  },
  agroforecast: {
    component: "agroforecast",
    capabilities: ["temperature", "relative-humidity", "rainfall", "wind"],
    candidateProtocols: ["https-api", "mqtt-tls", "ble-gatt"],
    requiresPhysicalDevice: false,
    notes: "External forecast providers remain valid; distinguish measured station data from forecasts and estimates.",
  },
  agrorisk: {
    component: "agrorisk",
    capabilities: ["soil-moisture", "soil-temperature", "soil-ph", "electrical-conductivity", "rainfall", "water-level"],
    candidateProtocols: ["https-api", "mqtt-tls", "ble-gatt", "usb-serial"],
    requiresPhysicalDevice: false,
    notes: "Validate units, calibration and location before sensor readings enter risk calculations.",
  },
  "aerial-console": {
    component: "aerial-console",
    capabilities: ["aircraft-telemetry", "aerial-imagery", "location"],
    candidateProtocols: ["mavlink", "vendor-sdk", "https-api"],
    requiresPhysicalDevice: false,
    notes: "Simulator must remain visibly distinct from live aircraft; phase-one physical integration is read-only.",
  },
  satellite: {
    component: "satellite",
    capabilities: ["satellite-imagery"],
    candidateProtocols: ["satellite-api", "https-api"],
    requiresPhysicalDevice: false,
    notes: "Uses satellite imagery/geospatial providers; no user-owned satellite device is required.",
  },
};
