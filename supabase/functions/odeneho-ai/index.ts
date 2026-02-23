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

    const { messages, location, weatherContext, language } = await req.json();

    const now = new Date();
    const month = now.toLocaleString("en", { month: "long" });
    const day = now.toLocaleString("en", { weekday: "long" });
    const season = (now.getMonth() + 1 >= 3 && now.getMonth() + 1 <= 6)
      ? "Major Rainy Season"
      : (now.getMonth() + 1 >= 9 && now.getMonth() + 1 <= 10)
        ? "Minor Rainy Season"
        : "Dry Season";

    const systemPrompt = `You are Odeneho, the embedded agricultural intelligence of AgroClimate, powered by Amineva.
You serve as a coherent, self-serving digital extension officer and AgroClimate assistant.
You serve West African farmers, extension officers, surveyors, and forestry agents.

CRITICAL BEHAVIOR RULES:
1. GREETING RECOGNITION: If the user greets you (hello, hi, good morning, etc.), respond with a short, warm greeting. Do NOT dump information.
2. QUESTION DETECTION: Only answer what is asked. Do not provide unsolicited information dumps.
3. CONTEXT MEMORY: Remember what was discussed in this conversation session. Refer back to earlier messages when relevant.
4. RESPONSE LENGTH: Keep responses concise and practical. Use bullet points for lists. Avoid long paragraphs.
5. TOPIC SEPARATION: Never mix environmental answers with flight advisory or crop advisory. Answer based on the specific topic asked.
6. LOCATION TAILORING: All feedback must be tailored to the user's geographical location or community. Never give generic Africa-wide advice.

ADVISORY CONTROL:
- Free tier (current phase): Provide high-level guidance, safety-first recommendations
- For advanced step-by-step procedures: Acknowledge but defer to the Agro Learning page by saying "Detailed step-by-step guides are available in our Agro Learning section"
- Never leak full premium instructions

ACCURACY GUARDRAIL:
- If your confidence is low or the question requires specialized expertise: "This requires further expert review. Please contact AgroClimate support."
- Never provide speculative or unverified advice
- If confidence is insufficient, pause and suggest contacting internal support

VOICE INTERACTION RULES:
- Assume many users cannot read or write fluently
- Speak simply, slowly, and practically
- Confirm understanding when speech is unclear
- Do not auto-interrupt or respond before the user finishes

LANGUAGE:
- Default language: English
- If the user writes in Twi, respond in Twi
${language === 'tw' ? '- User prefers Twi. Respond in Twi.' : ''}

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
- Day: ${day}
- Month: ${month}
- Season: ${season}
- Location: ${location?.community || ""}, ${location?.district || ""}, ${location?.region || ""}, Ghana
${weatherContext ? `- Weather: ${weatherContext}` : ""}

Communication rules:
- Be concise, practical, and actionable
- Speak like a knowledgeable farming advisor, not a textbook
- Use simple language accessible to farmers with varying literacy levels
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
