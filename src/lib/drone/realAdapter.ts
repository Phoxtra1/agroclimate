import { ConnectionAdapter, ConnectionDiagnostics, DiscoveredDrone, DroneProtocol, DroneTelemetry, FlightStatus } from "./types";

const STORAGE_KEY = "droneBridgeUrl";
interface RealAdapterOptions { protocol: DroneProtocol }

/** Accept secure WebSocket endpoints; plain ws is permitted only on loopback for local development. */
export function validateTelemetryBridgeUrl(input: string): string {
  let parsed: URL;
  try {
    parsed = new URL(input.trim());
  } catch {
    throw new Error("Enter a valid telemetry bridge URL.");
  }
  if (parsed.protocol !== "wss:" && parsed.protocol !== "ws:") {
    throw new Error("Telemetry bridge URLs must use wss://. ws:// is allowed only for localhost development.");
  }
  if (parsed.username || parsed.password) {
    throw new Error("Do not embed usernames or passwords in the telemetry bridge URL.");
  }
  const loopbackHosts = new Set(["localhost", "127.0.0.1", "[::1]"]);
  if (parsed.protocol === "ws:" && !loopbackHosts.has(parsed.hostname.toLowerCase())) {
    throw new Error("Unencrypted ws:// connections are allowed only to localhost or loopback addresses.");
  }
  return parsed.toString();
}

export function createRealAdapter({ protocol }: RealAdapterOptions): ConnectionAdapter {
  let status: FlightStatus = "disconnected";
  let telemetry: DroneTelemetry = {
    lat: undefined, lng: undefined, altitude: 0, groundSpeed: 0, verticalSpeed: 0,
    heading: 0, battery: 0, signalStrength: 0, gpsAccuracy: 0, gpsFix: "none",
    flightDuration: 0, distanceCovered: 0, cameraStatus: "off",
  };
  let diag: ConnectionDiagnostics = { transport: "none", framesReceived: 0, bytesReceived: 0 };
  const tListeners = new Set<(t: DroneTelemetry) => void>();
  const sListeners = new Set<(s: FlightStatus) => void>();
  const dListeners = new Set<(d: ConnectionDiagnostics) => void>();
  const emit = () => tListeners.forEach((cb) => cb({ ...telemetry }));
  const setStatus = (next: FlightStatus) => { status = next; sListeners.forEach((cb) => cb(next)); };
  const emitDiag = () => dListeners.forEach((cb) => cb({ ...diag }));
  const setError = (error: string | undefined) => { diag.lastError = error; emitDiag(); };

  let ws: WebSocket | null = null;
  let serialPort: any = null;
  let heartbeat: ReturnType<typeof setInterval> | null = null;
  let telemetryWaiter: { resolve: () => void; reject: (error: Error) => void; timer: ReturnType<typeof setTimeout> } | null = null;

  const waitForFirstTelemetry = () => new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => {
      telemetryWaiter = null;
      reject(new Error("Transport opened, but no valid telemetry frame was received. Device connection was not confirmed."));
    }, 12000);
    telemetryWaiter = {
      resolve: () => { clearTimeout(timer); telemetryWaiter = null; resolve(); },
      reject: (error) => { clearTimeout(timer); telemetryWaiter = null; reject(error); },
      timer,
    };
  });

  // Accept only a JSON telemetry frame containing at least one recognized,
  // finite measurement. A socket opening or a device being discoverable is not
  // treated as a telemetry handshake.
  const ingest = (raw: unknown): boolean => {
    try {
      if (typeof raw !== "string") return false;
      const payload = JSON.parse(raw);
      if (!payload || typeof payload !== "object" || Array.isArray(payload)) return false;
      const p = payload as Record<string, unknown>;
      const numericKeys = ["lat", "lng", "altitude", "alt", "groundSpeed", "speed", "verticalSpeed", "heading", "yaw", "battery", "batteryPct", "signal", "rssi", "gpsAccuracy"];
      const providedNumericKeys = numericKeys.filter((key) => p[key] !== undefined && p[key] !== null);
      // JSON telemetry measurements must be JSON numbers. Do not coerce strings,
      // booleans, or empty values into plausible zero-valued flight readings.
      if (!providedNumericKeys.length || providedNumericKeys.some((key) => {
        const value = p[key];
        return typeof value !== "number" || !Number.isFinite(value);
      })) return false;

      const lat = p.lat == null ? telemetry.lat : Number(p.lat);
      const lng = p.lng == null ? telemetry.lng : Number(p.lng);
      const batteryValue = p.battery ?? p.batteryPct;
      const signalValue = p.signal ?? p.rssi;
      const accuracyValue = p.gpsAccuracy;
      if ((lat !== undefined && (!Number.isFinite(lat) || lat < -90 || lat > 90)) ||
          (lng !== undefined && (!Number.isFinite(lng) || lng < -180 || lng > 180)) ||
          ((lat === undefined) !== (lng === undefined)) ||
          (batteryValue !== undefined && (Number(batteryValue) < 0 || Number(batteryValue) > 100)) ||
          (signalValue !== undefined && (Number(signalValue) < 0 || Number(signalValue) > 100)) ||
          (accuracyValue !== undefined && Number(accuracyValue) < 0)) return false;

      telemetry = {
        ...telemetry,
        lat, lng,
        altitude: Number(p.altitude ?? p.alt ?? telemetry.altitude),
        groundSpeed: Number(p.groundSpeed ?? p.speed ?? telemetry.groundSpeed),
        verticalSpeed: Number(p.verticalSpeed ?? telemetry.verticalSpeed),
        heading: Number(p.heading ?? p.yaw ?? telemetry.heading),
        battery: Number(p.battery ?? p.batteryPct ?? telemetry.battery),
        signalStrength: Number(p.signal ?? p.rssi ?? telemetry.signalStrength),
        gpsAccuracy: Number(p.gpsAccuracy ?? telemetry.gpsAccuracy),
        gpsFix: p.gpsFix === "2d" || p.gpsFix === "3d" ? p.gpsFix : telemetry.gpsFix,
        cameraStatus: p.cameraStatus === "ready" || p.cameraStatus === "recording" || p.cameraStatus === "off" ? p.cameraStatus : telemetry.cameraStatus,
        flightMode: typeof p.flightMode === "string" ? p.flightMode : telemetry.flightMode,
      };
      const size = new TextEncoder().encode(raw).byteLength;
      diag.lastFrameAt = Date.now();
      diag.framesReceived += 1;
      diag.bytesReceived += size;
      setStatus("connected");
      emit();
      emitDiag();
      telemetryWaiter?.resolve();
      return true;
    } catch {
      return false;
    }
  };

  const startHeartbeat = () => {
    if (heartbeat) clearInterval(heartbeat);
    heartbeat = setInterval(() => {
      if (status === "connected" && (!diag.lastFrameAt || Date.now() - diag.lastFrameAt > 8000)) {
        telemetry.signalStrength = 0;
        setStatus("disconnected");
        emit();
      }
    }, 1000);
  };

  const bridgeUrl = () => {
    const stored = localStorage.getItem(STORAGE_KEY) || "";
    return stored ? validateTelemetryBridgeUrl(stored) : "";
  };
  const requireSecureCtx = () => {
    if (!window.isSecureContext) throw new Error("Read-only device telemetry requires HTTPS. Open the published site or use localhost.");
  };

  const connectWs = async (url: string) => {
    const firstFrame = waitForFirstTelemetry();
    void firstFrame.catch(() => undefined);
    await new Promise<void>((resolve, reject) => {
      try {
        const safeUrl = validateTelemetryBridgeUrl(url);
        ws = new WebSocket(safeUrl);
        diag.transport = "websocket";
        diag.endpoint = safeUrl;
        emitDiag();
        const timer = setTimeout(() => {
          try { ws?.close(); } catch { /* ignore */ }
          reject(new Error("WebSocket bridge did not open in time."));
        }, 8000);
        ws.onopen = () => {
          clearTimeout(timer);
          diag.lastHandshakeAt = Date.now();
          setError(undefined);
          resolve();
        };
        ws.onmessage = (event) => { ingest(event.data); };
        ws.onclose = () => {
          if (status !== "disconnected") setStatus("disconnected");
          telemetryWaiter?.reject(new Error("Telemetry bridge closed before a valid frame arrived."));
        };
        ws.onerror = () => {
          clearTimeout(timer);
          setError("WebSocket bridge connection failed");
          telemetryWaiter?.reject(new Error("WebSocket bridge connection failed"));
          reject(new Error("WebSocket bridge connection failed"));
        };
      } catch (error) {
        telemetryWaiter?.reject(error instanceof Error ? error : new Error("WebSocket connection failed"));
        reject(error);
      }
    });
    await firstFrame;
  };

  return {
    id: protocol,
    label: "Read-only JSON telemetry bridge",

    async scan(): Promise<DiscoveredDrone[]> {
      requireSecureCtx();
      const url = bridgeUrl();
      if (url) {
        return [{
          id: `bridge:${url}`,
          name: "Configured JSON telemetry bridge",
          model: "Endpoint not yet verified",
          protocol,
          signal: 0,
          firmware: "Unknown",
        }];
      }

      if ((navigator as any).serial?.requestPort) {
        try {
          serialPort = await (navigator as any).serial.requestPort();
          diag.transport = "serial";
          diag.endpoint = "User-selected USB serial port";
          emitDiag();
          return [{ id: "serial-port", name: "User-selected serial telemetry port", model: "JSON-lines · unverified", protocol, signal: 0 }];
        } catch (error: any) {
          if (error?.name === "NotFoundError") return [];
          setError(error?.message);
          throw error;
        }
      }
      throw new Error("Configure a JSON telemetry WebSocket bridge or use a supported USB serial browser.");
    },

    async connect() {
      requireSecureCtx();
      setStatus("connecting");
      try {
        const url = bridgeUrl();
        if (url) {
          await connectWs(url);
        } else if (serialPort) {
          const firstFrame = waitForFirstTelemetry();
          void firstFrame.catch(() => undefined);
          await serialPort.open({ baudRate: 57600 });
          diag.transport = "serial";
          diag.lastHandshakeAt = Date.now();
          emitDiag();
          const reader = serialPort.readable.getReader();
          (async () => {
            const decoder = new TextDecoder();
            let buffer = "";
            try {
              while (true) {
                const { value, done } = await reader.read();
                if (done) break;
                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split("\n");
                buffer = lines.pop() || "";
                lines.forEach((line) => { if (line.trim()) ingest(line.trim()); });
              }
            } catch (error: any) {
              setError(error?.message || "Serial telemetry read failed");
              telemetryWaiter?.reject(new Error("Serial telemetry read failed."));
            } finally {
              try { reader.releaseLock(); } catch { /* ignore */ }
            }
          })();
          await firstFrame;
        } else {
          throw new Error("No configured JSON telemetry bridge or selected serial port. Run discovery first.");
        }
        if (status !== "connected" || diag.framesReceived < 1) {
          throw new Error("A valid telemetry frame is required before the asset is marked connected.");
        }
        startHeartbeat();
      } catch (error: any) {
        telemetryWaiter?.reject(error instanceof Error ? error : new Error("Telemetry connection failed"));
        setError(error?.message || "Telemetry connection failed");
        try { ws?.close(); } catch { /* ignore */ }
        try { await serialPort?.close?.(); } catch { /* ignore */ }
        ws = null;
        serialPort = null;
        setStatus("disconnected");
        throw error;
      }
    },

    async disconnect() {
      telemetryWaiter?.reject(new Error("Connection closed by operator."));
      try { ws?.close(); } catch { /* ignore */ }
      ws = null;
      try { await serialPort?.close?.(); } catch { /* ignore */ }
      serialPort = null;
      if (heartbeat) { clearInterval(heartbeat); heartbeat = null; }
      telemetry = {
        lat: undefined, lng: undefined, altitude: 0, groundSpeed: 0, verticalSpeed: 0,
        heading: 0, battery: 0, signalStrength: 0, gpsAccuracy: 0, gpsFix: "none",
        flightDuration: 0, distanceCovered: 0, cameraStatus: "off",
      };
      diag = { transport: "none", framesReceived: 0, bytesReceived: 0 };
      emit();
      emitDiag();
      setStatus("disconnected");
    },

    async calibrate() { throw new Error("Live calibration is disabled. This adapter is read-only until a specific aircraft model and safe protocol are validated."); },
    async arm() { throw new Error("Arming is disabled. This adapter is read-only."); },
    async startMission() { throw new Error("Takeoff and mission execution are disabled. This adapter is read-only."); },
    async pauseMission() { throw new Error("Flight commands are disabled. This adapter is read-only."); },
    async resumeMission() { throw new Error("Flight commands are disabled. This adapter is read-only."); },
    async returnToHome() { throw new Error("Return-to-home is disabled. This adapter is read-only."); },
    async emergencyLand() { throw new Error("Remote landing is disabled in this read-only adapter. Use the aircraft's verified physical safety controls."); },

    onTelemetry(callback) { tListeners.add(callback); callback({ ...telemetry }); return () => { tListeners.delete(callback); }; },
    onStatus(callback) { sListeners.add(callback); callback(status); return () => { sListeners.delete(callback); }; },
    onDiagnostics(callback) { dListeners.add(callback); callback({ ...diag }); return () => { dListeners.delete(callback); }; },
    getDiagnostics() { return { ...diag }; },
  };
}

export const setBridgeUrl = (url: string) => {
  if (url.trim()) localStorage.setItem(STORAGE_KEY, validateTelemetryBridgeUrl(url));
  else localStorage.removeItem(STORAGE_KEY);
};
export const getBridgeUrl = () => localStorage.getItem(STORAGE_KEY) || "";
