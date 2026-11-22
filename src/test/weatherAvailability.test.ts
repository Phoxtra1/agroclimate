import { describe, expect, it } from "vitest";
import { requireCurrentWeather, weatherIsCurrent } from "@/lib/weatherAvailability";

describe("weather decision availability", () => {
  const now = Date.parse("2026-11-22T02:17:00Z");
  it("withholds decisions when weather is missing or undated", () => {
    expect(weatherIsCurrent([], now)).toBe(false);
    expect(weatherIsCurrent([{}], now)).toBe(false);
    expect(() => requireCurrentWeather([], now)).toThrow();
  });
  it("does not treat yesterday's old cached weather as today's evidence", () => {
    expect(weatherIsCurrent([{ isoDate: "2026-11-20T00:00:00Z" }], now)).toBe(false);
  });
  it("accepts the provider's dated forecast for today", () => {
    expect(weatherIsCurrent([{ isoDate: "2026-11-22T00:00:00Z" }], now)).toBe(true);
  });
});