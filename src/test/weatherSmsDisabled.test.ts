import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, renderHook, waitFor } from "@testing-library/react";
import { disabledWeatherSmsResponse } from "../../supabase/functions/weather-sms-alerts/disabled";
import type { WeatherDay } from "@/data/mock-data";

const { invoke, generate } = vi.hoisted(() => ({ invoke: vi.fn(), generate: vi.fn().mockResolvedValue([]) }));
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ user: { id: "test-user" } }) }));
vi.mock("@/lib/aiProviders/registry", () => ({ getActiveProvider: () => ({ generateAlertsAdvisory: generate }) }));
vi.mock("@/integrations/supabase/client", () => {
  const query: Record<string, any> = {};
  for (const method of ["select", "eq", "order", "limit", "insert"]) query[method] = () => query;
  query.then = (resolve: (value: unknown) => unknown) => Promise.resolve({ data: [] }).then(resolve);
  const channel = { on: () => channel, subscribe: () => channel };
  return { supabase: { functions: { invoke }, from: () => query, channel: () => channel, removeChannel: vi.fn() } };
});
import { useUserAlerts } from "@/hooks/useUserAlerts";

afterEach(() => { cleanup(); localStorage.clear(); sessionStorage.clear(); vi.clearAllMocks(); });
describe("disabled weather SMS", () => {
  it("returns disabled status and zero deliveries without an HTTP error for older clients", async () => {
    const response = disabledWeatherSmsResponse({ "Access-Control-Allow-Origin": "*" });
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ status: "disabled", sent: 0 });
  });
  it("keeps critical in-app alerts without automatically invoking SMS", async () => {
    const forecast = [{ tempHigh: 39, tempLow: 25, rainProb: 80, wind: 45, humidity: 95, isoDate: new Date().toISOString() }] as WeatherDay[];
    generate.mockResolvedValue([{ category: "weather", proactiveAlerts: [] }]);
    const { result } = renderHook(() => useUserAlerts(forecast, "Accra"));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.alerts.some(alert => alert.type === "danger")).toBe(true);
    expect(invoke).not.toHaveBeenCalled();
  });
});