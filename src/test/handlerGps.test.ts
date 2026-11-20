import { describe, expect, it } from "vitest";
import { validateHandlerGpsFix } from "@/lib/handlerGps";

describe("Farm Handler GPS fix validation", () => {
  const now = Date.parse("2026-11-20T12:00:00Z");

  it("accepts valid recent GPS coordinates", () => {
    expect(validateHandlerGpsFix(5.6037, -0.187, 12, now - 30_000, now))
      .toEqual({ lat: 5.6037, lon: -0.187 });
  });

  it("rejects invalid coordinate ranges and non-finite values", () => {
    expect(validateHandlerGpsFix(91, 0, 10, now, now)).toBeNull();
    expect(validateHandlerGpsFix(0, -181, 10, now, now)).toBeNull();
    expect(validateHandlerGpsFix(Number.NaN, 0, 10, now, now)).toBeNull();
  });

  it("rejects missing or invalid accuracy and stale/future timestamps", () => {
    expect(validateHandlerGpsFix(5, -1, 0, now, now)).toBeNull();
    expect(validateHandlerGpsFix(5, -1, Number.NaN, now, now)).toBeNull();
    expect(validateHandlerGpsFix(5, -1, 10, now - 10 * 60_000 - 1, now)).toBeNull();
    expect(validateHandlerGpsFix(5, -1, 10, now + 5 * 60_000 + 1, now)).toBeNull();
  });
});
