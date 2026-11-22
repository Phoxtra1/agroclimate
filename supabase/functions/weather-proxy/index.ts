import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createWeatherProvider } from "../_shared/weather-provider.ts";

const provider = createWeatherProvider();

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { lat, lon } = await req.json();

    if (typeof lat !== "number" || !Number.isFinite(lat) || Math.abs(lat) > 90 || typeof lon !== "number" || !Number.isFinite(lon) || Math.abs(lon) > 180) {
      return new Response(
        JSON.stringify({ error: "lat and lon are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const API_KEY = Deno.env.get("TOMORROW_IO_API_KEY");
    if (!API_KEY) {
      return new Response(JSON.stringify({ status: "unavailable", message: "Weather provider is not configured", forecast: [] }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const data = await provider.load(lat, lon, API_KEY) as { status: string; fetchedAt: string | null; message?: string; retryAt?: string; forecast: any };

    // Transform to WeatherDataPoint[] format
    const timelines = data.forecast?.timelines?.daily ?? [];
    const forecast = timelines.map((day: any) => ({
      date: day.time?.split("T")[0] ?? "",
      temp: day.values?.temperatureMax ?? day.values?.temperature ?? null,
      humidity: day.values?.humidityAvg ?? day.values?.humidity ?? null,
      windSpeed: day.values?.windSpeedMax ?? day.values?.windSpeed ?? null,
      windGust: day.values?.windGustMax ?? day.values?.windGust ?? undefined,
      rainfall: day.values?.rainAccumulationSum ?? null,
      description: day.values?.weatherCodeMax?.toString() ?? "",
      pressure: day.values?.pressureSurfaceLevelAvg ?? undefined,
      visibility: day.values?.visibilityAvg ?? undefined,
      uvIndex: day.values?.uvIndexMax ?? undefined,
      soilMoisture: day.values?.soilMoistureVolumetric0To10 ?? undefined,
    }));

    return new Response(JSON.stringify({ forecast, status: data.status, fetchedAt: data.fetchedAt, message: data.message, retryAt: data.retryAt }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Weather proxy error:", error);
    return new Response(
      JSON.stringify({ status: "unavailable", message: "Weather temporarily unavailable.", forecast: [] }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
