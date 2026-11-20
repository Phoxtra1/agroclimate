import { describe, expect, it, vi } from "vitest";
import { HardwareAdapterRegistry } from "@/services/hardware/adapterRegistry";
import { COMPONENT_HARDWARE_PROFILES } from "@/services/hardware/componentProfiles";
import { validateDeviceObservation } from "@/services/hardware/observation";
import type { DeviceObservation, DeviceRegistration, HardwareAdapter } from "@/services/hardware/types";

const device: DeviceRegistration = {
  deviceId: "logger-001",
  tenantId: "tenant-001",
  ownerUserId: "user-001",
  component: "post-harvest",
  deviceClass: "temperature-humidity-logger",
  manufacturer: "Example",
  model: "Model-A",
  protocol: "ble-gatt",
  capabilities: ["temperature", "relative-humidity"],
  registeredAt: "2026-11-20T08:00:00Z",
  state: "registered",
};

const observation: DeviceObservation = {
  eventId: "evt-001",
  deviceId: "logger-001",
  tenantId: "tenant-001",
  component: "post-harvest",
  farmId: "farm-001",
  siteId: "store-001",
  metric: "temperature",
  value: 23.5,
  unit: "°C",
  measuredAt: "2026-11-20T08:00:00Z",
  receivedAt: "2026-11-20T08:01:00Z",
  quality: "valid",
  sourceProtocol: "ble-gatt",
};

describe("AgroClimate hardware integration contracts", () => {
  it("defines a profile for every AgroClimate hardware-facing component", () => {
    expect(Object.keys(COMPONENT_HARDWARE_PROFILES).sort()).toEqual([
      "agro-inventory", "agroforecast", "agrorisk", "agtrans",
      "aerial-console", "farm-handler", "market-link", "post-harvest", "satellite",
    ].sort());
  });

  it("accepts a well-formed timestamped sensor observation", () => {
    expect(validateDeviceObservation(observation, Date.parse("2026-11-20T08:02:00Z")).valid).toBe(true);
  });

  it("rejects non-finite measurements, invalid units and malformed timestamps", () => {
    const invalid = {
      ...observation,
      value: Number.NaN,
      unit: "banana",
      measuredAt: "yesterday",
    };
    const result = validateDeviceObservation(invalid, Date.parse("2026-11-20T08:02:00Z"));
    expect(result.valid).toBe(false);
    expect(result.issues).toHaveLength(3);
  });

  it("rejects half-specified and out-of-range coordinates", () => {
    expect(validateDeviceObservation({ ...observation, latitude: 91, longitude: 0 }).valid).toBe(false);
    expect(validateDeviceObservation({ ...observation, latitude: 5.6 }).issues).toContain(
      "latitude and longitude must be supplied together.",
    );
  });

  it("rejects observations marked rejected and future receipt timestamps", () => {
    expect(validateDeviceObservation({ ...observation, quality: "rejected" }).valid).toBe(false);
    expect(validateDeviceObservation({
      ...observation,
      receivedAt: "2026-11-20T09:00:00Z",
    }, Date.parse("2026-11-20T08:02:00Z")).valid).toBe(false);
  });

  it("selects only an explicitly registered adapter matching protocol and component", () => {
    const adapter: HardwareAdapter = {
      adapterId: "test-ble",
      protocol: "ble-gatt",
      components: ["post-harvest"],
      supports: (candidate) => candidate.model === "Model-A",
      connect: vi.fn(async () => ({ connected: false, detail: "No device paired in this test." })),
      disconnect: vi.fn(async () => undefined),
    };
    const registry = new HardwareAdapterRegistry();
    expect(registry.findFor(device)).toBeNull();
    registry.register(adapter);
    expect(registry.findFor(device)?.adapterId).toBe("test-ble");
    expect(registry.findFor({ ...device, protocol: "https-api" })).toBeNull();
    expect(() => registry.register(adapter)).toThrow(/already registered/);
    expect(registry.unregister("test-ble")).toBe(true);
    expect(registry.findFor(device)).toBeNull();
  });
});
