import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

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
    if (!apiKey) return json({ error: "Weather provider is not configured" }, 503);

    const body = await req.json().catch(() => null);
    const lat = body?.lat;
    const lon = body?.lon;
    if (
      typeof lat !== "number" || !Number.isFinite(lat) || lat < -90 || lat > 90 ||
      typeof lon !== "number" || !Number.isFinite(lon) || lon < -180 || lon > 180
    ) {
      return json({ error: "Valid numeric latitude and longitude are required" }, 400);
    }

    const makeUrl = (path: string) => {
      const url = new URL(`https://api.tomorrow.io/v4/weather/${path}`);
      url.searchParams.set("location", `${lat},${lon}`);
      url.searchParams.set("units", "metric");
      url.searchParams.set("apikey", apiKey);
      if (path === "forecast") url.searchParams.set("timesteps", "1d");
      return url.toString();
    };

    // A failed realtime call must not discard an otherwise usable daily forecast.
    const [realtimeResult, forecastResult] = await Promise.allSettled([
      fetch(makeUrl("realtime"), { signal: AbortSignal.timeout(12000) }),
      fetch(makeUrl("forecast"), { signal: AbortSignal.timeout(15000) }),
    ]);

    if (forecastResult.status !== "fulfilled" || !forecastResult.value.ok) {
      const status = forecastResult.status === "fulfilled" ? forecastResult.value.status : 502;
      console.error("[weather] daily forecast provider request failed", status);
      return json({ error: "The weather provider could not return a daily forecast. Retry shortly." }, 502);
    }

    const forecast = await forecastResult.value.json();
    const daily = forecast?.timelines?.daily;
    if (!Array.isArray(daily) || daily.length === 0) {
      return json({ error: "The weather provider returned no daily forecast data." }, 502);
    }

    let realtime: unknown = null;
    if (realtimeResult.status === "fulfilled" && realtimeResult.value.ok) {
      try {
        realtime = await realtimeResult.value.json();
      } catch {
        realtime = null;
      }
    } else {
      console.warn("[weather] realtime conditions unavailable; returning forecast only");
    }

    return json({
      provider: "Tomorrow.io",
      fetchedAt: new Date().toISOString(),
      realtime,
      forecast,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown weather service error";
    console.error("[weather] request failed", message);
    return json({ error: "Weather service temporarily unavailable. Retry shortly." }, 502);
  }
});
