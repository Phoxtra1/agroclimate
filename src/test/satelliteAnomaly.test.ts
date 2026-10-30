import { describe, expect, it } from "vitest";
import { assessVegetationChange, median } from "../../supabase/functions/_shared/satellite-anomaly";

describe("satellite vegetation anomaly assessment", () => {
  it("uses the median baseline to reduce outlier sensitivity", () => {
    expect(median([0.2, 0.6, 0.4])).toBe(0.4);
    expect(median([0.2, 0.4, 0.6, 0.8])).toBe(0.5);
  });

  it("flags a material NDVI decline corroborated by canopy moisture", () => {
    const result = assessVegetationChange({
      baselineNdvi: 0.7,
      currentNdvi: 0.48,
      baselineNdmi: 0.32,
      currentNdmi: 0.19,
      minimumDrop: 0.15,
      cloudCover: 10,
    });
    expect(result.isAnomaly).toBe(true);
    expect(result.severity).toBe("high");
    expect(result.corroboratedByNdmi).toBe(true);
    expect(result.confidence).toBe(90);
  });

  it("does not alert on a small vegetation change", () => {
    const result = assessVegetationChange({
      baselineNdvi: 0.7,
      currentNdvi: 0.64,
      baselineNdmi: 0.3,
      currentNdmi: 0.29,
      minimumDrop: 0.15,
      cloudCover: 5,
    });
    expect(result.isAnomaly).toBe(false);
    expect(result.severity).toBeNull();
  });

  it("requires both absolute and relative NDVI decline thresholds", () => {
    const result = assessVegetationChange({
      baselineNdvi: 0.4,
      currentNdvi: 0.3,
      baselineNdmi: 0.2,
      currentNdmi: 0.1,
      minimumDrop: 0.15,
      cloudCover: 20,
    });
    expect(result.isAnomaly).toBe(false);
  });

  it("raises confidence when a clear image and NDMI support the decline", () => {
    const result = assessVegetationChange({
      baselineNdvi: 0.8,
      currentNdvi: 0.55,
      baselineNdmi: 0.35,
      currentNdmi: 0.2,
      minimumDrop: 0.15,
      cloudCover: 10,
    });
    expect(result.confidence).toBe(90);
  });
});
