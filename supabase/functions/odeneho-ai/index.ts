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

    const { messages, location, weatherContext } = await req.json();

    const now = new Date();
    const month = now.toLocaleString("en", { month: "long" });
    const season = (now.getMonth() + 1 >= 3 && now.getMonth() + 1 <= 6)
      ? "Major Rainy Season"
      : (now.getMonth() + 1 >= 9 && now.getMonth() + 1 <= 10)
        ? "Minor Rainy Season"
        : "Dry Season";

    const systemPrompt = `You are Odeneho AI, a trusted agricultural intelligence assistant powered by Amineva for AgroClimate.
You serve West African farmers, extension officers, surveyors, and forestry agents.

Your expertise covers:
- Weather and climate patterns across West Africa
- Crop production (cash crops, food crops, vegetables)
- Livestock rearing (poultry, goats, sheep, cattle, pigs)
- Fish farming (tilapia, catfish)
- Irrigation and water management
- Food safety and post-harvest handling
- Environmental monitoring and disaster preparedness
- Drone flight advisory for agricultural operations

Current context:
- Month: ${month}
- Season: ${season}
- Location: ${location?.community || ""}, ${location?.district || ""}, ${location?.region || ""}, Ghana
${weatherContext ? `- Weather: ${weatherContext}` : ""}

Communication rules:
- Be concise, practical, and actionable
- Speak like a knowledgeable farming advisor, not a textbook
- Use simple language accessible to farmers with varying literacy levels
- When a question requires paid/premium features, politely mention this
- Always consider the current season and location in your advice
- Do not use unnecessary dashes in your responses
- Format responses with clear sections when covering multiple topics`;

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
          ...messages,
        ],
        stream: true,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limited. Please try again shortly." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Please add credits." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const text = await response.text();
      console.error("AI error:", response.status, text);
      throw new Error("AI gateway error");
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("odeneho-ai error:", message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
