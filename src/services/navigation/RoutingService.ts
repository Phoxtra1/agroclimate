import { LatLng, RouteResult, RouteSegment, RouteStep, TravelProfile, RiskLevel } from "./types";
import { scoreRisk } from "@/pages/admin/AGNavEngine";

const PROFILE_SPEED_FACTOR: Record<TravelProfile, number> = {
  car: 1,
  motorcycle: 0.85,
  train: 0.6,
  walking: 4.8,
};

export class RoutingService {
  async computeRoute(params: {
    start: LatLng;
    end: LatLng;
    vessel_id: string;
    load: { passengers: number; cargo_kg: number };
    capacity?: { passengers: number; cargo_kg: number };
    rainProb?: number;
    user_id?: string;
    profile?: TravelProfile;
  }): Promise<RouteResult> {
    const { start, end, load, capacity, rainProb, profile = "car" } = params;
    const url = `https://router.project-osrm.org/route/v1/driving/${start.lon},${start.lat};${end.lon},${end.lat}?overview=full&geometries=geojson&alternatives=true&steps=true`;

    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error("OSRM returned status " + res.status);
      const json = await res.json();
      const main = json?.routes?.[0];
      if (!main) throw new Error("OSRM response empty");

      const route: [number, number][] = main.geometry.coordinates.map((c: number[]) => [c[1], c[0]]);
      const altRoutes: [number, number][][] = (json.routes.slice(1) || []).map((r: any) =>
        r.geometry.coordinates.map((c: number[]) => [c[1], c[0]])
      );

      const factor = PROFILE_SPEED_FACTOR[profile] ?? 1;
      const steps: RouteStep[] = (main.legs?.[0]?.steps ?? []).map((s: any) => ({
        instruction: this.humaniseStep(s, profile),
        distance_m: Number(s.distance ?? 0),
        duration_s: Number(s.duration ?? 0) * factor,
        modifier: s?.maneuver?.modifier,
        type: s?.maneuver?.type,
        location: s?.maneuver?.location ? [s.maneuver.location[1], s.maneuver.location[0]] : undefined,
      }));

      const scoreLevel = (p: LatLng) => scoreRisk(p, { rainProb, load, capacity }).level;
      const segs = this.segmentise(route, scoreLevel);
      const mid = route[Math.floor(route.length / 2)];
      const overall = scoreRisk({ lat: mid[0], lon: mid[1] }, { rainProb, load, capacity });

      return {
        route,
        risk_segments: segs,
        alternatives: altRoutes,
        risk_score: overall.score,
        risk_level: overall.level,
        distance_m: main.distance,
        duration_s: main.duration * factor,
        steps,
        profile,
      };
    } catch (err) {
      console.warn("OSRM routing failed, drawing fallback organic route: ", err);
      // Fallback path calculation
      const distM = this.haversineDist(start.lat, start.lon, end.lat, end.lon);
      const stepsCount = 18;
      const route: [number, number][] = [];

      for (let i = 0; i <= stepsCount; i++) {
        const t = i / stepsCount;
        const lat = start.lat + (end.lat - start.lat) * t;
        const lon = start.lon + (end.lon - start.lon) * t;

        if (i > 0 && i < stepsCount) {
          const offsetLat = Math.sin(t * Math.PI) * 0.0009 * (i % 2 === 0 ? 1.2 : -0.8);
          const offsetLon = Math.cos(t * Math.PI) * 0.0009 * (i % 3 === 0 ? -1.0 : 1.1);
          route.push([lat + offsetLat, lon + offsetLon]);
        } else {
          route.push([lat, lon]);
        }
      }

      const scoreLevel = (p: LatLng) => scoreRisk(p, { rainProb, load, capacity }).level;
      const segs = this.segmentise(route, scoreLevel);
      const mid = route[Math.floor(route.length / 2)];
      const overall = scoreRisk({ lat: mid[0], lon: mid[1] }, { rainProb, load, capacity });

      const steps: RouteStep[] = [
        { instruction: `Head out toward destination`, distance_m: distM * 0.2, duration_s: (distM * 0.2) / 11 },
        { instruction: `Continue along rural routes`, distance_m: distM * 0.6, duration_s: (distM * 0.6) / 11 },
        { instruction: `Arrive at destination`, distance_m: distM * 0.2, duration_s: (distM * 0.2) / 11 },
      ];

      return {
        route,
        risk_segments: segs,
        alternatives: [],
        risk_score: overall.score,
        risk_level: overall.level,
        distance_m: distM,
        duration_s: distM / 11.1,
        steps,
        profile,
      };
    }
  }

  private humaniseStep(s: any, profile: TravelProfile): string {
    const m = s?.maneuver ?? {};
    const road = s?.name ? ` onto ${s.name}` : "";
    const verb = profile === "walking" ? "Walk" : "Continue";
    switch (m.type) {
      case "depart":
        return `Head ${m.modifier || "out"}${road}`;
      case "arrive":
        return "Arrive at your destination";
      case "roundabout":
      case "rotary":
        return `Enter the roundabout and take exit ${s.maneuver?.exit ?? ""}`.trim() + road;
      case "merge":
        return `Merge ${m.modifier || ""}${road}`.replace("  ", " ");
      case "fork":
        return `Keep ${m.modifier || "straight"}${road}`;
      case "new name":
        return `${verb} straight${road}`;
      case "turn":
        return `Turn ${m.modifier || "ahead"}${road}`;
      default:
        return `${verb} ${m.modifier || "straight"}${road}`;
    }
  }

  private segmentise(
    coords: [number, number][],
    scoreFn: (p: LatLng) => RiskLevel,
    parts = 6
  ): RouteSegment[] {
    if (coords.length < 2) return [];
    const chunk = Math.max(2, Math.ceil(coords.length / parts));
    const segs: RouteSegment[] = [];
    for (let i = 0; i < coords.length - 1; i += chunk - 1) {
      const slice = coords.slice(i, i + chunk);
      if (slice.length < 2) break;
      const mid = slice[Math.floor(slice.length / 2)];
      segs.push({ coords: slice, level: scoreFn({ lat: mid[0], lon: mid[1] }) });
    }
    return segs;
  }

  private haversineDist(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371000;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(a));
  }
}
