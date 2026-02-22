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
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const { missionType, targetLocation, plannedDate, droneType, altitude, weatherData } = await req.json();

    const systemPrompt = `You are a drone flight safety advisor for agricultural operations in West Africa.
Evaluate flight conditions and provide clear Go/Caution/No-Go recommendations.

Consider: wind speed, rainfall probability, visibility, dust/haze, temperature, humidity, turbulence risk.
Also consider drone type limitations and mission-specific requirements.

Respond using the structured tool provided.`;

    const userPrompt = `Evaluate drone flight conditions:
Mission type: ${missionType || "monitoring"}
Target location: ${targetLocation || "Not specified"}
Planned date/time: ${plannedDate || "Now"}
Drone type: ${droneType || "Generic multirotor"}
Planned altitude: ${altitude || "50"}m

Current weather at location:
- Temperature: ${weatherData?.tempHigh || 30}°C
- Humidity: ${weatherData?.humidity || 60}%
- Wind speed: ${weatherData?.wind || 5} km/h
- Rain probability: ${weatherData?.rainProb || 0}%
- Conditions: ${weatherData?.description || "clear"}

Provide flight safety advisory.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        tools: [{
          type: "function",
          function: {
            name: "provide_flight_advisory",
            description: "Provide structured drone flight advisory",
            parameters: {
              type: "object",
              properties: {
                status: { type: "string", enum: ["safe", "caution", "no_fly"] },
                statusLabel: { type: "string" },
                summary: { type: "string" },
                windAssessment: { type: "string" },
                visibilityAssessment: { type: "string" },
                precipitationRisk: { type: "string" },
                temperatureNote: { type: "string" },
                recommendedWindow: { type: "string" },
                precautions: { type: "array", items: { type: "string" } },
                alternativeActions: { type: "array", items: { type: "string" } },
              },
              required: ["status", "statusLabel", "summary", "windAssessment", "visibilityAssessment", "precipitationRisk", "recommendedWindow", "precautions"],
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "provide_flight_advisory" } },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limited" }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted" }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error("AI gateway error");
    }

    const aiData = await response.json();
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    const advisory = toolCall ? JSON.parse(toolCall.function.arguments) : null;

    return new Response(JSON.stringify({ advisory }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("drone-advisory error:", message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
