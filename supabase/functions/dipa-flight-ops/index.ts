import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const { telemetry, environment, mission } = await req.json();

    const system = `You are Dipa — an aviation-grade drone flight safety analyst for West African agricultural operations. Be concise, factual, and decisive. If data is missing or low-confidence, say so. Never invent telemetry. Output ONLY via the structured tool.`;

    const user = `Live telemetry: ${JSON.stringify(telemetry)}
Environment: ${JSON.stringify(environment)}
Mission context: ${JSON.stringify(mission || {})}

Assess flight safety RIGHT NOW. Score 0-100 (100=safest). Decide one overall status:
- safe: continue mission
- caution: continue with mitigations
- return_home: recommend RTH now
- emergency_land: land immediately
List concrete alerts (high_wind, rain_risk, low_battery, signal_loss, unsafe_altitude, gps_weak, route_drift, weather_change) only when triggered by the data.`;

    const r = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [{ role: "system", content: system }, { role: "user", content: user }],
        tools: [{
          type: "function",
          function: {
            name: "report_flight_advisory",
            description: "Structured live flight advisory",
            parameters: {
              type: "object",
              properties: {
                safety_score: { type: "number" },
                status: { type: "string", enum: ["safe", "caution", "return_home", "emergency_land"] },
                summary: { type: "string" },
                primary_recommendation: { type: "string" },
                alerts: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      type: { type: "string" },
                      severity: { type: "string", enum: ["info", "warning", "critical"] },
                      message: { type: "string" },
                    },
                    required: ["type", "severity", "message"],
                  },
                },
                route_optimization: { type: "string" },
              },
              required: ["safety_score", "status", "summary", "primary_recommendation", "alerts"],
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "report_flight_advisory" } },
      }),
    });

    if (r.status === 429) return new Response(JSON.stringify({ error: "Rate limited" }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    if (r.status === 402) return new Response(JSON.stringify({ error: "AI credits exhausted" }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    if (!r.ok) throw new Error(`AI gateway error ${r.status}`);

    const data = await r.json();
    const tc = data.choices?.[0]?.message?.tool_calls?.[0];
    const advisory = tc ? JSON.parse(tc.function.arguments) : null;
    return new Response(JSON.stringify({ advisory }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    const m = e instanceof Error ? e.message : "Unknown error";
    console.error("dipa-flight-ops:", m);
    return new Response(JSON.stringify({ error: m }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
