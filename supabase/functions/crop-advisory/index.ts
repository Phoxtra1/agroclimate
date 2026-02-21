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

    const { weatherData, locationName, location, currentCrops, advisoryType } = await req.json();

    const systemPrompt = `You are an expert agricultural advisor for West African farmers, especially in Ghana. 
You have deep knowledge of:
- Cash crops (cocoa, cashew, oil palm, rubber, coconut, mango, citrus, shea)
- Food crops (maize, rice, yam, cassava, plantain, cocoyam, sorghum, millet)
- Vegetables (tomato, pepper, onion, okra, garden egg, cabbage, lettuce, carrot)
- Livestock (poultry, goats, sheep, cattle, pigs)
- Fish farming (tilapia, catfish)
- Irrigation requirements and water management

Given the current weather, location, and season, provide:
1. Top 5 recommended crops/activities based on current weather, season, and location
2. Specific farming actions to take this week (for crops, livestock, and fish)
3. Weather-related risks and how to mitigate them
4. Whether irrigation support is needed and recommendations
5. Livestock seasonal advisory

Keep advice practical, concise, and actionable for smallholder farmers.
Respond using the structured tool provided.`;

    const district = location?.district || "";
    const region = location?.region || "";
    const community = location?.community || "";

    const userPrompt = `Location: ${community}, ${district}, ${region}, ${locationName || "Ghana"}
Current weather: Temperature ${weatherData?.tempHigh || 30}°C, Humidity ${weatherData?.humidity || 60}%, Rain probability ${weatherData?.rainProb || 0}%, Wind ${weatherData?.wind || 5} km/h, Conditions: ${weatherData?.description || "clear"}
Current month: ${new Date().toLocaleString("en", { month: "long" })}
Season: ${new Date().getMonth() + 1 >= 3 && new Date().getMonth() + 1 <= 6 ? "Major Rainy Season" : new Date().getMonth() + 1 >= 9 && new Date().getMonth() + 1 <= 10 ? "Minor Rainy Season" : "Dry Season"}
${currentCrops ? `Farmer's current crops: ${currentCrops}` : ""}
${advisoryType ? `Focus area: ${advisoryType}` : ""}

What crops, livestock, and fish farming activities should the farmer focus on and what actions should they take this week? Include irrigation advice.`;

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
        tools: [
          {
            type: "function",
            function: {
              name: "provide_crop_advisory",
              description: "Provide structured comprehensive agricultural advisory data",
              parameters: {
                type: "object",
                properties: {
                  recommendedCrops: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        name: { type: "string" },
                        category: { type: "string", enum: ["Cash Crop", "Food Crop", "Vegetable"] },
                        reason: { type: "string" },
                        icon: { type: "string" },
                      },
                      required: ["name", "category", "reason", "icon"],
                    },
                  },
                  weeklyActions: { type: "array", items: { type: "string" } },
                  risks: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        risk: { type: "string" },
                        mitigation: { type: "string" },
                      },
                      required: ["risk", "mitigation"],
                    },
                  },
                  irrigationAdvice: {
                    type: "object",
                    properties: {
                      needed: { type: "boolean" },
                      reason: { type: "string" },
                      method: { type: "string" },
                    },
                    required: ["needed", "reason", "method"],
                  },
                  livestockAdvice: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        animal: { type: "string" },
                        advice: { type: "string" },
                      },
                      required: ["animal", "advice"],
                    },
                  },
                  fishFarmingAdvice: { type: "string" },
                  tip: { type: "string" },
                },
                required: ["recommendedCrops", "weeklyActions", "risks", "irrigationAdvice", "livestockAdvice", "fishFarmingAdvice", "tip"],
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "provide_crop_advisory" } },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limited, try again later" }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted" }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const text = await response.text();
      console.error("AI error:", response.status, text);
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
    console.error("crop-advisory error:", message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
