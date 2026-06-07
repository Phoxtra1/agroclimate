import { ConnectionAdapter, DroneProtocol } from "./types";
import { createSimulatorAdapter } from "./simulatorAdapter";

// Future-ready protocol adapters. Each throws a clear bridge-required error until
// a native MAVLink / DJI / Pixhawk companion app provides a WebUSB or WebSocket bridge.
function notImplemented(protocol: DroneProtocol): ConnectionAdapter {
  const err = () => { throw new Error(`${protocol.toUpperCase()} bridge not connected. Pair a companion app or switch to the built-in Simulator.`); };
  return {
    id: protocol,
    label: protocol.toUpperCase(),
    scan: err as any, connect: err as any, disconnect: err as any,
    calibrate: err as any, arm: err as any, startMission: err as any,
    pauseMission: err as any, resumeMission: err as any,
    returnToHome: err as any, emergencyLand: err as any,
    onTelemetry: () => () => {}, onStatus: () => () => {},
  };
}

export function getAdapter(protocol: DroneProtocol): ConnectionAdapter {
  switch (protocol) {
    case "simulator": return createSimulatorAdapter();
    default: return notImplemented(protocol);
  }
}

export const SUPPORTED_PROTOCOLS: { id: DroneProtocol; label: string; ready: boolean }[] = [
  { id: "simulator", label: "Built-in Simulator", ready: true },
  { id: "wifi", label: "Wi-Fi Drone", ready: false },
  { id: "mavlink", label: "MAVLink", ready: false },
  { id: "ardupilot", label: "ArduPilot", ready: false },
  { id: "pixhawk", label: "Pixhawk", ready: false },
  { id: "dji", label: "DJI SDK", ready: false },
  { id: "custom", label: "Custom Adapter", ready: false },
];
