export const HARDWARE_COMPONENTS = [
  "farm-handler",
  "agro-inventory",
  "post-harvest",
  "market-link",
  "agtrans",
  "agroforecast",
  "agrorisk",
  "aerial-console",
  "satellite",
] as const;

export type HardwareComponent = (typeof HARDWARE_COMPONENTS)[number];

export type DeviceProtocol =
  | "browser-camera"
  | "browser-geolocation"
  | "ble-gatt"
  | "usb-hid"
  | "usb-serial"
  | "https-api"
  | "mqtt-tls"
  | "mavlink"
  | "vendor-sdk"
  | "satellite-api"
  | "manual";

export type DeviceState = "unregistered" | "registered" | "available" | "connected" | "disconnected" | "revoked" | "fault";

export type DeviceCapability =
  | "image-capture"
  | "video-capture"
  | "location"
  | "barcode-scan"
  | "weight-measurement"
  | "temperature"
  | "relative-humidity"
  | "soil-moisture"
  | "soil-temperature"
  | "soil-ph"
  | "electrical-conductivity"
  | "rainfall"
  | "wind"
  | "water-level"
  | "vehicle-location"
  | "vehicle-speed"
  | "aircraft-telemetry"
  | "aerial-imagery"
  | "satellite-imagery";

export interface DeviceRegistration {
  deviceId: string;
  tenantId: string;
  ownerUserId: string;
  component: HardwareComponent;
  deviceClass: string;
  manufacturer: string;
  model: string;
  firmwareVersion?: string;
  protocol: DeviceProtocol;
  capabilities: DeviceCapability[];
  farmId?: string;
  siteId?: string;
  registeredAt: string;
  state: DeviceState;
}

export type ObservationMetric =
  | "temperature"
  | "relative_humidity"
  | "soil_moisture"
  | "soil_temperature"
  | "soil_ph"
  | "electrical_conductivity"
  | "rainfall"
  | "wind_speed"
  | "wind_direction"
  | "water_level"
  | "vehicle_speed"
  | "aircraft_altitude"
  | "aircraft_battery"
  | "latitude"
  | "longitude";

export type ObservationQuality = "valid" | "suspect" | "rejected";

export interface DeviceObservation {
  eventId: string;
  deviceId: string;
  tenantId: string;
  component: HardwareComponent;
  farmId?: string;
  siteId?: string;
  relatedRecordId?: string;
  metric: ObservationMetric;
  value: number;
  unit: string;
  measuredAt: string;
  receivedAt: string;
  quality: ObservationQuality;
  sourceProtocol: DeviceProtocol;
  sourceModel?: string;
  firmwareVersion?: string;
  latitude?: number;
  longitude?: number;
  metadata?: Record<string, string | number | boolean | null>;
}

export interface AdapterConnection {
  connected: boolean;
  connectedAt?: string;
  detail?: string;
}

export interface HardwareAdapter {
  readonly adapterId: string;
  readonly protocol: DeviceProtocol;
  readonly components: readonly HardwareComponent[];
  supports(device: DeviceRegistration): boolean;
  connect(device: DeviceRegistration): Promise<AdapterConnection>;
  disconnect(deviceId: string): Promise<void>;
}

export interface ObservationValidation {
  valid: boolean;
  issues: string[];
}
