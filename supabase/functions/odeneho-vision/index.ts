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

    const { imageBase64, imageUrl, context } = await req.json();
    if (!imageBase64 && !imageUrl) throw new Error("imageBase64 or imageUrl required");

    const system = `You are Odeneho Vision — an expert aerial analyst for agriculture and environment in West Africa. Analyze the drone image and return STRUCTURED findings only via the tool. Be honest about uncertainty — never invent diseases. Avoid specific chemical dosages.`;

    const imagePart = imageBase64
      ? { type: "image_url", image_url: { url: `data:image/jpeg;base64,${imageBase64}` } }
      : { type: "image_url", image_url: { url: imageUrl } };

    const r = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-pro",
        messages: [
          { role: "system", content: system },
          {
            role: "user",
            content: [
              { type: "text", text: `Analyze for: crop stress, pest damage, disease signs, flood/standing water, dry zones, nutrient deficiency, erosion, water accumulation, fire risk, vegetation health. Context: ${JSON.stringify(context || {})}` },
              imagePart,
            ],
          },
        ],
        tools: [{
          type: "function",
          function: {
            name: "report_vision_findings",
            description: "Structured aerial vision findings",
            parameters: {
              type: "object",
              properties: {
                overall_health_score: { type: "number" },
                summary: { type: "string" },
                detections: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      category: { type: "string", enum: ["crop_stress","pest_damage","disease","flood","dry_zone","nutrient_deficiency","erosion","water_accumulation","fire_risk","vegetation_health","other"] },
                      observation: { type: "string" },
                      risk_score: { type: "number" },
                      recommended_action: { type: "string" },
                      confidence: { type: "string", enum: ["low", "moderate", "high"] },
                    },
                    required: ["category", "observation", "risk_score", "recommended_action", "confidence"],
                  },
                },
              },
              required: ["overall_health_score", "summary", "detections"],
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "report_vision_findings" } },
      }),
    });

    if (r.status === 429) return new Response(JSON.stringify({ error: "Rate limited" }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    if (r.status === 402) return new Response(JSON.stringify({ error: "AI credits exhausted" }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    if (!r.ok) throw new Error(`AI gateway error ${r.status}`);

    const data = await r.json();
    const tc = data.choices?.[0]?.message?.tool_calls?.[0];
    const findings = tc ? JSON.parse(tc.function.arguments) : null;
    return new Response(JSON.stringify({ findings }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    const m = e instanceof Error ? e.message : "Unknown error";
    console.error("odeneho-vision:", m);
    return new Response(JSON.stringify({ error: m }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
