export type AircraftType = 
  | 'drone' 
  | 'helicopter' 
  | 'fixed_wing' 
  | 'air_ambulance' 
  | 'cargo' 
  | 'evtol' 
  | 'survey' 
  | 'maritime_patrol' 
  | 'custom';

export type AircraftProtocol = 
  | 'simulator' 
  | 'wifi' 
  | 'mavlink' 
  | 'px4' 
  | 'ardupilot' 
  | 'dji' 
  | 'autel' 
  | 'rtsp' 
  | 'webrtc' 
  | 'adsb' 
  | 'custom';

export type AircraftStatus = 'disconnected' | 'connecting' | 'connected' | 'lost';

export type FlightMode = 
  | 'manual' 
  | 'stabilize' 
  | 'guided' 
  | 'land' 
  | 'rtl' 
  | 'loiter' 
  | 'auto' 
  | 'emergency';

export type GpsFix = 'none' | '2d' | '3d' | 'dgps' | 'rtk';

export interface AircraftAsset {
  id: string;
  name: string;
  type: AircraftType;
  manufacturer: string;
  model: string;
  protocol: AircraftProtocol;
  status: AircraftStatus;
  lastConnected: string | null;
  operator: string;
  homeBase: string;
  metadata?: Record<string, any>;
}

export interface UniversalTelemetry {
  aircraftId: string;
  aircraftType: AircraftType;
  latitude: number;
  longitude: number;
  altitude: number;
  speed: number;
  heading: number;
  batteryFuelStatus: number; // battery percentage (0-100) or fuel level
  signalStrength: number; // percentage (0-100)
  flightMode: FlightMode;
  gpsStatus: GpsFix;
  connectionStatus: AircraftStatus;
  timestamp: string;
  pitch?: number;
  roll?: number;
  yaw?: number;
  windSpeed?: number;
  windDirection?: number;
  sensorData?: Record<string, any>;
}

export type CommandType = 
  | 'arm' 
  | 'disarm' 
  | 'takeoff' 
  | 'land' 
  | 'returnHome' 
  | 'holdPosition' 
  | 'startMission' 
  | 'pauseMission' 
  | 'resumeMission';

export type StorageBackend = 'local' | 'supabase' | 's3' | 'r2';

export interface MediaBackendConfig {
  backend: StorageBackend;
  supabaseBucket?: string;
  s3Bucket?: string;
  s3Region?: string;
  r2AccountId?: string;
  r2Bucket?: string;
}

export type CameraSensorSource = 'rgb' | 'thermal' | 'multispectral' | 'environmental';

export type StreamProtocol = 'rtsp' | 'webrtc' | 'hls';

export interface StreamHealth {
  fps: number;
  bitrateKbps: number;
  latencyMs: number;
  packetLossPct: number;
  signalQuality: number;
}
