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
const MAX_FUTURE_CLOCK_SKEW_MS = 5 * 60 * 1000;
const MAX_METADATA_ENTRIES = 20;

function isValidTimestamp(value: string): boolean {
  return ISO_DATE.test(value) && Number.isFinite(Date.parse(value));
}

function metricValueIssue(metric: DeviceObservation["metric"], value: number, unit: string): string | null {
  const within = (min: number, max: number) => value >= min && value <= max;
  switch (metric) {
    case "relative_humidity":
      return within(0, 100) ? null : "relative_humidity must be between 0 and 100.";
    case "soil_moisture":
      return unit === "m³/m³"
        ? (within(0, 1) ? null : "soil_moisture in m³/m³ must be between 0 and 1.")
        : (within(0, 100) ? null : "soil_moisture percentage must be between 0 and 100.");
    case "soil_ph":
      return within(0, 14) ? null : "soil_ph must be between 0 and 14.";
    case "wind_direction":
      return within(0, 360) ? null : "wind_direction must be between 0 and 360 degrees.";
    case "aircraft_battery":
      return unit === "%"
        ? (within(0, 100) ? null : "aircraft_battery percentage must be between 0 and 100.")
        : (value >= 0 ? null : "aircraft_battery voltage cannot be negative.");
    case "latitude":
      return within(-90, 90) ? null : "latitude measurement must be between -90 and 90.";
    case "longitude":
      return within(-180, 180) ? null : "longitude measurement must be between -180 and 180.";
    case "rainfall":
    case "wind_speed":
    case "electrical_conductivity":
    case "water_level":
    case "weight":
    case "vehicle_speed":
      return value >= 0 ? null : `${metric} cannot be negative.`;
    default:
      return null;
  }
}

export function validateDeviceObservation(
  observation: DeviceObservation,
  now = Date.now(),
): ObservationValidation {
  const issues: string[] = [];

  if (typeof observation.eventId !== "string" || !observation.eventId.trim() || observation.eventId.length > 160) {
    issues.push("eventId is required and must not exceed 160 characters.");
  }
  if (typeof observation.deviceId !== "string" || !observation.deviceId.trim() || observation.deviceId.length > 128) {
    issues.push("deviceId is required and must not exceed 128 characters.");
  }
  if (typeof observation.tenantId !== "string" || !observation.tenantId.trim() || observation.tenantId.length > 128) {
    issues.push("tenantId is required and must not exceed 128 characters.");
  }
  if (!Number.isFinite(observation.value)) issues.push("value must be a finite number.");
  if (!UNIT_ALLOWLIST[observation.metric]?.includes(observation.unit)) {
    issues.push("unit is not valid for the selected metric.");
  } else if (Number.isFinite(observation.value)) {
    const rangeIssue = metricValueIssue(observation.metric, observation.value, observation.unit);
    if (rangeIssue) issues.push(rangeIssue);
  }

  if (typeof observation.measuredAt !== "string" || !isValidTimestamp(observation.measuredAt)) {
    issues.push("measuredAt must be a valid timezone-aware ISO 8601 timestamp.");
  } else if (Date.parse(observation.measuredAt) > now + MAX_FUTURE_CLOCK_SKEW_MS) {
    issues.push("measuredAt cannot be more than five minutes in the future.");
  }

  if (typeof observation.receivedAt !== "string" || !isValidTimestamp(observation.receivedAt)) {
    issues.push("receivedAt must be a valid timezone-aware ISO 8601 timestamp.");
  } else if (Date.parse(observation.receivedAt) > now + MAX_FUTURE_CLOCK_SKEW_MS) {
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

  if (observation.sourceModel !== undefined && (typeof observation.sourceModel !== "string" || observation.sourceModel.length > 100)) {
    issues.push("sourceModel must not exceed 100 characters.");
  }
  if (observation.firmwareVersion !== undefined && (typeof observation.firmwareVersion !== "string" || observation.firmwareVersion.length > 80)) {
    issues.push("firmwareVersion must not exceed 80 characters.");
  }

  if (observation.metadata !== undefined) {
    if (!observation.metadata || typeof observation.metadata !== "object" || Array.isArray(observation.metadata)) {
      issues.push("metadata must be a flat object.");
    } else {
      const entries = Object.entries(observation.metadata);
      if (entries.length > MAX_METADATA_ENTRIES) {
        issues.push(`metadata cannot contain more than ${MAX_METADATA_ENTRIES} entries.`);
      }
      for (const [key, value] of entries) {
        if (!key.trim() || key.length > 64) issues.push("metadata keys must contain 1 to 64 characters.");
        if (typeof value === "string" && value.length > 256) {
          issues.push("metadata string values must not exceed 256 characters.");
        } else if (value !== null && !["string", "number", "boolean"].includes(typeof value)) {
          issues.push("metadata values must be strings, numbers, booleans, or null.");
        } else if (typeof value === "number" && !Number.isFinite(value)) {
          issues.push("metadata numbers must be finite.");
        }
      }
    }
  }

  if (observation.quality === "rejected") {
    issues.push("rejected observations cannot be ingested.");
  } else if (!["valid", "suspect"].includes(observation.quality)) {
    issues.push("quality must be valid or suspect.");
  }

  return { valid: issues.length === 0, issues };
}
