export type DroneProtocol =
  | "simulator"
  | "wifi"
  | "mavlink"
  | "ardupilot"
  | "pixhawk"
  | "dji"
  | "autel"
  | "adsb"
  | "rtsp"
  | "webrtc"
  | "mqtt"
  | "aih"
  | "custom";

export type AircraftType =
  | "drone"
  | "helicopter"
  | "fixed_wing"
  | "air_ambulance"
  | "cargo"
  | "evtol"
  | "survey"
  | "maritime_patrol"
  | "custom";

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
  aircraftType?: AircraftType;
  type?: AircraftType;
  manufacturer?: string;
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
  // UTG extensions
  fuelPct?: number;
  flightMode?: string;
}

export interface ConnectionDiagnostics {
  transport: "websocket" | "bluetooth" | "serial" | "simulator" | "aih" | "none";
  endpoint?: string;
  connectedAt?: number;
  lastHandshakeAt?: number;
  lastFrameAt?: number;
  lastError?: string;
  framesReceived: number;
  bytesReceived: number;
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
  getDiagnostics?(): ConnectionDiagnostics;
  onDiagnostics?(cb: (d: ConnectionDiagnostics) => void): () => void;
}
