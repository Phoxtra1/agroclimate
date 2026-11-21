import type { DeviceObservation } from "./types";
import { validateDeviceObservation } from "./observation";
import { DEVICE_CONTRACT_VERSION, normalizeDeviceMeasurement } from "../../../supabase/functions/_shared/deviceContract";
export { DEVICE_CONTRACT_VERSION, normalizeDeviceMeasurement, deviceReadingState } from "../../../supabase/functions/_shared/deviceContract";

/** Amineva interchange: original evidence remains intact beside canonical units. */
export function toAminevaObservation(observation: DeviceObservation) {
  const validation = validateDeviceObservation(observation);
  if (!validation.valid) throw new Error(validation.issues.join("; "));
  return {
    schemaVersion: DEVICE_CONTRACT_VERSION,
    product: "agroclimate" as const,
    observation: { ...observation },
    normalizedMeasurement: normalizeDeviceMeasurement(observation.metric, observation.value, observation.unit),
  };
}