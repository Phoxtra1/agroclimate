import { ConnectionAdapter, DroneProtocol } from "./types";
import { createSimulatorAdapter } from "./simulatorAdapter";
import { createRealAdapter } from "./realAdapter";

export function getAdapter(protocol: DroneProtocol): ConnectionAdapter {
  if (protocol === "simulator") return createSimulatorAdapter();
  return createRealAdapter({ protocol });
}

export const SUPPORTED_PROTOCOLS: { id: DroneProtocol; label: string; ready: boolean }[] = [
  { id: "simulator", label: "Built-in Simulator", ready: true },
  { id: "wifi",      label: "Wi-Fi Drone (bridge / BLE / USB)", ready: true },
  { id: "mavlink",   label: "MAVLink (WS bridge / Serial)",     ready: true },
  { id: "ardupilot", label: "ArduPilot (WS bridge)",            ready: true },
  { id: "pixhawk",   label: "Pixhawk (USB Serial)",             ready: true },
  { id: "dji",       label: "DJI (WS bridge)",                  ready: true },
  { id: "custom",    label: "Custom Adapter",                   ready: true },
];

export { setBridgeUrl, getBridgeUrl } from "./realAdapter";
