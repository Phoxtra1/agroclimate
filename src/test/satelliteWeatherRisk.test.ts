import { describe, expect, it } from "vitest";
import { assessSatelliteWeatherRisk, parseSatelliteWeather } from "@/services/satellite/weatherRisk";
const now = Date.parse("2026-11-20T15:36:00Z");
const payload = {
  provider: "Tomorrow.io", fetchedAt: "2026-11-20T15:35:00Z",
  realtime: { data: { time: "2026-11-20T15:30:00Z", values: { temperature: 30 } } },
  forecast: { timelines: { daily: [{ time: "2026-11-20T00:00:00Z", values: { temperatureMax: 36, windSpeedMax: 12, rainAccumulationSum: 50 } }] } },
};
describe("Satellite evidence-based risk", () => {
  it("uses real forecast values at the selected coordinate", () => {
    const risks = assessSatelliteWeatherRisk(parseSatelliteWeather(payload), now);
    expect(risks.slice(0, 3).map(r => r.level)).toEqual(["high", "high", "high"]);
    expect(risks[1].evidence).toContain("43.2 km/h");
  });
  it("does not invent rainfall, wind or humidity when provider values are absent", () => {
    const evidence = parseSatelliteWeather({ ...payload, forecast: { timelines: { daily: [{ time: "2026-11-20T00:00:00Z", values: {} }] } } });
    expect(evidence.humidityPct).toBeNull();
    expect(assessSatelliteWeatherRisk(evidence, now).every(r => r.level === "unavailable")).toBe(true);
  });
  it("withdraws risk levels from stale data", () => {
    expect(assessSatelliteWeatherRisk(parseSatelliteWeather(payload), now + 31 * 60000).every(r => r.level === "unavailable")).toBe(true);
  });
  it("never claims parcel flood or landslide risk from weather alone", () => {
    expect(assessSatelliteWeatherRisk(parseSatelliteWeather(payload), now)[3].level).toBe("unavailable");
  });
});