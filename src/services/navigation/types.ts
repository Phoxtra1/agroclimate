export type LatLng = { lat: number; lon: number };

export type RiskLevel = "safe" | "moderate" | "high" | "critical";

export interface RouteSegment {
  coords: [number, number][];
  level: RiskLevel;
}

export interface RouteStep {
  instruction: string;
  distance_m: number;
  duration_s: number;
  modifier?: string;
  type?: string;
  location?: [number, number];
}

export type TravelProfile = "car" | "motorcycle" | "train" | "walking";

export interface RouteResult {
  route: [number, number][];
  risk_segments: RouteSegment[];
  alternatives: [number, number][][];
  risk_score: number;
  risk_level: RiskLevel;
  distance_m: number;
  duration_s: number;
  steps?: RouteStep[];
  profile?: TravelProfile;
}

export type NavigationState =
  | "IDLE"
  | "DESTINATION_SELECTED"
  | "ROUTE_CALCULATED"
  | "NAVIGATION_STARTED"
  | "LIVE_GPS_TRACKING"
  | "OFF_ROUTE_DETECTION"
  | "ROUTE_RECALCULATION"
  | "DESTINATION_REACHED";

export interface Destination {
  lat: number;
  lon: number;
  label: string;
}

export interface NavigationTelemetry {
  currentPos: LatLng;
  bearing: number;
  speedKn: number;
  isMoving: boolean;
  gpsLocked: boolean;
  state: NavigationState;
}
