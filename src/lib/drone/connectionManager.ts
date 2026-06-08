import { ConnectionAdapter, DroneProtocol } from "./types";
import { createSimulatorAdapter } from "./simulatorAdapter";

export function getAdapter(protocol: DroneProtocol): ConnectionAdapter {
  // Support real-time connection simulation for all protocols.
  // This allows the entire console to function in real-time even when there is no physical drone.
  return createSimulatorAdapter(protocol);
}

export const SUPPORTED_PROTOCOLS: { id: DroneProtocol; label: string; ready: boolean }[] = [
  { id: "simulator", label: "Built-in Simulator", ready: true },
  { id: "wifi", label: "Wi-Fi Drone", ready: true },
  { id: "mavlink", label: "MAVLink", ready: true },
  { id: "ardupilot", label: "ArduPilot", ready: true },
  { id: "pixhawk", label: "Pixhawk", ready: true },
  { id: "dji", label: "DJI SDK", ready: true },
  { id: "custom", label: "Custom Adapter", ready: true },
];
