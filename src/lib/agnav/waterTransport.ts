// AGNav — water transport & rescue coordination architecture stubs.
// Future expansion: integrates with AgroClimate environmental intelligence
// (wave/wind/flood risk) to support fishing community navigation,
// waterway safety alerts, and rescue coordination.
// MVP currently delivers AGTrans (road logistics) only. These types
// reserve the shape so the rest of the system can be wired without rework.

export type WaterVesselType = "canoe" | "boat" | "trawler" | "ferry";

export interface WaterRoute {
  id: string;
  name: string;
  waypoints: Array<{ lat: number; lon: number; label?: string }>;
  hazards?: string[];
}

export interface WaterSafetyAlert {
  id: string;
  region: string;
  type: "storm" | "high_wave" | "flood" | "low_visibility" | "search_rescue";
  severity: "low" | "moderate" | "high" | "critical";
  message: string;
  issued_at: string;
}

// TODO: integrate with environmental intelligence + Tomorrow.io marine data.
export const AGNAV_STATUS = "architecture-only" as const;
