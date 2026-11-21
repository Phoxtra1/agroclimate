import { describe, expect, it } from "vitest";
import { getCalibratedFieldMeasurements } from "@/services/hardware/fieldMeasurements";
import type { DeviceObservation } from "@/services/hardware/types";

const base: DeviceObservation = {
  eventId: "sensor-reading-1", deviceId: "soil-probe-1", tenantId: "owner-1",
  component: "agrorisk", metric: "soil_moisture", value: 0.32, unit: "m³/m³",
  measuredAt: "2026-11-21T10:00:00.000Z", receivedAt: "2026-11-21T10:00:01.000Z",
  quality: "valid", sourceProtocol: "ble-gatt",
  metadata: { calibration_status: "calibrated", calibration_due_at: "2026-12-21T00:00:00.000Z" },
};

describe("calibrated AgroRisk field measurements", () => {
  const now = Date.parse("2026-11-21T10:05:00.000Z");
  it("converts calibrated volumetric moisture to percent for the risk engine", () => {
    expect(getCalibratedFieldMeasurements([base], now)).toEqual({ soilMoisturePct: 32 });
  });
  it("supports a separately scoped AgroForecast station calibration record", () => {
    const station = { ...base, component: "agroforecast" as const };
    expect(getCalibratedFieldMeasurements([station], now, "agroforecast")).toEqual({ soilMoisturePct: 32 });
    expect(getCalibratedFieldMeasurements([station], now)).toEqual({});
  });
  it("does not use uncalibrated or expired-calibration readings", () => {
    expect(getCalibratedFieldMeasurements([{ ...base, metadata: {} }], now)).toEqual({});
    expect(getCalibratedFieldMeasurements([{ ...base, metadata: { ...base.metadata, calibration_due_at: "2026-11-20T00:00:00.000Z" } }], now)).toEqual({});
  });
  it("does not use stale readings", () => {
    expect(getCalibratedFieldMeasurements([{ ...base, measuredAt: "2026-11-21T09:00:00.000Z" }], now)).toEqual({});
  });
  it("accepts percentage units and rejects out-of-range values", () => {
    expect(getCalibratedFieldMeasurements([{ ...base, value: 44, unit: "%" }], now)).toEqual({ soilMoisturePct: 44 });
    expect(getCalibratedFieldMeasurements([{ ...base, value: 144, unit: "%" }], now)).toEqual({});
  });
});
