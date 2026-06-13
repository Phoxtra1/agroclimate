import { ConnectionAdapter, DroneProtocol } from "./types";
import { createSimulatorAdapter } from "./simulatorAdapter";
import { createRealAdapter } from "./realAdapter";
import { createAihAdapter } from "./aihAdapter";

export function getAdapter(protocol: DroneProtocol): ConnectionAdapter {
  if (protocol === "simulator") return createSimulatorAdapter();
  if (protocol === "aih") return createAihAdapter();
  return createRealAdapter({ protocol });
}

export const SUPPORTED_PROTOCOLS: { id: DroneProtocol; label: string; ready: boolean }[] = [
  { id: "simulator", label: "Built-in Simulator", ready: true },
  { id: "aih",       label: "Air Integration Hub (recommended)", ready: true },
  { id: "wifi",      label: "Wi-Fi Drone (bridge / BLE / USB)", ready: true },
  { id: "mavlink",   label: "MAVLink (WS bridge / Serial)",     ready: true },
  { id: "ardupilot", label: "ArduPilot (WS bridge)",            ready: true },
  { id: "pixhawk",   label: "Pixhawk (USB Serial)",             ready: true },
  { id: "dji",       label: "DJI (WS bridge)",                  ready: true },
  { id: "autel",     label: "Autel SDK (WS bridge)",            ready: true },
  { id: "adsb",      label: "ADS-B (read-only monitoring)",      ready: true },
  { id: "rtsp",      label: "RTSP video stream",                ready: true },
  { id: "webrtc",    label: "WebRTC stream",                    ready: true },
  { id: "mqtt",      label: "MQTT broker (WS bridge)",          ready: true },
  { id: "custom",    label: "Custom Adapter",                   ready: true },
];

export { setBridgeUrl, getBridgeUrl } from "./realAdapter";
