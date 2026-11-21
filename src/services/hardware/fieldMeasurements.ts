import type { DeviceObservation } from "./types";

export interface CalibratedFieldMeasurements {
  soilMoisturePct?: number;
}

const MAX_READING_AGE_MS = 30 * 60 * 1000;

/**
 * Only uses a fresh, explicitly calibrated soil-moisture observation.
 * Calibration metadata is supplied by the device provisioning/calibration
 * workflow; merely receiving a reading does not make it calibrated.
 */
export function getCalibratedFieldMeasurements(
  observations: readonly DeviceObservation[],
  now = Date.now(),
  component: DeviceObservation["component"] = "agrorisk",
): CalibratedFieldMeasurements {
  const reading = observations
    .filter((item) => item.metric === "soil_moisture" && item.quality === "valid")
    .filter((item) => item.component === component)
    .filter((item) => {
      const measuredAt = Date.parse(item.measuredAt);
      return Number.isFinite(measuredAt) && measuredAt <= now && now - measuredAt <= MAX_READING_AGE_MS;
    })
    .filter((item) => item.metadata?.calibration_status === "calibrated")
    .filter((item) => {
      const dueAt = item.metadata?.calibration_due_at;
      return typeof dueAt === "string" && Number.isFinite(Date.parse(dueAt)) && Date.parse(dueAt) >= now;
    })
    .sort((a, b) => Date.parse(b.measuredAt) - Date.parse(a.measuredAt))[0];

  if (!reading) return {};
  const value = reading.unit === "m³/m³" ? reading.value * 100 : reading.value;
  if (!Number.isFinite(value) || value < 0 || value > 100) return {};
  if (reading.unit !== "%" && reading.unit !== "%VWC" && reading.unit !== "m³/m³") return {};
  return { soilMoisturePct: value };
}
