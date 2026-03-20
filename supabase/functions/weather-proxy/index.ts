import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

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

    if (!lat || !lon) {
      return new Response(
        JSON.stringify({ error: "lat and lon are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const API_KEY = Deno.env.get("TOMORROW_IO_API_KEY");
    if (!API_KEY) {
      throw new Error("TOMORROW_IO_API_KEY is not configured");
    }

    const url = `https://api.tomorrow.io/v4/weather/forecast?location=${lat},${lon}&timesteps=1d&units=metric&apikey=${API_KEY}`;

    const response = await fetch(url);
    const data = await response.json();

    if (!response.ok) {
      throw new Error(`Tomorrow.io API error [${response.status}]: ${JSON.stringify(data)}`);
    }

    // Transform to WeatherDataPoint[] format
    const timelines = data?.timelines?.daily ?? [];
    const forecast = timelines.map((day: any) => ({
      date: day.time?.split("T")[0] ?? "",
      temp: day.values?.temperatureMax ?? day.values?.temperature ?? 0,
      humidity: day.values?.humidityAvg ?? day.values?.humidity ?? 0,
      windSpeed: day.values?.windSpeedMax ?? day.values?.windSpeed ?? 0,
      windGust: day.values?.windGustMax ?? day.values?.windGust ?? undefined,
      rainfall: day.values?.precipitationIntensityMax ?? day.values?.rainIntensity ?? 0,
      description: day.values?.weatherCodeMax?.toString() ?? "",
      pressure: day.values?.pressureSurfaceLevelAvg ?? undefined,
      visibility: day.values?.visibilityAvg ?? undefined,
      uvIndex: day.values?.uvIndexMax ?? undefined,
      soilMoisture: day.values?.soilMoistureVolumetric0To10 ?? undefined,
    }));

    return new Response(JSON.stringify({ forecast }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Weather proxy error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
