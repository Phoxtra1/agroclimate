import { ConnectionAdapter, DroneProtocol } from "./types";
import { createSimulatorAdapter } from "./simulatorAdapter";
import { createRealAdapter } from "./realAdapter";
import { createAihAdapter } from "./aihAdapter";
import { createMavlinkConnectionAdapter } from "./mavlinkAdapter";

function createUnavailableAdapter(protocol: DroneProtocol): ConnectionAdapter {
  const unavailable = () => Promise.reject(new Error(`The ${protocol.toUpperCase()} adapter is not implemented or validated yet. Use the simulator or the read-only Custom JSON Telemetry Bridge.`));
  const diagnostics = { transport: "none" as const, framesReceived: 0, bytesReceived: 0, lastError: `${protocol.toUpperCase()} adapter not configured` };
  return {
    id: protocol,
    label: `${protocol.toUpperCase()} (not configured)`,
    scan: async () => [],
    connect: unavailable,
    disconnect: async () => undefined,
    calibrate: unavailable,
    arm: unavailable,
    startMission: unavailable,
    pauseMission: unavailable,
    resumeMission: unavailable,
    returnToHome: unavailable,
    emergencyLand: unavailable,
    onTelemetry: () => () => undefined,
    onStatus: (callback) => { callback("disconnected"); return () => undefined; },
    getDiagnostics: () => diagnostics,
    onDiagnostics: (callback) => { callback(diagnostics); return () => undefined; },
  };
}

export function getAdapter(protocol: DroneProtocol): ConnectionAdapter {
  if (protocol === "simulator") return createSimulatorAdapter();
  if (protocol === "aih") return createAihAdapter();
  if (protocol === "custom") return createRealAdapter({ protocol });
  if (protocol === "mavlink") return createMavlinkConnectionAdapter();
  return createUnavailableAdapter(protocol);
}

export const SUPPORTED_PROTOCOLS: { id: DroneProtocol; label: string; ready: boolean }[] = [
  { id: "simulator", label: "Built-in Simulator", ready: true },
  { id: "custom", label: "Custom JSON Telemetry Bridge (read-only)", ready: true },
  { id: "aih", label: "Air Integration Hub", ready: false },
  { id: "wifi", label: "Wi-Fi Drone Adapter", ready: false },
  { id: "mavlink", label: "MAVLink Serial (read-only)", ready: true },
  { id: "ardupilot", label: "ArduPilot", ready: false },
  { id: "pixhawk", label: "Pixhawk", ready: false },
  { id: "dji", label: "DJI SDK", ready: false },
  { id: "autel", label: "Autel SDK", ready: false },
  { id: "adsb", label: "ADS-B", ready: false },
  { id: "rtsp", label: "RTSP", ready: false },
  { id: "webrtc", label: "WebRTC", ready: false },
  { id: "mqtt", label: "MQTT", ready: false },
];

export { setBridgeUrl, getBridgeUrl } from "./realAdapter";
