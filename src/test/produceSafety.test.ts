import { describe, expect, it } from "vitest";
import {
  frameQuality, prepareScanImage, scanResultSchema, primaryOutcomeLabels,
  calculateDeltaE, DEFAULT_TEST_CONFIGS, analyzeCardImageColor, type TestCardConfig
} from "@/lib/produceSafety";

describe("produce screening & chemical card reader", () => {
  it("rejects invented safety and chemical certification outcomes", () => {
    const result = {
      outcome: "safe_to_eat",
      confidence: "high",
      produce: "Mango",
      summary: "",
      observations: [],
      actions: [],
      referenceReading: null
    };
    expect(scanResultSchema.safeParse(result).success).toBe(false);
    expect(scanResultSchema.safeParse({ ...result, outcome: "inconclusive" }).success).toBe(true);
    expect(Object.values(primaryOutcomeLabels).join(" ")).not.toMatch(/safe to eat|certified/i);
  });

  it("rejects dark and featureless frames for auto-capture", () => {
    const pixels = new Uint8ClampedArray(96 * 72 * 4).fill(5);
    expect(frameQuality(pixels, pixels)).toEqual({
      lit: false,
      steady: true,
      detail: false,
      lightScore: 5
    });
  });

  it("requires a previous frame for steadiness", () => {
    expect(frameQuality(new Uint8ClampedArray(16).fill(100)).steady).toBe(false);
  });

  it("rejects unsupported and oversized uploads", async () => {
    await expect(prepareScanImage(new File(["bad"], "script.svg", { type: "image/svg+xml" }))).rejects.toThrow("JPG");
    await expect(prepareScanImage(new File([new Uint8Array(13 * 1024 * 1024)], "large.jpg", { type: "image/jpeg" }))).rejects.toThrow("12 MB");
  });

  it("accurately calculates color distance (DeltaE) between identical and distinct colors", () => {
    const blue: [number, number, number] = [59, 130, 246];
    const red: [number, number, number] = [239, 68, 68];
    expect(calculateDeltaE(blue, blue)).toBe(0);
    expect(calculateDeltaE(blue, red)).toBeGreaterThan(30);
  });

  it("validates test configuration swatches and color matching algorithms", () => {
    const testConfig: TestCardConfig = DEFAULT_TEST_CONFIGS[0];
    expect(testConfig.compatibilityState).toBe("SUPPORTED");
    expect(testConfig.referenceSwatches.length).toBeGreaterThan(0);

    // Mock 2D canvas context for jsdom environment
    const mockImageData = {
      data: new Uint8ClampedArray(20 * 20 * 4).fill(100),
    };
    const mockCtx = {
      getImageData: () => mockImageData,
    } as unknown as CanvasRenderingContext2D;

    const result = analyzeCardImageColor(mockCtx, 100, 100, testConfig);
    expect(result.extractedRgb).toEqual([100, 100, 100]);
    expect(result.quality).toBe("good");
    expect(result.matchedSwatch).not.toBeNull();
  });
});
