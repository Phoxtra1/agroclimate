import { describe, it, expect, vi, beforeEach } from "vitest";
import { searchPlaces, reverseGeocode, calculateRoute } from "../services/satellite/navigation";
import { STRATEGIC_BOARDS } from "../services/satellite/stations";

describe("Satellite Strategic Stations & Boards", () => {
  it("includes the Bab el-Mandeb strategic transit board with stations", () => {
    const bab = STRATEGIC_BOARDS.find((b) => b.id === "bab-el-mandeb");
    expect(bab).toBeDefined();
    expect(bab?.category).toBe("maritime");
    expect(bab?.stations.length).toBeGreaterThanOrEqual(5);

    const gateStation = bab?.stations.find((s) => s.id === "gate");
    expect(gateStation).toBeDefined();
    expect(gateStation?.name).toBe("Bab el-Mandeb gate");
    expect(gateStation?.metricValue).toBe("14");
    expect(gateStation?.delta).toContain("-11");
  });

  it("generates time series with observed and 7-day rolling average curves", () => {
    const bab = STRATEGIC_BOARDS.find((b) => b.id === "bab-el-mandeb");
    expect(bab?.history90d.length).toBeGreaterThan(80);
    const samplePoint = bab?.history90d[10];
    expect(samplePoint).toBeDefined();
    expect(typeof samplePoint?.observed).toBe("number");
    expect(typeof samplePoint?.average7d).toBe("number");
    expect(typeof samplePoint?.upperBand).toBe("number");
  });

  it("includes West Africa Tema & Volta Agricultural Belt corridor", () => {
    const westAfrica = STRATEGIC_BOARDS.find((b) => b.id === "west-africa-agri-corridor");
    expect(westAfrica).toBeDefined();
    expect(westAfrica?.category).toBe("agriculture");
    expect(westAfrica?.corridorLine.length).toBeGreaterThan(3);
  });
});

describe("Satellite Navigation & Geocoding Service", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("parses direct coordinate search strings instantly", async () => {
    const results = await searchPlaces("12.58, 43.33");
    expect(results.length).toBe(1);
    expect(results[0].type).toBe("coordinate");
    expect(results[0].lat).toBeCloseTo(12.58);
    expect(results[0].lon).toBeCloseTo(43.33);
  });

  it("queries geocoding endpoint for named places", async () => {
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => [
        {
          place_id: "101",
          name: "Tema Port",
          display_name: "Tema Port, Greater Accra, Ghana",
          lat: "5.62",
          lon: "-0.01",
          type: "harbour",
        },
      ],
    } as any);

    const results = await searchPlaces("Tema Port");
    expect(results.length).toBe(1);
    expect(results[0].name).toBe("Tema Port");
    expect(results[0].lat).toBe(5.62);
    expect(results[0].lon).toBe(-0.01);
  });

  it("calculates real-time routes with distance, duration, and steps", async () => {
    global.fetch = vi.fn()
      // OSRM route response
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          routes: [
            {
              distance: 145000,
              duration: 7200,
              geometry: {
                coordinates: [
                  [-0.01, 5.62],
                  [-0.84, 9.4],
                ],
              },
              legs: [
                {
                  steps: [
                    {
                      name: "N1",
                      distance: 50000,
                      duration: 2400,
                      maneuver: { type: "depart", modifier: "straight" },
                    },
                    {
                      name: "N10",
                      distance: 95000,
                      duration: 4800,
                      maneuver: { type: "arrive" },
                    },
                  ],
                },
              ],
            },
          ],
        }),
      } as any)
      // Reverse geocode start
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ name: "Tema Harbour", display_name: "Tema, Ghana" }),
      } as any)
      // Reverse geocode end
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ name: "Tamale Silo", display_name: "Tamale, Ghana" }),
      } as any);

    const route = await calculateRoute(
      { lat: 5.62, lon: -0.01 },
      { lat: 9.4, lon: -0.84 },
      "freight"
    );

    expect(route.distanceKm).toBe(145.0);
    expect(route.durationMinutes).toBeGreaterThan(0);
    expect(route.geometry.length).toBe(2);
    expect(route.steps.length).toBe(2);
    expect(route.steps[0].instruction).toContain("Depart");
    expect(route.startAddress).toBe("Tema Harbour");
  });
});
