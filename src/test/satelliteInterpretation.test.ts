import { describe, expect, it } from "vitest";
import { interpretFieldIndices, interpretVegetationAlert } from "../services/satellite/interpretation";

describe("farmer-friendly satellite interpretation", () => {
  it("explains low vegetation and canopy moisture without diagnosing disease", () => {
    const result = interpretFieldIndices({ ndvi: 0.3, ndmi: 0.05, ndwi: -0.1 });
    expect(result.combinedSignal).toContain("may reflect");
    expect(result.possibleExplanations).toContain("Normal crop-stage change, such as emergence, senescence or harvest.");
    expect(result.fieldChecks.length).toBeGreaterThan(0);
  });

  it("explains corroborating NDVI and NDMI declines", () => {
    const result = interpretVegetationAlert({
      baselineNdvi: 0.7,
      currentNdvi: 0.5,
      baselineNdmi: 0.3,
      currentNdmi: 0.18,
    });
    expect(result.observedChange).toContain("29% lower");
    expect(result.likelyMeaning).toContain("Water stress is one possibility");
    expect(result.checks).toContain("Check root-zone moisture, irrigation delivery and recent rainfall.");
  });

  it("avoids making conclusions when data is missing", () => {
    const result = interpretVegetationAlert({
      baselineNdvi: null,
      currentNdvi: 0.4,
      baselineNdmi: null,
      currentNdmi: null,
    });
    expect(result.likelyMeaning).toContain("verification");
  });
});
