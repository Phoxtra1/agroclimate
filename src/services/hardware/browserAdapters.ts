import type {
  AdapterConnection, DeviceObservation, DeviceRegistration, HardwareAdapter,
  HardwareComponent, DeviceProtocol, ObservationMetric,
} from "./types";
import { TelemetryGateway } from "@/services/aih/telemetryGateway";
import type { AircraftType, FlightMode } from "@/services/aih/types";

export type ObservationSink = (observation: DeviceObservation) => void | Promise<void>;

export interface AdapterContext {
  onObservation: ObservationSink;
  now?: () => Date;
}

/** Maps component-level capabilities to the measurements they can actually deliver. */
export function hardwareCapabilitySupportsMetric(capability: string, metric: ObservationMetric): boolean {
  const aliases: Record<string, readonly ObservationMetric[]> = {
    "weight-measurement": ["weight"],
    wind: ["wind_speed", "wind_direction"],
    "vehicle-location": ["latitude", "longitude"],
    location: ["latitude", "longitude"],
    "aircraft-telemetry": ["latitude", "longitude", "aircraft_altitude", "aircraft_battery"],
  };
  const direct = capability.replace(/-/g, "_") as ObservationMetric;
  return aliases[capability]?.includes(metric) ?? direct === metric;
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

const BLE_UUID = (short: string) => `0000${short.toLowerCase()}-0000-1000-8000-00805f9b34fb`;

/**
 * Bluetooth SIG standard profiles supported without vendor-specific decoding:
 * Environmental Sensing temperature/humidity and Weight Scale measurement.
 * Custom soil/weather probes still require their documented characteristic map.
 */
export const STANDARD_BLE_SENSOR_MAPPINGS: readonly BleCharacteristicMapping[] = [
  {
    serviceUuid: BLE_UUID("181a"),
    characteristicUuid: BLE_UUID("2a6e"),
    metric: "temperature",
    unit: "°C",
    decode: (value) => value.byteLength >= 2 ? value.getInt16(0, true) / 100 : null,
  },
  {
    serviceUuid: BLE_UUID("181a"),
    characteristicUuid: BLE_UUID("2a6f"),
    metric: "relative_humidity",
    unit: "%RH",
    decode: (value) => value.byteLength >= 2 ? value.getUint16(0, true) / 100 : null,
  },
  {
    serviceUuid: BLE_UUID("181d"),
    characteristicUuid: BLE_UUID("2a9d"),
    metric: "weight",
    unit: "kg",
    decode: (value) => {
      if (value.byteLength < 3) return null;
      const flags = value.getUint8(0);
      const raw = value.getUint16(1, true) / 100;
      // Weight Scale Measurement flag bit 0 selects pounds instead of kilograms.
      return flags & 0x01 ? raw * 0.45359237 : raw;
    },
  },
];

export class WebBluetoothSensorAdapter implements HardwareAdapter {
  readonly adapterId = "web-bluetooth-gatt-configurable-v1";
  readonly protocol = "ble-gatt" as const;
  readonly components: readonly HardwareComponent[] = [
    "agroforecast", "agrorisk", "agro-inventory", "market-link",
  ];
  private sessions = new Map<string, { device: BluetoothDeviceLike; subscriptions: Array<{ characteristic: BluetoothCharacteristicLike; listener: (event: any) => void }> }>();

  constructor(
    private readonly context: AdapterContext,
    private readonly mappings: readonly BleCharacteristicMapping[],
    private readonly bluetooth: BluetoothNavigatorLike = typeof navigator !== "undefined" ? navigator as unknown as BluetoothNavigatorLike : {},
  ) {}

  supports(device: DeviceRegistration): boolean {
    return device.protocol === this.protocol && this.components.includes(device.component) &&
      this.mappings.some((mapping) => device.capabilities.some((capability) => hardwareCapabilitySupportsMetric(capability, mapping.metric)));
  }

  async connect(device: DeviceRegistration): Promise<AdapterConnection> {
    if (!this.bluetooth.bluetooth) return { connected: false, detail: "Web Bluetooth is not available in this browser or context." };
    if (this.sessions.has(device.deviceId)) return { connected: true, detail: "BLE session is already active." };
    const mappings = this.mappings.filter((item) =>
      device.capabilities.some((capability) => hardwareCapabilitySupportsMetric(capability, item.metric)));
    if (!mappings.length) return { connected: false, detail: "No manufacturer-validated characteristic mapping is configured for this device." };
    const services = [...new Set(mappings.map((item) => item.serviceUuid))];
    const selected = await this.bluetooth.bluetooth.requestDevice({ filters: [{ services }] });
    if (!selected.gatt) return { connected: false, detail: "Selected BLE device does not expose GATT." };
    const server = await selected.gatt.connect();
    const subscriptions: Array<{ characteristic: BluetoothCharacteristicLike; listener: (event: any) => void }> = [];
    for (const mapping of mappings) {
      try {
        const service = await server.getPrimaryService(mapping.serviceUuid);
        const characteristic = await service.getCharacteristic(mapping.characteristicUuid);
        const listener = (event: any) => {
          const view = event?.target?.value as DataView | undefined;
          if (!view) return;
          let value: number | null = null;
          try { value = mapping.decode(view); } catch { return; }
          if (value === null || !Number.isFinite(value)) return;
          void this.context.onObservation(observation(device, mapping.metric, value, mapping.unit, this.protocol, this.context.now?.() ?? new Date()));
        };
        characteristic.addEventListener("characteristicvaluechanged", listener);
        await characteristic.startNotifications();
        subscriptions.push({ characteristic, listener });
      } catch {
        // A standard profile may expose only a subset of mapped services.
        // Skip unsupported characteristics and retain any successful subscriptions.
      }
    }
    if (!subscriptions.length) {
      selected.gatt.disconnect();
      return { connected: false, detail: "The selected BLE device did not expose any configured measurement characteristics." };
    }
    this.sessions.set(device.deviceId, { device: selected, subscriptions });
    return { connected: true, connectedAt: new Date().toISOString(), detail: `BLE GATT notifications active for ${subscriptions.length} configured characteristics.` };
  }

  async disconnect(deviceId: string): Promise<void> {
    const session = this.sessions.get(deviceId);
    if (!session) return;
    for (const item of session.subscriptions) {
      item.characteristic.removeEventListener("characteristicvaluechanged", item.listener);
      try { await item.characteristic.stopNotifications(); } catch { /* disconnect cleanup */ }
    }
    session.device.gatt?.disconnect();
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
  components?: readonly HardwareComponent[];
  adapterId?: string;
}

/** Strict NMEA 0183 RMC/GGA decoder for dedicated vehicle GPS trackers. */
export function decodeNmea0183Line(line: string): Array<{ metric: ObservationMetric; value: number; unit: string }> {
  const sentence = line.trim();
  const star = sentence.lastIndexOf("*");
  if (!sentence.startsWith("$") || star < 2 || star + 3 !== sentence.length) return [];
  const expected = Number.parseInt(sentence.slice(star + 1), 16);
  if (!Number.isInteger(expected) || expected < 0 || expected > 255) return [];
  let checksum = 0;
  for (let index = 1; index < star; index++) checksum ^= sentence.charCodeAt(index);
  if (checksum !== expected) return [];

  const fields = sentence.slice(1, star).split(",");
  const messageType = fields[0]?.slice(-3);
  const parseCoordinate = (raw: string | undefined, hemisphere: string | undefined, max: number): number | null => {
    if (!raw || !hemisphere) return null;
    const encoded = Number(raw);
    if (!Number.isFinite(encoded) || encoded < 0) return null;
    const degrees = Math.floor(encoded / 100);
    const minutes = encoded - degrees * 100;
    if (minutes < 0 || minutes >= 60 || degrees > max || (degrees === max && minutes > 0)) return null;
    const sign = hemisphere === "S" || hemisphere === "W" ? -1 : hemisphere === "N" || hemisphere === "E" ? 1 : 0;
    if (!sign) return null;
    return sign * (degrees + minutes / 60);
  };
  let latitude: number | null = null;
  let longitude: number | null = null;
  let speedKnots: number | null = null;
  if (messageType === "RMC" && fields[2] === "A") {
    latitude = parseCoordinate(fields[3], fields[4], 90);
    longitude = parseCoordinate(fields[5], fields[6], 180);
    const speed = Number(fields[7]);
    if (fields[7] && Number.isFinite(speed) && speed >= 0) speedKnots = speed;
  } else if (messageType === "GGA" && Number(fields[6]) > 0) {
    latitude = parseCoordinate(fields[2], fields[3], 90);
    longitude = parseCoordinate(fields[4], fields[5], 180);
  } else {
    return [];
  }
  if (latitude === null || longitude === null) return [];
  const result: Array<{ metric: ObservationMetric; value: number; unit: string }> = [
    { metric: "latitude", value: latitude, unit: "°" },
    { metric: "longitude", value: longitude, unit: "°" },
  ];
  if (speedKnots !== null) result.push({ metric: "vehicle_speed", value: speedKnots, unit: "kn" });
  return result;
}

export class WebSerialSensorAdapter implements HardwareAdapter {
  readonly adapterId: string;
  readonly protocol = "usb-serial" as const;
  readonly components: readonly HardwareComponent[];

  private sessions = new Map<string, { port: SerialPortLike; reader?: ReadableStreamDefaultReader<Uint8Array>; closed: boolean }>();

  constructor(
    private readonly context: AdapterContext,
    private readonly options: SerialAdapterOptions,
    private readonly serial: SerialNavigatorLike = typeof navigator !== "undefined" ? navigator as unknown as SerialNavigatorLike : {},
  ) {
    this.adapterId = options.adapterId ?? "web-serial-configurable-v1";
    this.components = options.components ?? ["agro-inventory", "agroforecast", "agrorisk"];
  }

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
    } finally {
      if (!session.closed && this.sessions.get(device.deviceId) === session) {
        session.closed = true;
        try { session.reader?.releaseLock(); } catch { /* stream already released */ }
        try { await session.port.close(); } catch { /* device may already be detached */ }
        this.sessions.delete(device.deviceId);
      }
    }
  }

  async disconnect(deviceId: string): Promise<void> {
    const session = this.sessions.get(deviceId);
    if (!session) return;
    session.closed = true;
    try { await session.reader?.cancel(); } catch { /* reader may already be closed */ }
    try { session.reader?.releaseLock(); } catch { /* stream already released */ }
    try { await session.port.close(); } finally { this.sessions.delete(deviceId); }
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
    if (this.sessions.has(device.deviceId)) return { connected: true, detail: "Scale session is already active." };
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


export interface PostHarvestStationReading {
  temperatureC: number;
  humidityPct: number;
  observedAt: string;
  idempotencyKey: string;
  sequenceNo?: number;
  firmware?: string;
  sensorModel?: string;
}
export type PostHarvestReadingSink = (device: DeviceRegistration, reading: PostHarvestStationReading) => Promise<void>;

/** Dedicated BLE driver for the existing Post-Harvest station gateway (not the shared telemetry table). */
export class WebBluetoothPostHarvestAdapter implements HardwareAdapter {
  readonly adapterId = "post-harvest-ble-station-v1";
  readonly protocol = "ble-gatt" as const;
  readonly components: readonly HardwareComponent[] = ["post-harvest"];
  private sessions = new Map<string, { device: BluetoothDeviceLike; characteristic: BluetoothCharacteristicLike; listener: (event: any) => void }>();
  private pending = new Map<string, PostHarvestStationReading[]>();

  constructor(
    private readonly serviceUuid: string,
    private readonly characteristicUuid: string,
    private readonly decodeReading: (value: DataView) => PostHarvestStationReading | null,
    private readonly sink: PostHarvestReadingSink,
    private readonly bluetooth: BluetoothNavigatorLike = typeof navigator !== "undefined" ? navigator as unknown as BluetoothNavigatorLike : {},
  ) {}

  supports(device: DeviceRegistration): boolean {
    return device.component === "post-harvest" && device.protocol === this.protocol &&
      device.capabilities.includes("temperature") && device.capabilities.includes("relative-humidity");
  }

  async connect(device: DeviceRegistration): Promise<AdapterConnection> {
    if (!this.bluetooth.bluetooth) return { connected: false, detail: "Web Bluetooth is unavailable for the Post-Harvest station." };
    if (this.sessions.has(device.deviceId)) return { connected: true, detail: "Post-Harvest BLE station is already active." };
    const selected = await this.bluetooth.bluetooth.requestDevice({ filters: [{ services: [this.serviceUuid] }] });
    if (!selected.gatt) return { connected: false, detail: "Selected station does not expose BLE GATT." };
    const server = await selected.gatt.connect();
    this.pending.set(device.deviceId, this.readPending(device.deviceId));
    const service = await server.getPrimaryService(this.serviceUuid);
    const characteristic = await service.getCharacteristic(this.characteristicUuid);
    const listener = (event: any) => {
      const view = event?.target?.value as DataView | undefined;
      if (!view) return;
      let reading: PostHarvestStationReading | null = null;
      try { reading = this.decodeReading(view); } catch { return; }
      if (!reading || !Number.isFinite(reading.temperatureC) || !Number.isFinite(reading.humidityPct) ||
          reading.temperatureC < -40 || reading.temperatureC > 85 || reading.humidityPct < 0 || reading.humidityPct > 100 ||
          !reading.idempotencyKey.trim() || !Number.isFinite(Date.parse(reading.observedAt))) return;
      const queue = this.pending.get(device.deviceId) ?? this.readPending(device.deviceId);
      if (!queue.some((item) => item.idempotencyKey === reading.idempotencyKey)) {
        if (queue.length >= 5000) { console.error("Post-Harvest offline queue is full; pending readings were retained."); return; }
        queue.push(reading);
      }
      this.pending.set(device.deviceId, queue);
      this.persistPending(device.deviceId);
      void this.flushPending(device);
    };
    characteristic.addEventListener("characteristicvaluechanged", listener);
    await characteristic.startNotifications();
    this.sessions.set(device.deviceId, { device: selected, characteristic, listener });
    void this.flushPending(device);
    return { connected: true, connectedAt: new Date().toISOString(), detail: "Dedicated Post-Harvest BLE station stream is active." };
  }

  private readPending(deviceId: string): PostHarvestStationReading[] {
    if (typeof localStorage === "undefined") return [];
    try {
      const parsed = JSON.parse(localStorage.getItem(`agroclimate:post-harvest-queue:${deviceId}`) ?? "[]");
      return Array.isArray(parsed) ? parsed as PostHarvestStationReading[] : [];
    } catch { return []; }
  }

  private persistPending(deviceId: string): void {
    if (typeof localStorage === "undefined") return;
    try { localStorage.setItem(`agroclimate:post-harvest-queue:${deviceId}`, JSON.stringify(this.pending.get(deviceId) ?? [])); }
    catch { /* in-memory delivery remains active for this session */ }
  }

  private async flushPending(device: DeviceRegistration): Promise<void> {
    const queue = this.pending.get(device.deviceId) ?? [];
    while (queue.length) {
      try { await this.sink(device, queue[0]); }
      catch { break; }
      queue.shift();
      this.pending.set(device.deviceId, queue);
      this.persistPending(device.deviceId);
    }
  }

  async disconnect(deviceId: string): Promise<void> {
    const session = this.sessions.get(deviceId);
    if (!session) return;
    session.characteristic.removeEventListener("characteristicvaluechanged", session.listener);
    try { await session.characteristic.stopNotifications(); } finally { session.device.gatt?.disconnect(); }
    this.sessions.delete(deviceId);
  }
}

type MavlinkSerialPort = {
  open(options: { baudRate: number }): Promise<void>;
  close(): Promise<void>;
  readable?: ReadableStream<Uint8Array> | null;
};
type MavlinkSerialNavigator = { serial?: { requestPort(): Promise<MavlinkSerialPort> } };
type MavlinkSession = { port: MavlinkSerialPort; reader: ReadableStreamDefaultReader<Uint8Array>; closed: boolean };

const MAVLINK_CRC_EXTRA: Record<number, number> = {
  0: 50, 1: 124, 24: 24, 30: 39, 33: 104, 74: 20,
};
function mavCrcAccumulate(byte: number, crc: number): number {
  let tmp = (byte ^ (crc & 0xff)) & 0xff;
  tmp = (tmp ^ ((tmp << 4) & 0xff)) & 0xff;
  return ((crc >> 8) ^ (tmp << 8) ^ (tmp << 3) ^ (tmp >> 4)) & 0xffff;
}
function readMavlinkFrames(input: Uint8Array, buffer: number[]): Array<{ messageId: number; payload: DataView }> {
  buffer.push(...input);
  const frames: Array<{ messageId: number; payload: DataView }> = [];
  while (buffer.length) {
    const magicIndex = buffer.findIndex((value) => value === 0xfe || value === 0xfd);
    if (magicIndex < 0) { buffer.length = 0; break; }
    if (magicIndex > 0) buffer.splice(0, magicIndex);
    if (buffer.length < 2) break;
    const v2 = buffer[0] === 0xfd;
    const payloadLength = buffer[1];
    if (v2 && buffer.length < 3) break;
    const incompat = v2 ? buffer[2] : 0;
    const headerLength = v2 ? 10 : 6;
    const signatureLength = v2 && (incompat & 1) ? 13 : 0;
    const totalLength = headerLength + payloadLength + 2 + signatureLength;
    if (buffer.length < totalLength) break;
    const messageId = v2
      ? buffer[7] | (buffer[8] << 8) | (buffer[9] << 16)
      : buffer[5];
    const crcExtra = MAVLINK_CRC_EXTRA[messageId];
    if (crcExtra !== undefined) {
      let crc = 0xffff;
      for (let i = 1; i < headerLength + payloadLength; i++) crc = mavCrcAccumulate(buffer[i], crc);
      crc = mavCrcAccumulate(crcExtra, crc);
      const checksumOffset = headerLength + payloadLength;
      const received = buffer[checksumOffset] | (buffer[checksumOffset + 1] << 8);
      if (crc === received) {
        const payload = Uint8Array.from(buffer.slice(headerLength, checksumOffset));
        frames.push({ messageId, payload: new DataView(payload.buffer) });
      }
    }
    buffer.splice(0, totalLength);
  }
  return frames;
}

export function decodeMavlinkGpsRawInt(payload: DataView): { fixType: number; latitude: number; longitude: number } | null {
  if (payload.byteLength < 30) return null;
  const fixType = payload.getUint8(8);
  if (fixType < 2) return null;
  const latitude = payload.getInt32(9, true) / 1e7;
  const longitude = payload.getInt32(13, true) / 1e7;
  if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90 ||
      !Number.isFinite(longitude) || longitude < -180 || longitude > 180) return null;
  return { fixType, latitude, longitude };
}

export class WebSerialMavlinkAdapter implements HardwareAdapter {
  readonly adapterId = "mavlink-v1-v2-serial";
  readonly protocol = "mavlink" as const;
  readonly components: readonly HardwareComponent[] = ["aerial-console"];
  private sessions = new Map<string, MavlinkSession>();

  constructor(
    private readonly context: AdapterContext,
    private readonly baudRate = 57600,
    private readonly aircraftType: AircraftType = "drone",
    private readonly serial: MavlinkSerialNavigator = typeof navigator !== "undefined" ? navigator as unknown as MavlinkSerialNavigator : {},
  ) {}

  supports(device: DeviceRegistration): boolean {
    return device.protocol === this.protocol && device.component === "aerial-console" &&
      device.capabilities.includes("aircraft-telemetry");
  }

  async connect(device: DeviceRegistration): Promise<AdapterConnection> {
    if (!this.serial.serial) return { connected: false, detail: "Web Serial is not available for MAVLink telemetry." };
    if (this.sessions.has(device.deviceId)) return { connected: true, detail: "MAVLink serial stream is already active." };
    const port = await this.serial.serial.requestPort();
    await port.open({ baudRate: this.baudRate });
    if (!port.readable) { await port.close(); return { connected: false, detail: "MAVLink serial port has no readable stream." }; }
    const session: MavlinkSession = { port, reader: port.readable.getReader(), closed: false };
    this.sessions.set(device.deviceId, session);
    TelemetryGateway.updateTelemetry(device.deviceId, { aircraftId: device.deviceId, aircraftType: this.aircraftType, connectionStatus: "connected", flightMode: "manual" as FlightMode });
    void this.readTelemetry(device, session);
    return { connected: true, connectedAt: new Date().toISOString(), detail: "MAVLink v1/v2 read-only telemetry stream opened." };
  }

  private async readTelemetry(device: DeviceRegistration, session: MavlinkSession): Promise<void> {
    const buffer: number[] = [];
    try {
      while (!session.closed) {
        const { value, done } = await session.reader.read();
        if (done) break;
        for (const frame of readMavlinkFrames(value, buffer)) {
          const now = this.context.now?.() ?? new Date();
          const emit = (metric: ObservationMetric, value: number, unit: string) => {
            if (Number.isFinite(value)) void this.context.onObservation(observation(device, metric, value, unit, this.protocol, now));
          };
          const p = frame.payload;
          if (frame.messageId === 24) {
            const gps = decodeMavlinkGpsRawInt(p);
            if (gps) {
              emit("latitude", gps.latitude, "°");
              emit("longitude", gps.longitude, "°");
              TelemetryGateway.updateTelemetry(device.deviceId, {
                latitude: gps.latitude, longitude: gps.longitude,
                gpsStatus: gps.fixType >= 4 ? "rtk" : gps.fixType === 3 ? "3d" : "2d",
                connectionStatus: "connected",
              });
            }
          } else if (frame.messageId === 33 && p.byteLength >= 28) {
            const latitude = p.getInt32(4, true) / 1e7;
            const longitude = p.getInt32(8, true) / 1e7;
            const altitude = p.getInt32(12, true) / 1000;
            const vx = p.getInt16(20, true) / 100;
            const vy = p.getInt16(22, true) / 100;
            const headingRaw = p.getUint16(26, true);
            emit("latitude", latitude, "°");
            emit("longitude", longitude, "°");
            emit("aircraft_altitude", altitude, "m");
            TelemetryGateway.updateTelemetry(device.deviceId, { latitude, longitude, altitude, speed: Math.hypot(vx, vy), heading: headingRaw === 65535 ? 0 : headingRaw / 100, gpsStatus: "3d", connectionStatus: "connected" });
          } else if (frame.messageId === 74 && p.byteLength >= 20) {
            const speed = p.getFloat32(4, true);
            const altitude = p.getFloat32(8, true);
            const heading = p.getInt16(16, true);
            emit("aircraft_altitude", altitude, "m");
            TelemetryGateway.updateTelemetry(device.deviceId, { speed, altitude, heading, connectionStatus: "connected" });
          } else if (frame.messageId === 30 && p.byteLength >= 28) {
            TelemetryGateway.updateTelemetry(device.deviceId, { roll: p.getFloat32(4, true), pitch: p.getFloat32(8, true), yaw: p.getFloat32(12, true), connectionStatus: "connected" });
          } else if (frame.messageId === 1 && p.byteLength >= 31) {
            const battery = p.getInt8(30);
            if (battery >= 0 && battery <= 100) {
              emit("aircraft_battery", battery, "%");
              TelemetryGateway.updateTelemetry(device.deviceId, { batteryFuelStatus: battery, connectionStatus: "connected" });
            }
          }
        }
      }
    } catch {
      // Link loss ends the reader; the runtime exposes disconnect/reconnect to the host.
    } finally {
      if (!session.closed && this.sessions.get(device.deviceId) === session) {
        session.closed = true;
        try { session.reader.releaseLock(); } catch { /* stream already released */ }
        try { await session.port.close(); } catch { /* serial device may already be detached */ }
        this.sessions.delete(device.deviceId);
        TelemetryGateway.updateTelemetry(device.deviceId, { connectionStatus: "disconnected" });
      }
    }
  }

  async disconnect(deviceId: string): Promise<void> {
    const session = this.sessions.get(deviceId);
    if (!session) return;
    session.closed = true;
    try { await session.reader.cancel(); } catch { /* serial link may already be closed */ }
    try { session.reader.releaseLock(); } catch { /* stream already released */ }
    try { await session.port.close(); } finally {
      this.sessions.delete(deviceId);
      TelemetryGateway.updateTelemetry(deviceId, { connectionStatus: "disconnected" });
    }
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
