import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const apiKey = Deno.env.get("TOMORROW_IO_API_KEY");
    if (!apiKey) {
      throw new Error("TOMORROW_IO_API_KEY is not configured");
    }

    const { lat, lon } = await req.json();
    if (!lat || !lon) {
      throw new Error("lat and lon are required");
    }

    // Tomorrow.io Realtime weather
    const realtimeRes = await fetch(
      `https://api.tomorrow.io/v4/weather/realtime?location=${lat},${lon}&units=metric&apikey=${apiKey}`
    );
    const realtime = await realtimeRes.json();

    // Tomorrow.io 5-day forecast (daily)
    const forecastRes = await fetch(
      `https://api.tomorrow.io/v4/weather/forecast?location=${lat},${lon}&timesteps=1d&units=metric&apikey=${apiKey}`
    );
    const forecast = await forecastRes.json();

    return new Response(JSON.stringify({ realtime, forecast }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
