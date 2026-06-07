export type DroneProtocol = "simulator" | "wifi" | "mavlink" | "ardupilot" | "pixhawk" | "dji" | "custom";

export type FlightStatus =
  | "disconnected"
  | "connecting"
  | "connected"
  | "calibrating"
  | "armed"
  | "flying"
  | "paused"
  | "returning"
  | "landing"
  | "emergency";

export interface DiscoveredDrone {
  id: string;
  name: string;
  model: string;
  protocol: DroneProtocol;
  signal: number;
  firmware?: string;
}

export interface DroneTelemetry {
  lat?: number;
  lng?: number;
  altitude: number;
  groundSpeed: number;
  verticalSpeed: number;
  heading: number;
  battery: number;
  signalStrength: number;
  gpsAccuracy: number;
  gpsFix: "none" | "2d" | "3d";
  flightDuration: number;
  distanceCovered: number;
  cameraStatus: "off" | "ready" | "recording";
}

export interface ConnectionAdapter {
  id: DroneProtocol;
  label: string;
  scan(): Promise<DiscoveredDrone[]>;
  connect(droneId: string): Promise<void>;
  disconnect(): Promise<void>;
  calibrate(): Promise<void>;
  arm(): Promise<void>;
  startMission(): Promise<void>;
  pauseMission(): Promise<void>;
  resumeMission(): Promise<void>;
  returnToHome(): Promise<void>;
  emergencyLand(): Promise<void>;
  onTelemetry(cb: (t: DroneTelemetry) => void): () => void;
  onStatus(cb: (s: FlightStatus) => void): () => void;
}
