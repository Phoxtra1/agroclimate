// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { createWeatherProvider } from "../../supabase/functions/_shared/weather-provider";

const forecast = { timelines: { daily: [{ time: "2026-11-22T00:00:00Z", values: { temperatureMax: 30, temperatureMin: 22 } }] } };
const realtime = { data: { time: "2026-11-22T02:00:00Z", values: { temperature: 26 } } };

describe("weather provider resilience", () => {
  it("returns unavailable rather than a 502 or invented data on rate limits and respects Retry-After", async () => {
    const fetcher = vi.fn(async () => new Response(null, { status: 429, headers: { "Retry-After": "120" } }));
    const provider = createWeatherProvider(fetcher, () => Date.parse("2026-11-22T02:00:00Z"));
    expect(await provider.load(5, -1, "test")).toMatchObject({ status: "unavailable", forecast: null, realtime: null, retryAt: "2026-11-22T02:02:00.000Z" });
    await provider.load(6, -1, "test");
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
  it("retains genuine cached readings and their original timestamp when refresh fails", async () => {
    let time = Date.parse("2026-11-22T02:00:00Z");
    let limited = false;
    const provider = createWeatherProvider(async (url) => limited ? new Response(null, { status: 429 }) : Response.json(String(url).includes("realtime") ? realtime : forecast), () => time);
    await provider.load(5, -1, "test");
    time += 16 * 60 * 1000;
    limited = true;
    expect(await provider.load(5, -1, "test")).toMatchObject({ status: "cached", fetchedAt: "2026-11-22T02:00:00.000Z", forecast });
    time += 7 * 60 * 60 * 1000;
    expect(await provider.load(5, -1, "test")).toMatchObject({ status: "unavailable", forecast: null });
  });
  it("keeps current conditions when only the daily forecast fails", async () => {
    const provider = createWeatherProvider(async url => String(url).includes("realtime") ? Response.json(realtime) : new Response(null, { status: 429 }));
    expect(await provider.load(5, -1, "test")).toMatchObject({ status: "partial", realtime, forecast: null });
  });
  it("shares concurrent requests and reuses fresh cached data", async () => {
    const fetcher = vi.fn(async (url) => Response.json(String(url).includes("realtime") ? realtime : forecast));
    const provider = createWeatherProvider(fetcher);
    await Promise.all([provider.load(5, -1, "test"), provider.load(5, -1, "test")]);
    await provider.load(5, -1, "test");
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
});