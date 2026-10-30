import { afterEach, describe, expect, it, vi } from "vitest";
import {
  buildTileJsonUrl,
  calculatePolygonAreaHectares,
  describeNdmi,
  describeNdvi,
  getIndexAtPoint,
  searchSentinelScenes,
} from "@/services/satellite/sentinel";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("Sentinel-2 analysis helpers", () => {
  it("calculates a field polygon area in hectares", () => {
    const area = calculatePolygonAreaHectares([
      { lat: 0, lon: 0 },
      { lat: 0, lon: 0.001 },
      { lat: 0.001, lon: 0.001 },
      { lat: 0.001, lon: 0 },
    ]);
    expect(area).toBeGreaterThan(1.2);
    expect(area).toBeLessThan(1.3);
  });

  it("returns zero area for fewer than three vertices", () => {
    expect(calculatePolygonAreaHectares([{ lat: 5, lon: 0 }, { lat: 5.1, lon: 0.1 }])).toBe(0);
  });

  it("labels NDVI and NDMI without claiming crop diagnosis", () => {
    expect(describeNdvi(0.7)).toContain("greenness");
    expect(describeNdmi(0.2)).toContain("canopy-moisture");
    expect(describeNdvi(null)).toContain("No valid pixels");
  });

  it("builds Sentinel-2 NDVI tile metadata requests from the STAC item", () => {
    const url = new URL(buildTileJsonUrl(
      "https://earth-search.aws.element84.com/v1/collections/sentinel-2-c1-l2a/items/example",
      "ndvi",
    ));
    expect(url.pathname).toBe("/stac/WebMercatorQuad/tilejson.json");
    expect(url.searchParams.get("expression")).toBe("(b1-b2)/(b1+b2)");
    expect(url.searchParams.getAll("assets")).toEqual(["nir", "red"]);
  });

  it("rejects a non-catalogue STAC item URL", () => {
    expect(() => buildTileJsonUrl("https://example.com/item.json", "true-color")).toThrow("trusted Earth Search");
  });

  it("searches the public STAC catalogue and sorts returned scenes", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        features: [
          {
            id: "cloudy-newer",
            geometry: { type: "Point", coordinates: [0, 0] },
            properties: { datetime: "2026-10-28T10:00:00Z", "eo:cloud_cover": 35, platform: "sentinel-2b" },
            links: [],
          },
          {
            id: "clear-older",
            geometry: { type: "Point", coordinates: [0, 0] },
            properties: { datetime: "2026-10-20T10:00:00Z", "eo:cloud_cover": 5, platform: "sentinel-2a" },
            links: [],
          },
        ],
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const scenes = await searchSentinelScenes({
      point: { lat: 5, lon: -1 },
      daysBack: 30,
      maxCloudCover: 40,
    });

    expect(fetchMock).toHaveBeenCalledOnce();
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toMatchObject({
      collections: ["sentinel-2-c1-l2a"],
      intersects: { type: "Point", coordinates: [-1, 5] },
      query: { "eo:cloud_cover": { lte: 40 } },
    });
    expect(scenes.map((scene) => scene.id)).toEqual(["clear-older", "cloudy-newer"]);
    expect(scenes[0].cloudCover).toBe(5);
  });

  it("surfaces STAC catalogue errors instead of inventing imagery", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 503 }));
    await expect(searchSentinelScenes({
      point: { lat: 5, lon: -1 },
      daysBack: 30,
      maxCloudCover: 40,
    })).rejects.toThrow("returned 503");
  });

  it("samples a numeric spectral index value", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ values: [0.63] }),
    }));
    const value = await getIndexAtPoint(
      "https://earth-search.aws.element84.com/v1/collections/sentinel-2-c1-l2a/items/example",
      { lat: 5, lon: -1 },
      "ndvi",
    );
    expect(value).toBe(0.63);
  });
});
