/** Pure interchange helpers shared by the gateway and application adapters. */
export const DEVICE_CONTRACT_VERSION = "amineva.agroclimate.observation.v1";
export function acceptsDeviceContractVersion(version: unknown): boolean {
  return version === undefined || version === DEVICE_CONTRACT_VERSION;
}
export function normalizeDeviceMeasurement(metric: string, value: number, unit: string): { value: number; unit: string } {
  if (typeof value !== "number" || !Number.isFinite(value)) throw new Error("Measurement must be a finite JSON number.");
  switch (metric) {
    case "temperature": case "soil_temperature":
      if (["°C", "C"].includes(unit)) return { value, unit: "°C" };
      if (["°F", "F"].includes(unit)) return { value: (value - 32) * 5 / 9, unit: "°C" };
      break;
    case "wind_speed": case "vehicle_speed":
      if (unit === "m/s") return { value, unit };
      if (unit === "km/h") return { value: value / 3.6, unit: "m/s" };
      if (unit === "mph") return { value: value * 0.44704, unit: "m/s" };
      break;
    case "rainfall":
      if (unit === "mm") return { value, unit };
      if (unit === "in") return { value: value * 25.4, unit: "mm" };
      break;
    case "weight":
      if (unit === "kg") return { value, unit };
      if (unit === "g") return { value: value / 1000, unit: "kg" };
      if (unit === "lb") return { value: value * 0.45359237, unit: "kg" };
      break;
    case "soil_moisture":
      if (["%", "%VWC"].includes(unit)) return { value: value / 100, unit: "m³/m³" };
      if (unit === "m³/m³") return { value, unit };
      break;
    case "water_level": case "aircraft_altitude":
      if (unit === "m") return { value, unit };
      if (metric === "water_level" && unit === "cm") return { value: value / 100, unit: "m" };
      if (metric === "water_level" && unit === "mm") return { value: value / 1000, unit: "m" };
      if (metric === "aircraft_altitude" && unit === "ft") return { value: value * 0.3048, unit: "m" };
      break;
    case "electrical_conductivity":
      if (unit === "µS/cm") return { value: value / 1000, unit: "mS/cm" };
      if (["mS/cm", "dS/m"].includes(unit)) return { value, unit: "mS/cm" };
      break;
    case "relative_humidity":
      if (["%", "%RH"].includes(unit)) return { value, unit: "%RH" };
      break;
    case "soil_ph": if (unit === "pH") return { value, unit }; break;
    case "wind_direction": case "latitude": case "longitude": if (unit === "°") return { value, unit }; break;
    case "aircraft_battery": if (["%", "V"].includes(unit)) return { value, unit }; break;
    case "barcode_count": if (unit === "count") return { value, unit }; break;
  }
  throw new Error("Unsupported metric/unit pair.");
}

export function deviceReadingState(measuredAt: string, receivedAt: string, now = Date.now(), maximumAgeMs = 5 * 60 * 1000): "current" | "stale" | "invalid" {
  const measured = Date.parse(measuredAt);
  const received = Date.parse(receivedAt);
  if (!Number.isFinite(measured) || !Number.isFinite(received) || measured > now + 300000 || received > now + 300000) return "invalid";
  return now - measured > maximumAgeMs || now - received > maximumAgeMs ? "stale" : "current";
}