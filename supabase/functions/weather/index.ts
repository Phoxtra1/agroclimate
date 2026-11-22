import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createWeatherProvider } from "../_shared/weather-provider.ts";

const provider = createWeatherProvider();

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Max-Age": "86400",
  "Cache-Control": "no-store",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const apiKey = Deno.env.get("TOMORROW_IO_API_KEY");
    if (!apiKey) return json({ status: "unavailable", message: "Weather provider is not configured", forecast: null, realtime: null });

    const body = await req.json().catch(() => null);
    const lat = body?.lat;
    const lon = body?.lon;
    if (
      typeof lat !== "number" || !Number.isFinite(lat) || lat < -90 || lat > 90 ||
      typeof lon !== "number" || !Number.isFinite(lon) || lon < -180 || lon > 180
    ) {
      return json({ error: "Valid numeric latitude and longitude are required" }, 400);
    }

    return json(await provider.load(lat, lon, apiKey));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown weather service error";
    console.error("[weather] request failed", message);
    return json({ status: "unavailable", message: "Weather service temporarily unavailable. Retry shortly.", forecast: null, realtime: null });
  }
});
