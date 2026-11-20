import type { DeviceRegistration, HardwareAdapter } from "./types";

/**
 * In-memory adapter registry only. It does not pair devices, persist secrets,
 * or initiate connections until an explicit caller selects a verified adapter.
 */
export class HardwareAdapterRegistry {
  private readonly adapters = new Map<string, HardwareAdapter>();

  register(adapter: HardwareAdapter): void {
    if (!adapter.adapterId.trim()) throw new Error("Adapter ID is required.");
    if (this.adapters.has(adapter.adapterId)) {
      throw new Error(`Adapter already registered: ${adapter.adapterId}`);
    }
    this.adapters.set(adapter.adapterId, adapter);
  }

  unregister(adapterId: string): boolean {
    return this.adapters.delete(adapterId);
  }

  findFor(device: DeviceRegistration): HardwareAdapter | null {
    for (const adapter of this.adapters.values()) {
      if (adapter.protocol === device.protocol && adapter.components.includes(device.component) && adapter.supports(device)) {
        return adapter;
      }
    }
    return null;
  }

  list(): ReadonlyArray<Pick<HardwareAdapter, "adapterId" | "protocol" | "components">> {
    return Array.from(this.adapters.values()).map(({ adapterId, protocol, components }) => ({
      adapterId,
      protocol,
      components,
    }));
  }
}
