import { describe, expect, it } from "vitest";
import { calculateAgroRiskLocal } from "@/lib/riskEngine";

const forecast = [{
  tempHigh: 29,
  humidity: 60,
  wind: 8,
  rainProb: 10,
  rainMm: 1,
  soilMoisture: 40,
}];

describe("AgroRisk local estimate provenance", () => {
  it("identifies coordinate terrain and user-reported incident sources", () => {
    const result = calculateAgroRiskLocal(5.6, -0.2, undefined, forecast);
    expect(result.terrainSource).toBe("coordinate_heuristic");
    expect(result.incidentSource).toBe("user_reported_unverified");
    expect(result.terrainAnalysis).toContain("not a measured elevation/slope result");
  });

  it("does not let old incident reports affect current risk scores", () => {
    const baseline = calculateAgroRiskLocal(5.6, -0.2, undefined, forecast, []);
    const oldIncident = calculateAgroRiskLocal(5.6, -0.2, undefined, forecast, [{
      lat: 5.6, lon: -0.2, type: "Flooding", date: "2025-01-01T00:00:00.000Z",
    }]);
    expect(oldIncident.floodScore).toBe(baseline.floodScore);
  });

  it("allows a recent nearby user report to influence the local estimate", () => {
    const baseline = calculateAgroRiskLocal(5.6, -0.2, undefined, forecast, []);
    const recentIncident = calculateAgroRiskLocal(5.6, -0.2, undefined, forecast, [{
      lat: 5.6, lon: -0.2, type: "Flooding", date: new Date().toISOString(),
    }]);
    expect(recentIncident.floodScore).toBeGreaterThan(baseline.floodScore);
  });
});
