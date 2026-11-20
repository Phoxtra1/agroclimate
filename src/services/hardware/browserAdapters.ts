import type {
  AdapterConnection, DeviceObservation, DeviceRegistration, HardwareAdapter,
  HardwareComponent, DeviceProtocol, ObservationMetric,
} from "./types";

export type ObservationSink = (observation: DeviceObservation) => void | Promise<void>;

export interface AdapterContext {
  onObservation: ObservationSink;
  now?: () => Date;
}

function observation(
  device: DeviceRegistration,
  metric: ObservationMetric,
  value: number,
  unit: string,
  sourceProtocol: DeviceProtocol,
  now: Date,
): DeviceObservation {
  const timestamp = now.toISOString();
  return {
    eventId: globalThis.crypto?.randomUUID?.() ?? `${device.deviceId}-${metric}-${now.getTime()}`,
    deviceId: device.deviceId,
    tenantId: device.tenantId,
    component: device.component,
    farmId: device.farmId,
    siteId: device.siteId,
    metric,
    value,
    unit,
    measuredAt: timestamp,
    receivedAt: timestamp,
    quality: "valid",
    sourceProtocol,
    sourceModel: device.model,
    firmwareVersion: device.firmwareVersion,
  };
}

type GeolocationLike = {
  watchPosition: (success: (position: any) => void, error: (error: any) => void, options?: PositionOptions) => number;
  clearWatch: (watchId: number) => void;
};

export class BrowserGeolocationAdapter implements HardwareAdapter {
  readonly adapterId = "browser-geolocation-v1";
  readonly protocol = "browser-geolocation" as const;
  readonly components: readonly HardwareComponent[] = ["farm-handler", "agtrans"];
  private watches = new Map<string, number>();

  constructor(private readonly context: AdapterContext, private readonly geo: GeolocationLike | undefined =
    typeof navigator !== "undefined" ? navigator.geolocation : undefined) {}

  supports(device: DeviceRegistration): boolean {
    return this.components.includes(device.component) &&
      (device.protocol === this.protocol) &&
      (device.capabilities.includes("location") || device.capabilities.includes("vehicle-location"));
  }

  async connect(device: DeviceRegistration): Promise<AdapterConnection> {
    if (!this.geo) return { connected: false, detail: "Browser geolocation is unavailable." };
    if (this.watches.has(device.deviceId)) return { connected: true, detail: "Location watch is already active." };
    const watchId = this.geo.watchPosition(
      (position) => {
        const now = this.context.now?.() ?? new Date();
        const latitude = Number(position.coords.latitude);
        const longitude = Number(position.coords.longitude);
        if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return;
        void this.context.onObservation(observation(device, "latitude", latitude, "°", this.protocol, now));
        void this.context.onObservation(observation(device, "longitude", longitude, "°", this.protocol, now));
        if (Number.isFinite(position.coords.speed) && position.coords.speed >= 0 &&
            device.component === "agtrans" && device.capabilities.includes("vehicle-speed")) {
          void this.context.onObservation(observation(device, "vehicle_speed", position.coords.speed, "m/s", this.protocol, now));
        }
      },
      () => undefined,
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 },
    );
    this.watches.set(device.deviceId, watchId);
    return { connected: true, connectedAt: new Date().toISOString(), detail: "Browser location watch started." };
  }

  async disconnect(deviceId: string): Promise<void> {
    const watchId = this.watches.get(deviceId);
    if (watchId !== undefined) this.geo?.clearWatch(watchId);
    this.watches.delete(deviceId);
  }
}

type BluetoothCharacteristicLike = {
  startNotifications(): Promise<BluetoothCharacteristicLike>;
  stopNotifications(): Promise<BluetoothCharacteristicLike>;
  addEventListener(type: "characteristicvaluechanged", listener: (event: any) => void): void;
  removeEventListener(type: "characteristicvaluechanged", listener: (event: any) => void): void;
  value?: DataView | null;
};
type BluetoothServerLike = { getPrimaryService(uuid: string): Promise<{ getCharacteristic(uuid: string): Promise<BluetoothCharacteristicLike> }> };
type BluetoothDeviceLike = {
  id: string;
  gatt?: { connect(): Promise<BluetoothServerLike>; disconnect(): void };
};
type BluetoothNavigatorLike = { bluetooth?: { requestDevice(options: unknown): Promise<BluetoothDeviceLike> } };

export interface BleCharacteristicMapping {
  serviceUuid: string;
  characteristicUuid: string;
  metric: ObservationMetric;
  unit: string;
  /** Decode the characteristic's DataView using the manufacturer's documented format. */
  decode: (value: DataView) => number | null;
}

export class WebBluetoothSensorAdapter implements HardwareAdapter {
  readonly adapterId = "web-bluetooth-gatt-configurable-v1";
  readonly protocol = "ble-gatt" as const;
  readonly components: readonly HardwareComponent[] = [
    "post-harvest", "agroforecast", "agrorisk", "agro-inventory", "market-link",
  ];
  private sessions = new Map<string, { device: BluetoothDeviceLike; characteristic: BluetoothCharacteristicLike; listener: (event: any) => void }>();

  constructor(
    private readonly context: AdapterContext,
    private readonly mappings: readonly BleCharacteristicMapping[],
    private readonly bluetooth: BluetoothNavigatorLike = typeof navigator !== "undefined" ? navigator as unknown as BluetoothNavigatorLike : {},
  ) {}

  supports(device: DeviceRegistration): boolean {
    return device.protocol === this.protocol && this.components.includes(device.component) &&
      this.mappings.some((mapping) => device.capabilities.some((capability) => capability.replace(/-/g, "_") === mapping.metric));
  }

  async connect(device: DeviceRegistration): Promise<AdapterConnection> {
    if (!this.bluetooth.bluetooth) return { connected: false, detail: "Web Bluetooth is not available in this browser or context." };
    if (this.sessions.has(device.deviceId)) return { connected: true, detail: "BLE session is already active." };
    const mapping = this.mappings.find((item) =>
      device.capabilities.some((capability) => capability.replace(/-/g, "_") === item.metric));
    if (!mapping) return { connected: false, detail: "No manufacturer-validated characteristic mapping is configured for this device." };
    const selected = await this.bluetooth.bluetooth.requestDevice({ filters: [{ services: [mapping.serviceUuid] }] });
    if (!selected.gatt) return { connected: false, detail: "Selected BLE device does not expose GATT." };
    const server = await selected.gatt.connect();
    const service = await server.getPrimaryService(mapping.serviceUuid);
    const characteristic = await service.getCharacteristic(mapping.characteristicUuid);
    const listener = (event: any) => {
      const view = event?.target?.value as DataView | undefined;
      if (!view) return;
      const value = mapping.decode(view);
      if (value === null || !Number.isFinite(value)) return;
      void this.context.onObservation(observation(device, mapping.metric, value, mapping.unit, this.protocol, this.context.now?.() ?? new Date()));
    };
    characteristic.addEventListener("characteristicvaluechanged", listener);
    await characteristic.startNotifications();
    this.sessions.set(device.deviceId, { device: selected, characteristic, listener });
    return { connected: true, connectedAt: new Date().toISOString(), detail: "BLE GATT notifications active; values use the configured manufacturer decoder." };
  }

  async disconnect(deviceId: string): Promise<void> {
    const session = this.sessions.get(deviceId);
    if (!session) return;
    session.characteristic.removeEventListener("characteristicvaluechanged", session.listener);
    try { await session.characteristic.stopNotifications(); } finally { session.device.gatt?.disconnect(); }
    this.sessions.delete(deviceId);
  }
}

type SerialPortLike = {
  open(options: { baudRate: number }): Promise<void>;
  close(): Promise<void>;
  readable?: ReadableStream<Uint8Array> | null;
};
type SerialNavigatorLike = { serial?: { requestPort(): Promise<SerialPortLike> } };

export interface SerialAdapterOptions {
  baudRate: number;
  /** Parse one newline-delimited device message into zero or more metric values. */
  decodeLine: (line: string) => Array<{ metric: ObservationMetric; value: number; unit: string }>;
}

export class WebSerialSensorAdapter implements HardwareAdapter {
  readonly adapterId = "web-serial-configurable-v1";
  readonly protocol = "usb-serial" as const;
  readonly components: readonly HardwareComponent[] = ["agro-inventory", "agroforecast", "agrorisk"];
  private sessions = new Map<string, { port: SerialPortLike; reader?: ReadableStreamDefaultReader<Uint8Array>; closed: boolean }>();

  constructor(
    private readonly context: AdapterContext,
    private readonly options: SerialAdapterOptions,
    private readonly serial: SerialNavigatorLike = typeof navigator !== "undefined" ? navigator as unknown as SerialNavigatorLike : {},
  ) {}

  supports(device: DeviceRegistration): boolean {
    return device.protocol === this.protocol && this.components.includes(device.component);
  }

  async connect(device: DeviceRegistration): Promise<AdapterConnection> {
    if (!this.serial.serial) return { connected: false, detail: "Web Serial is not available in this browser." };
    if (this.sessions.has(device.deviceId)) return { connected: true, detail: "Serial session is already active." };
    const port = await this.serial.serial.requestPort();
    await port.open({ baudRate: this.options.baudRate });
    const session = { port, closed: false, reader: undefined as ReadableStreamDefaultReader<Uint8Array> | undefined };
    this.sessions.set(device.deviceId, session);
    if (port.readable) {
      session.reader = port.readable.getReader();
      void this.readLines(device, session);
    }
    return { connected: true, connectedAt: new Date().toISOString(), detail: "Serial port opened; configured line decoder is active." };
  }

  private async readLines(device: DeviceRegistration, session: { port: SerialPortLike; reader?: ReadableStreamDefaultReader<Uint8Array>; closed: boolean }) {
    const decoder = new TextDecoder();
    let pending = "";
    try {
      while (!session.closed && session.reader) {
        const { value, done } = await session.reader.read();
        if (done) break;
        pending += decoder.decode(value, { stream: true });
        const lines = pending.split(/\r?\n/);
        pending = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.trim()) continue;
          let decoded: Array<{ metric: ObservationMetric; value: number; unit: string }>;
          try { decoded = this.options.decodeLine(line); } catch { continue; }
          for (const item of decoded) {
            if (!Number.isFinite(item.value)) continue;
            void this.context.onObservation(observation(device, item.metric, item.value, item.unit, this.protocol, this.context.now?.() ?? new Date()));
          }
        }
      }
    } catch {
      // A disconnect or device-side read error ends this session; caller can reconnect.
    }
  }

  async disconnect(deviceId: string): Promise<void> {
    const session = this.sessions.get(deviceId);
    if (!session) return;
    session.closed = true;
    try { await session.reader?.cancel(); } catch { /* reader may already be closed */ }
    session.reader?.releaseLock();
    await session.port.close();
    this.sessions.delete(deviceId);
  }
}

type HidDeviceLike = {
  open(): Promise<void>;
  close(): Promise<void>;
  addEventListener(type: "inputreport", listener: (event: any) => void): void;
  removeEventListener(type: "inputreport", listener: (event: any) => void): void;
};
type HidNavigatorLike = { hid?: { requestDevice(options: unknown): Promise<HidDeviceLike[]> } };

export class WebHidScaleAdapter implements HardwareAdapter {
  readonly adapterId = "webhid-scale-configurable-v1";
  readonly protocol = "usb-hid" as const;
  readonly components: readonly HardwareComponent[] = ["agro-inventory", "market-link"];
  private sessions = new Map<string, { device: HidDeviceLike; listener: (event: any) => void }>();

  constructor(
    private readonly context: AdapterContext,
    private readonly decodeReport: (data: DataView) => number | null,
    private readonly unit = "kg",
    private readonly hid: HidNavigatorLike = typeof navigator !== "undefined" ? navigator as unknown as HidNavigatorLike : {},
  ) {}

  supports(device: DeviceRegistration): boolean {
    return device.protocol === this.protocol && this.components.includes(device.component) &&
      device.capabilities.includes("weight-measurement");
  }

  async connect(device: DeviceRegistration): Promise<AdapterConnection> {
    if (!this.hid.hid) return { connected: false, detail: "WebHID is not available in this browser." };
    const [selected] = await this.hid.hid.requestDevice({ filters: [] });
    if (!selected) return { connected: false, detail: "No HID device was selected." };
    await selected.open();
    const listener = (event: any) => {
      const value = this.decodeReport(event.data as DataView);
      if (value === null || !Number.isFinite(value) || value < 0) return;
      void this.context.onObservation(observation(device, "weight", value, this.unit, this.protocol, this.context.now?.() ?? new Date()));
    };
    selected.addEventListener("inputreport", listener);
    this.sessions.set(device.deviceId, { device: selected, listener });
    return { connected: true, connectedAt: new Date().toISOString(), detail: "HID input reports active using the configured scale decoder." };
  }

  async disconnect(deviceId: string): Promise<void> {
    const session = this.sessions.get(deviceId);
    if (!session) return;
    session.device.removeEventListener("inputreport", session.listener);
    await session.device.close();
    this.sessions.delete(deviceId);
  }
}


type MediaDevicesLike = { getUserMedia(constraints?: MediaStreamConstraints): Promise<MediaStream> };

export class BrowserCameraAdapter implements HardwareAdapter {
  readonly adapterId = "browser-camera-v1";
  readonly protocol = "browser-camera" as const;
  readonly components: readonly HardwareComponent[] = ["farm-handler", "market-link"];
  private streams = new Map<string, MediaStream>();

  constructor(private readonly media: MediaDevicesLike | undefined =
    typeof navigator !== "undefined" ? navigator.mediaDevices : undefined) {}

  supports(device: DeviceRegistration): boolean {
    return device.protocol === this.protocol && this.components.includes(device.component) &&
      (device.capabilities.includes("image-capture") || device.capabilities.includes("video-capture"));
  }

  async connect(device: DeviceRegistration): Promise<AdapterConnection> {
    if (!this.media?.getUserMedia) return { connected: false, detail: "Browser camera access is unavailable." };
    if (this.streams.has(device.deviceId)) return { connected: true, detail: "Camera stream is already active." };
    const stream = await this.media.getUserMedia({
      audio: false,
      video: { facingMode: { ideal: "environment" } },
    });
    this.streams.set(device.deviceId, stream);
    return { connected: true, connectedAt: new Date().toISOString(), detail: "Camera stream opened; capture remains controlled by the component workflow." };
  }

  getStream(deviceId: string): MediaStream | null { return this.streams.get(deviceId) ?? null; }

  async disconnect(deviceId: string): Promise<void> {
    const stream = this.streams.get(deviceId);
    stream?.getTracks().forEach((track) => track.stop());
    this.streams.delete(deviceId);
  }
}

/** Keyboard-wedge scanners send decoded text as keystrokes; call this from a focused scan field. */
export class BarcodeScanBuffer {
  private buffer = "";
  private lastKeyAt = 0;

  constructor(private readonly onScan: (barcode: string) => void, private readonly terminators: readonly string[] = ["Enter", "Tab"], private readonly maxLength = 256) {}

  handleKey(key: string, now = Date.now()): void {
    if (now - this.lastKeyAt > 120) this.buffer = "";
    this.lastKeyAt = now;
    if (this.terminators.includes(key)) {
      const value = this.buffer.trim();
      if (value) this.onScan(value);
      this.buffer = "";
      return;
    }
    if (key.length === 1 && this.buffer.length < this.maxLength) this.buffer += key;
    else if (key === "Backspace") this.buffer = this.buffer.slice(0, -1);
  }

  reset(): void { this.buffer = ""; }
}
