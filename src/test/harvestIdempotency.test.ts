import { describe, expect, it } from "vitest";
import { buildHarvestPhotoPath, createHarvestIdempotencyKey } from "@/lib/harvestIdempotency";

describe("Post-Harvest idempotency helpers", () => {
  it("creates a non-empty stable key suitable for local queue identity", () => {
    expect(createHarvestIdempotencyKey()).toMatch(/^.+$/);
  });

  it("creates the same storage object path for the same submission and photo index", () => {
    const first = buildHarvestPhotoPath("user-123", "submission-abc", 0, "jpeg");
    const retry = buildHarvestPhotoPath("user-123", "submission-abc", 0, "image/jpeg");
    expect(first).toBe(retry);
    expect(first).toBe("user-123/harvest-submission-abc-0.jpeg");
  });

  it("isolates each photo and sanitizes path components", () => {
    const first = buildHarvestPhotoPath("user-123", "submission:abc", 0, "jpg");
    const second = buildHarvestPhotoPath("user-123", "submission:abc", 1, "jpg");
    expect(first).not.toBe(second);
    expect(first).toBe("user-123/harvest-submission_abc-0.jpg");
  });
});
