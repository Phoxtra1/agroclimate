import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useFlightAdvisor } from "@/hooks/useFlightAdvisor";

const { invoke } = vi.hoisted(() => ({ invoke: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { functions: { invoke } } }));
const telemetry = { altitude: 0, groundSpeed: 0, verticalSpeed: 0, heading: 0, battery: 100, signalStrength: 0, gpsAccuracy: 0, gpsFix: "none" as const, flightDuration: 0, distanceCovered: 0, cameraStatus: "off" as const };
afterEach(() => { cleanup(); invoke.mockReset(); });
describe("flight weather evidence", () => {
  it("does not evaluate sample or stale environment values as live weather", async () => {
    const { result } = renderHook(() => useFlightAdvisor({ telemetry, status: "disconnected", environment: { windSpeed: 12, source: "sample" } }));
    await act(async () => result.current.evaluate());
    expect(invoke).not.toHaveBeenCalled();
    expect(result.current.advisory).toBeNull();
    expect(result.current.weatherAvailable).toBe(false);
  });
  it("withdraws the previous assessment when measured weather becomes stale", async () => {
    invoke.mockResolvedValue({ data: { advisory: { status: "safe", safety_score: 80 } }, error: null });
    const { result, rerender } = renderHook(({ observedAt }) => useFlightAdvisor({ telemetry, status: "disconnected", environment: { source: "sensor", observedAt } }), { initialProps: { observedAt: new Date().toISOString() } });
    await act(async () => result.current.evaluate());
    expect(result.current.advisory?.safety_score).toBe(80);
    rerender({ observedAt: new Date(Date.now() - 2 * 3600000).toISOString() });
    expect(result.current.advisory).toBeNull();
  });
});