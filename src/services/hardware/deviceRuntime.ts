import type { DeviceObservation, DeviceRegistration, HardwareAdapter } from "./types";
import { HardwareAdapterRegistry } from "./adapterRegistry";
import { validateDeviceObservation } from "./observation";
import type { ObservationSink } from "./browserAdapters";

export interface ObservationQueueStore { read(): DeviceObservation[]; write(items: DeviceObservation[]): void; }

export class LocalObservationQueueStore implements ObservationQueueStore {
  constructor(private readonly key = "agroclimate:device-observation-queue") {}
  read(): DeviceObservation[] {
    if (typeof localStorage === "undefined") return [];
    try { const parsed: unknown = JSON.parse(localStorage.getItem(this.key) ?? "[]"); return Array.isArray(parsed) ? parsed as DeviceObservation[] : []; }
    catch { return []; }
  }
  write(items: DeviceObservation[]): void {
    if (typeof localStorage === "undefined") return;
    localStorage.setItem(this.key, JSON.stringify(items));
  }
}

/** Validates, deduplicates, persists and retries delivery until the server accepts each observation. */
export class ResilientObservationDelivery {
  private queue: DeviceObservation[];
  private flushing = false;
  constructor(private readonly sink: ObservationSink, private readonly store: ObservationQueueStore = new LocalObservationQueueStore(), private readonly maxQueueSize = 5000) { this.queue = this.store.read(); }
  enqueue(item: DeviceObservation): void {
    const validation = validateDeviceObservation(item);
    if (!validation.valid) throw new Error("Invalid device observation: " + validation.issues.join("; "));
    if (this.queue.some((queued) => queued.eventId === item.eventId)) return;
    if (this.queue.length >= this.maxQueueSize) throw new Error("Offline device queue is full; no observation was discarded.");
    this.queue.push(item);
    this.persist();
  }
  async flush(): Promise<{ delivered: number; remaining: number }> {
    if (this.flushing) return { delivered: 0, remaining: this.queue.length };
    this.flushing = true;
    let delivered = 0;
    try {
      while (this.queue.length) {
        try { await this.sink(this.queue[0]); this.queue.shift(); delivered += 1; this.persist(); }
        catch { break; }
      }
    } finally { this.flushing = false; }
    return { delivered, remaining: this.queue.length };
  }
  pending(): readonly DeviceObservation[] { return this.queue.map((item) => ({ ...item })); }
  private persist(): void { this.store.write(this.queue); }
}

export class DeviceIntegrationRuntime {
  readonly registry = new HardwareAdapterRegistry();
  private registrations = new Map<string, DeviceRegistration>();
  private active = new Map<string, HardwareAdapter>();
  constructor(private readonly delivery: ResilientObservationDelivery) {}
  registerAdapter(adapter: HardwareAdapter): void { this.registry.register(adapter); }
  registerDevice(device: DeviceRegistration): void {
    if (!device.deviceId.trim() || !device.tenantId.trim() || !device.ownerUserId.trim()) throw new Error("Device ID, tenant ID and owner user ID are required.");
    const existing = this.registrations.get(device.deviceId);
    if (existing && (existing.tenantId !== device.tenantId || existing.ownerUserId !== device.ownerUserId)) throw new Error("Device ID is already assigned to another owner.");
    this.registrations.set(device.deviceId, { ...device, capabilities: [...device.capabilities] });
  }
  async connect(deviceId: string): Promise<{ connected: boolean; detail?: string }> {
    const device = this.registrations.get(deviceId);
    if (!device) throw new Error("Device is not registered in this runtime.");
    if (device.state === "revoked") throw new Error("A revoked device cannot connect.");
    const adapter = this.registry.findFor(device);
    if (!adapter) return { connected: false, detail: "No compatible adapter is registered for this device profile." };
    const result = await adapter.connect(device);
    if (result.connected) this.active.set(deviceId, adapter);
    return result;
  }
  async disconnect(deviceId: string): Promise<void> {
    const adapter = this.active.get(deviceId);
    if (!adapter) return;
    await adapter.disconnect(deviceId);
    this.active.delete(deviceId);
  }
  revoke(deviceId: string): void {
    const device = this.registrations.get(deviceId);
    if (!device) return;
    void this.disconnect(deviceId);
    this.registrations.set(deviceId, { ...device, state: "revoked" });
  }
  acceptObservation(item: DeviceObservation): void {
    const device = this.registrations.get(item.deviceId);
    if (!device || device.state === "revoked") throw new Error("Observation source is not an active registered device.");
    if (device.tenantId !== item.tenantId || device.component !== item.component) throw new Error("Observation tenant or component does not match its registered device.");
    this.delivery.enqueue(item);
    void this.delivery.flush();
  }
  pendingObservations(): readonly DeviceObservation[] { return this.delivery.pending(); }
  flushObservations(): Promise<{ delivered: number; remaining: number }> { return this.delivery.flush(); }
}