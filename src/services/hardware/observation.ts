import type { DeviceObservation, ObservationValidation } from "./types";

const UNIT_ALLOWLIST: Record<DeviceObservation["metric"], readonly string[]> = {
  temperature: ["°C", "C", "°F", "F"],
  relative_humidity: ["%RH", "%"],
  soil_moisture: ["%", "%VWC", "m³/m³"],
  soil_temperature: ["°C", "C", "°F", "F"],
  soil_ph: ["pH"],
  electrical_conductivity: ["µS/cm", "mS/cm", "dS/m"],
  rainfall: ["mm", "in"],
  wind_speed: ["m/s", "km/h", "mph"],
  wind_direction: ["°"],
  water_level: ["mm", "cm", "m"],
  weight: ["g", "kg", "lb"],
  vehicle_speed: ["m/s", "km/h", "mph"],
  aircraft_altitude: ["m", "ft"],
  aircraft_battery: ["%", "V"],
  latitude: ["°"],
  longitude: ["°"],
};

const ISO_DATE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/;

export function validateDeviceObservation(
  observation: DeviceObservation,
  now = Date.now(),
): ObservationValidation {
  const issues: string[] = [];

  if (!observation.eventId.trim()) issues.push("eventId is required for idempotent ingestion.");
  if (!observation.deviceId.trim()) issues.push("deviceId is required.");
  if (!observation.tenantId.trim()) issues.push("tenantId is required.");
  if (!Number.isFinite(observation.value)) issues.push("value must be a finite number.");
  if (!UNIT_ALLOWLIST[observation.metric]?.includes(observation.unit)) {
    issues.push("unit is not valid for the selected metric.");
  }
  if (!ISO_DATE.test(observation.measuredAt) || !Number.isFinite(Date.parse(observation.measuredAt))) {
    issues.push("measuredAt must be a valid timezone-aware ISO 8601 timestamp.");
  }
  if (!ISO_DATE.test(observation.receivedAt) || !Number.isFinite(Date.parse(observation.receivedAt))) {
    issues.push("receivedAt must be a valid timezone-aware ISO 8601 timestamp.");
  } else if (Date.parse(observation.receivedAt) > now + 5 * 60 * 1000) {
    issues.push("receivedAt cannot be more than five minutes in the future.");
  }
  if (observation.latitude !== undefined && (!Number.isFinite(observation.latitude) || observation.latitude < -90 || observation.latitude > 90)) {
    issues.push("latitude must be between -90 and 90.");
  }
  if (observation.longitude !== undefined && (!Number.isFinite(observation.longitude) || observation.longitude < -180 || observation.longitude > 180)) {
    issues.push("longitude must be between -180 and 180.");
  }
  if ((observation.latitude === undefined) !== (observation.longitude === undefined)) {
    issues.push("latitude and longitude must be supplied together.");
  }
  if (observation.quality === "rejected") {
    issues.push("rejected observations cannot be ingested.");
  }

  return { valid: issues.length === 0, issues };
}
