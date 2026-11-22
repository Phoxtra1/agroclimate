import { describe, expect, it, vi } from "vitest";

const { invoke } = vi.hoisted(() => ({ invoke: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { functions: { invoke } } }));

describe("shared weather requests", () => {
  it("shares concurrent dashboard and Satellite calls for the same coordinates", async () => {
    vi.resetModules(); invoke.mockReset();
    invoke.mockResolvedValue({ data: { status: "live" }, error: null });
    const { requestWeather } = await import("@/lib/weatherRequest");
    await Promise.all([requestWeather(5.6037, -0.187), requestWeather(5.6037, -0.187)]);
    expect(invoke).toHaveBeenCalledTimes(1);
  });
  it("applies Retry-After across screens and locations", async () => {
    vi.resetModules(); invoke.mockReset();
    invoke.mockResolvedValue({ data: { status: "unavailable", retryAt: new Date(Date.now() + 120000).toISOString() }, error: null });
    const { requestWeather } = await import("@/lib/weatherRequest");
    await requestWeather(5, -1);
    expect((await requestWeather(6, -1)).data.status).toBe("unavailable");
    expect(invoke).toHaveBeenCalledTimes(1);
  });
});