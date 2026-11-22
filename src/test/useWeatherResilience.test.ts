import { act, renderHook, waitFor, cleanup } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
const { request } = vi.hoisted(() => ({ request: vi.fn() }));
vi.mock("@/lib/weatherRequest", () => ({ requestWeather: request }));
import { useWeather } from "@/hooks/useWeather";

afterEach(() => { cleanup(); localStorage.clear(); request.mockReset(); });
describe("weather hook outage handling", () => {
  it("settles loading without data when the provider is unavailable", async () => {
    request.mockResolvedValue({ data: { status: "unavailable", message: "Rate limited" }, error: null });
    const { result } = renderHook(() => useWeather(5, -1));
    await waitFor(() => expect(result.current.error).toBe("Rate limited"));
    expect(result.current.loading).toBe(false);
    expect(result.current.usableForecast).toEqual([]);
    expect(result.current.isLive).toBe(false);
  });
  it("keeps original cached timestamps and withholds old readings from new decisions", async () => {
    const timestamp = Date.now() - 2 * 60 * 60 * 1000;
    localStorage.setItem("agroclimate_weather_cache", JSON.stringify({ lat: 5, lon: -1, timestamp, data: [{ tempHigh: 30, tempLow: 20, isoDate: new Date().toISOString() }] }));
    request.mockResolvedValue({ data: { status: "unavailable" }, error: null });
    const { result } = renderHook(() => useWeather(5, -1));
    await waitFor(() => expect(result.current.error).not.toBe(""));
    expect(result.current.forecast).toHaveLength(1);
    expect(result.current.lastUpdated?.getTime()).toBe(timestamp);
    expect(result.current.usableForecast).toEqual([]);
    act(() => result.current.refresh());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.lastUpdated?.getTime()).toBe(timestamp);
  });
  it("does not carry the previous location's readings into invalid coordinates", async () => {
    request.mockResolvedValue({ data: { status: "unavailable" }, error: null });
    const { result, rerender } = renderHook(({ lat }) => useWeather(lat, -1), { initialProps: { lat: 5 } });
    await waitFor(() => expect(result.current.loading).toBe(false));
    rerender({ lat: NaN });
    expect(result.current.forecast).toEqual([]);
    expect(result.current.source).toBe("none");
  });
});