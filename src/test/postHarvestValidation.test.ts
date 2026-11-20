import { describe, expect, it } from "vitest";
import { validateHarvestEntry } from "@/lib/postHarvestValidation";

describe("Post-Harvest record validation", () => {
  const valid = { crop_name: "Maize", quantity: 25, unit: "kg", harvest_date: "2026-11-20" };

  it("accepts a complete valid harvest record", () => {
    expect(validateHarvestEntry(valid)).toBeNull();
  });

  it("requires a crop name and unit", () => {
    expect(validateHarvestEntry({ ...valid, crop_name: " " })).toContain("Crop name");
    expect(validateHarvestEntry({ ...valid, unit: "" })).toContain("unit");
  });

  it("rejects zero, negative and non-finite quantities", () => {
    expect(validateHarvestEntry({ ...valid, quantity: 0 })).toContain("greater than zero");
    expect(validateHarvestEntry({ ...valid, quantity: -1 })).toContain("greater than zero");
    expect(validateHarvestEntry({ ...valid, quantity: Number.NaN })).toContain("greater than zero");
  });

  it("requires a valid harvest date", () => {
    expect(validateHarvestEntry({ ...valid, harvest_date: "not-a-date" })).toContain("valid harvest date");
  });
});
