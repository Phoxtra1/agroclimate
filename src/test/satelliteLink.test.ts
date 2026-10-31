import { describe, expect, it } from "vitest";
import { buildSatelliteHref } from "@/lib/satelliteLink";

describe("buildSatelliteHref", () => {
  it("opens the shared Satellite workspace by default", () => {
    expect(buildSatelliteHref()).toBe("/satellite");
  });

  it("encodes a searched place and label", () => {
    const url = new URL(buildSatelliteHref({
      query: "Kumasi Central Market",
      label: "AG Trans pickup",
      zoom: 16,
    }), "https://agroclimate.test");

    expect(url.pathname).toBe("/satellite");
    expect(url.searchParams.get("q")).toBe("Kumasi Central Market");
    expect(url.searchParams.get("label")).toBe("AG Trans pickup");
    expect(url.searchParams.get("zoom")).toBe("16");
  });

  it("preserves exact valid coordinates for a shared location", () => {
    const url = new URL(buildSatelliteHref({
      lat: 5.6037,
      lon: -0.187,
      label: "Recorded vehicle position",
    }), "https://agroclimate.test");

    expect(url.searchParams.get("lat")).toBe("5.603700");
    expect(url.searchParams.get("lon")).toBe("-0.187000");
    expect(url.searchParams.get("label")).toBe("Recorded vehicle position");
  });

  it("rejects half-specified or out-of-range coordinates", () => {
    expect(() => buildSatelliteHref({ lat: 5.6 })).toThrow(/Both latitude and longitude/);
    expect(() => buildSatelliteHref({ lat: 91, lon: 0 })).toThrow(/coordinates are invalid/);
    expect(() => buildSatelliteHref({ lat: 0, lon: 181 })).toThrow(/coordinates are invalid/);
  });

  it("clamps map zoom to supported limits", () => {
    const tooFarIn = new URL(buildSatelliteHref({ lat: 0, lon: 0, zoom: 99 }), "https://agroclimate.test");
    const tooFarOut = new URL(buildSatelliteHref({ lat: 0, lon: 0, zoom: -5 }), "https://agroclimate.test");

    expect(tooFarIn.searchParams.get("zoom")).toBe("22");
    expect(tooFarOut.searchParams.get("zoom")).toBe("2");
  });
});
