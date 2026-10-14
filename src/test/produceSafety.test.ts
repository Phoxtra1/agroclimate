import { describe, expect, it } from "vitest";
import { frameQuality, prepareScanImage, scanResultSchema, outcomeLabels } from "@/lib/produceSafety";

describe("produce screening", () => {
  it("rejects invented safety and chemical certification outcomes", () => {
    const result = { outcome: "safe_to_eat", confidence: "high", produce: "Mango", summary: "", observations: [], actions: [], referenceReading: null };
    expect(scanResultSchema.safeParse(result).success).toBe(false);
    expect(scanResultSchema.safeParse({ ...result, outcome: "inconclusive" }).success).toBe(true);
    expect(Object.values(outcomeLabels).join(" ")).not.toMatch(/safe to eat|certified/i);
  });
  it("rejects dark and featureless frames for auto-capture", () => {
    const pixels = new Uint8ClampedArray(96 * 72 * 4).fill(5);
    expect(frameQuality(pixels, pixels)).toEqual({ lit: false, steady: true, detail: false });
  });
  it("requires a previous frame for steadiness", () => {
    expect(frameQuality(new Uint8ClampedArray(16).fill(100)).steady).toBe(false);
  });
  it("rejects unsupported and oversized uploads", async () => {
    await expect(prepareScanImage(new File(["bad"], "script.svg", { type: "image/svg+xml" }))).rejects.toThrow("JPG");
    await expect(prepareScanImage(new File([new Uint8Array(13 * 1024 * 1024)], "large.jpg", { type: "image/jpeg" }))).rejects.toThrow("12 MB");
  });
});
