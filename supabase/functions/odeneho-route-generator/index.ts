import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

type Waypoint = { lat: number; lng: number; altitude_m?: number; action?: string };

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const parseCoordinateText = (value: unknown): Waypoint[] => {
  if (Array.isArray(value)) {
    return value
      .map((point) => ({ lat: Number(point?.lat), lng: Number(point?.lng) }))
      .filter((point) => Number.isFinite(point.lat) && Number.isFinite(point.lng));
  }

  if (typeof value !== "string") return [];
  return value
    .split(/\n|;/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [lat, lng] = line.split(/,|\s+/).map((part) => Number(part.trim())).filter(Number.isFinite);
      return { lat, lng };
    })
    .filter((point) => Number.isFinite(point.lat) && Number.isFinite(point.lng));
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);

  try {
    const authorization = req.headers.get("Authorization") || "";
    if (!authorization.startsWith("Bearer ")) return jsonResponse({ error: "Sign in required" }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("SUPABASE_PUBLISHABLE_KEY");
    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!supabaseUrl || !anonKey || !apiKey) return jsonResponse({ error: "Route generator is not configured" }, 500);

    const authCheck = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: { Authorization: authorization, apikey: anonKey },
    });
    if (!authCheck.ok) return jsonResponse({ error: "Session expired. Please sign in again." }, 401);

    const body = await req.json().catch(() => ({}));
    const missionType = String(body.missionType || "mapping").slice(0, 60);
    const routePreference = String(body.routePreference || "grid").slice(0, 40);
    const altitude = Math.max(10, Math.min(400, Number(body.altitude || 50)));
    const speed = Math.max(1, Math.min(25, Number(body.speed || 10)));
    const farmName = String(body.farmName || "Selected farm boundary").slice(0, 120);
    const boundary = parseCoordinateText(body.boundary);

    if (boundary.length < 3) {
      return jsonResponse({ error: "Provide at least three farm boundary coordinates as lat,lng pairs." }, 400);
    }

    const system = "You are Odeneho AI, an agricultural drone mission route planner for West African farms. Generate safe, practical mission waypoints only from provided farm boundaries. If uncertainty exists, state it in advisory_notes. Return only structured tool output.";
    const user = `Farm: ${farmName}\nMission type: ${missionType}\nPreferred route: ${routePreference}\nAltitude meters: ${altitude}\nSpeed m/s: ${speed}\nBoundary coordinates: ${JSON.stringify(boundary)}\n\nCreate mission waypoints, route pattern, estimated coverage hectares, estimated duration minutes, estimated battery percentage, and operational notes. Keep all waypoints inside or on the boundary approximation.`;

    const ai = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [{ role: "system", content: system }, { role: "user", content: user }],
        tools: [{
          type: "function",
          function: {
            name: "generate_drone_route",
            description: "Generated agricultural drone mission route",
            parameters: {
              type: "object",
              properties: {
                route_pattern: { type: "string", enum: ["grid", "perimeter", "spiral", "waypoint", "corridor"] },
                estimated_coverage_ha: { type: "number" },
                estimated_duration_min: { type: "number" },
                estimated_battery_pct: { type: "number" },
                waypoint_spacing_m: { type: "number" },
                waypoints: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      lat: { type: "number" }, lng: { type: "number" }, altitude_m: { type: "number" }, action: { type: "string" },
                    },
                    required: ["lat", "lng", "altitude_m", "action"],
                  },
                },
                advisory_notes: { type: "array", items: { type: "string" } },
                coverage_summary: { type: "string" },
              },
              required: ["route_pattern", "estimated_coverage_ha", "estimated_duration_min", "estimated_battery_pct", "waypoints", "advisory_notes", "coverage_summary"],
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "generate_drone_route" } },
      }),
    });

    if (ai.status === 429) return jsonResponse({ error: "Odeneho AI route generator is rate limited. Try again shortly." }, 429);
    if (ai.status === 402) return jsonResponse({ error: "AI credits exhausted" }, 402);
    if (!ai.ok) return jsonResponse({ error: `Odeneho AI route generation failed (${ai.status})` }, 502);

    const data = await ai.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    const route = toolCall ? JSON.parse(toolCall.function.arguments) : null;
    return jsonResponse({ route: { ...route, boundary, farm_name: farmName, generated_at: new Date().toISOString() } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown route generator error";
    console.error("odeneho-route-generator:", message);
    return jsonResponse({ error: message }, 500);
  }
});