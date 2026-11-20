
import { BarcodeScanBuffer, BrowserGeolocationAdapter } from "@/services/hardware/browserAdapters";
import { DeviceIntegrationRuntime, ResilientObservationDelivery } from "@/services/hardware/deviceRuntime";

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

  it("keeps queued observations until the server sink accepts them and deduplicates event IDs", async () => {
    let fail = true;
    const persisted: DeviceObservation[][] = [];
    const store = {
      read: () => [],
      write: (items: DeviceObservation[]) => persisted.push([...items]),
    };
    const delivery = new ResilientObservationDelivery(async () => {
      if (fail) throw new Error("offline");
    }, store);
    delivery.enqueue(observation);
    delivery.enqueue(observation);
    expect(delivery.pending()).toHaveLength(1);
    expect(persisted.at(-1)).toHaveLength(1);
    fail = false;
    expect(await delivery.flush()).toEqual({ delivered: 1, remaining: 0 });
  });

  it("rejects observations from another tenant or component", () => {
    const delivery = new ResilientObservationDelivery(async () => undefined, { read: () => [], write: () => undefined });
    const runtime = new DeviceIntegrationRuntime(delivery);
    runtime.registerDevice(device);
    expect(() => runtime.acceptObservation({ ...observation, tenantId: "other-tenant" })).toThrow(/tenant or component/);
  });
});
