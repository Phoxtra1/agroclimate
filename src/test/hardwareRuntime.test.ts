import { describe, expect, it } from "vitest";
import { BarcodeScanBuffer, BrowserCameraAdapter, BrowserGeolocationAdapter, hardwareCapabilitySupportsMetric } from "@/services/hardware/browserAdapters";
import { DeviceIntegrationRuntime, ResilientObservationDelivery } from "@/services/hardware/deviceRuntime";
import type { DeviceObservation, DeviceRegistration } from "@/services/hardware/types";

const device: DeviceRegistration = {
  deviceId: "logger-001", tenantId: "tenant-001", ownerUserId: "user-001",
  component: "post-harvest", deviceClass: "temperature-humidity-logger",
  manufacturer: "Example", model: "Model-A", protocol: "ble-gatt",
  capabilities: ["temperature", "relative-humidity"], registeredAt: "2026-11-20T08:00:00Z", state: "registered",
};
const observation: DeviceObservation = {
  eventId: "evt-001", deviceId: "logger-001", tenantId: "tenant-001",
  component: "post-harvest", metric: "temperature", value: 23.5, unit: "°C",
  measuredAt: "2026-11-20T08:00:00Z", receivedAt: "2026-11-20T08:01:00Z",
  quality: "valid", sourceProtocol: "ble-gatt",
};

describe("hardware capability mapping", () => {
  it("maps scale and weather capabilities to their concrete observation metrics", () => {
    expect(hardwareCapabilitySupportsMetric("weight-measurement", "weight")).toBe(true);
    expect(hardwareCapabilitySupportsMetric("wind", "wind_speed")).toBe(true);
    expect(hardwareCapabilitySupportsMetric("wind", "wind_direction")).toBe(true);
    expect(hardwareCapabilitySupportsMetric("relative-humidity", "relative_humidity")).toBe(true);
    expect(hardwareCapabilitySupportsMetric("weight-measurement", "temperature")).toBe(false);
  });
});

describe("hardware runtime and browser adapters", () => {
  it("turns keyboard-wedge scanner keystrokes into complete barcode events", () => {
    const scans: string[] = [];
    const scanner = new BarcodeScanBuffer((value) => scans.push(value));
    for (const key of ["5", "0", "2", "1", "9", "Enter"]) scanner.handleKey(key, 1000);
    expect(scans).toEqual(["50219"]);
  });

  it("starts and stops a browser location watch and emits coordinate observations", async () => {
    let success: ((position: any) => void) | undefined;
    let cleared = -1;
    const geo = {
      watchPosition: (callback: (position: any) => void) => { success = callback; return 17; },
      clearWatch: (id: number) => { cleared = id; },
    };
    const emitted: DeviceObservation[] = [];
    const adapter = new BrowserGeolocationAdapter({ onObservation: (item) => { emitted.push(item); } }, geo);
    const locationDevice: DeviceRegistration = {
      ...device, deviceId: "field-phone", component: "farm-handler",
      protocol: "browser-geolocation", capabilities: ["location"],
    };
    expect(adapter.supports(locationDevice)).toBe(true);
    expect((await adapter.connect(locationDevice)).connected).toBe(true);
    success?.({ coords: { latitude: 5.6, longitude: -0.2, speed: null } });
    expect(emitted.map((item) => item.metric)).toEqual(["latitude", "longitude"]);
    await adapter.disconnect(locationDevice.deviceId);
    expect(cleared).toBe(17);
  });


  it("opens and releases the camera stream for field evidence capture", async () => {
    let stopped = 0;
    const track = { stop: () => { stopped += 1; } };
    const stream = { getTracks: () => [track] } as unknown as MediaStream;
    const camera = new BrowserCameraAdapter({ getUserMedia: async () => stream });
    const cameraDevice: DeviceRegistration = {
      ...device, deviceId: "field-camera", component: "farm-handler",
      protocol: "browser-camera", capabilities: ["image-capture"],
    };
    expect(camera.supports(cameraDevice)).toBe(true);
    expect((await camera.connect(cameraDevice)).connected).toBe(true);
    expect(camera.getStream(cameraDevice.deviceId)).toBe(stream);
    await camera.disconnect(cameraDevice.deviceId);
    expect(stopped).toBe(1);
    expect(camera.getStream(cameraDevice.deviceId)).toBeNull();
  });

  it("keeps queued observations until the server sink accepts them and deduplicates event IDs", async () => {
    let fail = true;
    const persisted: DeviceObservation[][] = [];
    const store = { read: () => [], write: (items: DeviceObservation[]) => { persisted.push(items.slice()); } };
    const delivery = new ResilientObservationDelivery(async () => { if (fail) throw new Error("offline"); }, store);
    delivery.enqueue(observation);
    delivery.enqueue(observation);
    expect(delivery.pending()).toHaveLength(1);
    expect(persisted[persisted.length - 1]).toHaveLength(1);
    fail = false;
    expect(await delivery.flush()).toEqual({ delivered: 1, remaining: 0 });
  });

  it("rejects observations from another tenant or component", () => {
    const delivery = new ResilientObservationDelivery(async () => undefined, { read: () => [], write: () => undefined });
    const runtime = new DeviceIntegrationRuntime(delivery);
    runtime.registerDevice(device);
    expect(() => runtime.acceptObservation({ ...observation, tenantId: "other-tenant" })).toThrow(/tenant, component or protocol/);
  });
});
