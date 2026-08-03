import { describe, it, expect, vi } from "vitest";
import { DestinationService } from "../services/navigation/DestinationService";
import { RouteRecalculationService } from "../services/navigation/RouteRecalculationService";
import { RoutingService } from "../services/navigation/RoutingService";

// Mock OSRM fetch requests
global.fetch = vi.fn().mockImplementation(() =>
  Promise.resolve({
    ok: true,
    json: () =>
      Promise.resolve({
        routes: [
          {
            geometry: {
              coordinates: [
                [-0.187, 5.6037],
                [-0.188, 5.6047],
                [-0.189, 5.6057],
              ],
            },
            distance: 500,
            duration: 120,
            legs: [
              {
                steps: [
                  {
                    maneuver: { type: "depart", modifier: "straight" },
                    name: "Test Road",
                    distance: 250,
                    duration: 60,
                  },
                  {
                    maneuver: { type: "arrive" },
                    distance: 250,
                    duration: 60,
                  },
                ],
              },
            ],
          },
        ],
      }),
  })
);

describe("DestinationService", () => {
  const destService = new DestinationService();

  it("should successfully parse numeric coordinates", () => {
    const parsed = destService.parseCoords("5.6037, -0.187");
    expect(parsed).not.toBeNull();
    expect(parsed?.lat).toBe(5.6037);
    expect(parsed?.lon).toBe(-0.187);
  });

  it("should detect if a destination matches the user current location", () => {
    const dest = { lat: 5.6037, lon: -0.187 };
    const current = { lat: 5.6037001, lon: -0.1870001 };
    const isAtLoc = destService.isAtCurrentLocation(dest, current);
    expect(isAtLoc).toBe(true);
  });
});

describe("RouteRecalculationService", () => {
  const recalculationService = new RouteRecalculationService();

  it("should detect when a user has drifted off route path", () => {
    const route: [number, number][] = [
      [5.6037, -0.187],
      [5.6047, -0.188],
    ];
    // Location very close to the route start
    const closePos = { lat: 5.603705, lon: -0.187005 };
    const check1 = recalculationService.isOffRoute(closePos, route, 80);
    expect(check1.offRoute).toBe(false);

    // Location far away (approx 10km away) from the route
    const farPos = { lat: 5.7037, lon: -0.287 };
    const check2 = recalculationService.isOffRoute(farPos, route, 80);
    expect(check2.offRoute).toBe(true);
  });
});

describe("RoutingService", () => {
  const routingService = new RoutingService();

  it("should compute route segments and steps successfully", async () => {
    const start = { lat: 5.6037, lon: -0.187 };
    const end = { lat: 5.6057, lon: -0.189 };
    const result = await routingService.computeRoute({
      start,
      end,
      vessel_id: "TEST-V",
      load: { passengers: 1, cargo_kg: 10 },
      profile: "car",
    });

    expect(result.route.length).toBeGreaterThan(0);
    expect(result.distance_m).toBe(500);
    expect(result.duration_s).toBe(120);
    expect(result.steps?.length).toBe(2);
    expect(result.steps?.[0].instruction).toContain("Head straight");
  });
});
