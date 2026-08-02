import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const DEFAULT_MODEL = "google/gemini-3-flash-preview";
const ALLOWED_MODELS = new Set([
  "google/gemini-3-flash-preview",
  "google/gemini-2.5-pro",
  "google/gemini-3.5-flash",
  "google/gemini-2.5-flash",
  "openai/gpt-5.5",
  "openai/gpt-5",
  "openai/gpt-5-mini",
]);
const pickModel = (m?: string) => (m && ALLOWED_MODELS.has(m)) ? m : DEFAULT_MODEL;

interface ToolCallPayload {
  action: "summary" | "prediction" | "recommendations" | "risk" | "chat";
  payload: any;
}

const SYSTEM_PROMPT =
  "You are Dipa, the centralized operational intelligence engine for AgroClimate. " +
  "Provide concise, factual, action-oriented insight for African farmers, admins and traders. " +
  "If signals are weak, state the uncertainty. Never invent precise medical/chemical dosages.";

function buildToolForAction(action: string) {
  switch (action) {
    case "summary":
      return {
        name: "emit_summary",
        parameters: {
          type: "object",
          properties: { text: { type: "string" } },
          required: ["text"],
          additionalProperties: false,
        },
      };
    case "prediction":
      return {
        name: "emit_prediction",
        parameters: {
          type: "object",
          properties: {
            headline: { type: "string" },
            detail: { type: "string" },
            confidence: { type: "number" },
          },
          required: ["headline", "detail", "confidence"],
          additionalProperties: false,
        },
      };
    case "recommendations":
      return {
        name: "emit_recommendations",
        parameters: {
          type: "object",
          properties: { items: { type: "array", items: { type: "string" } } },
          required: ["items"],
          additionalProperties: false,
        },
      };
    case "risk":
      return {
        name: "emit_risk",
        parameters: {
          type: "object",
          properties: {
            score: { type: "number" },
            rationale: { type: "string" },
            recommendations: { type: "array", items: { type: "string" } },
          },
          required: ["score", "rationale", "recommendations"],
          additionalProperties: false,
        },
      };
    case "chat":
      return null;
    default:
      return null;
  }
}

function userPromptFor({ action, payload }: ToolCallPayload): string {
  switch (action) {
    case "summary":
      return `Produce a concise operational summary for topic "${payload?.topic}". Audience: ${payload?.audience || "farmer"}. Data: ${JSON.stringify(payload?.data || {}).slice(0, 4000)}`;
    case "prediction":
      return `Predict ${payload?.domain} for the next ${payload?.horizonHours || 72} hours. Signals: ${JSON.stringify(payload?.data || {}).slice(0, 4000)}`;
    case "recommendations":
      return `Provide 3-6 actionable recommendations for this context: ${JSON.stringify(payload || {}).slice(0, 4000)}`;
    case "risk":
      return `Assess ${payload?.category} risk on a 0-100 scale based on signals: ${JSON.stringify(payload?.signals || {}).slice(0, 4000)}`;
    default:
      return "";
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "AI not configured" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const body = (await req.json()) as ToolCallPayload & { model?: string };
    const MODEL = pickModel(body?.model);

    if (body.action === "chat") {
      const messages = Array.isArray(body.payload?.messages) ? body.payload.messages : [];
      const resp = await fetch(GATEWAY_URL, {
        method: "POST",
        headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: MODEL,
          messages: [{ role: "system", content: SYSTEM_PROMPT }, ...messages],
        }),
      });
      if (!resp.ok) {
        const t = await resp.text();
        return new Response(JSON.stringify({ error: `AI error ${resp.status}: ${t.slice(0, 200)}` }), { status: resp.status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const j = await resp.json();
      const text = j?.choices?.[0]?.message?.content || "";
      return new Response(JSON.stringify({ text }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const tool = buildToolForAction(body.action);
    if (!tool) {
      return new Response(JSON.stringify({ error: "Unknown action" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const resp = await fetch(GATEWAY_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userPromptFor(body) },
        ],
        tools: [{ type: "function", function: { ...tool, description: `Emit ${body.action} structured output` } }],
        tool_choice: { type: "function", function: { name: tool.name } },
      }),
    });

    if (!resp.ok) {
      const t = await resp.text();
      if (resp.status === 429) return new Response(JSON.stringify({ error: "Rate limit hit, try again shortly." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      if (resp.status === 402) return new Response(JSON.stringify({ error: "AI credits exhausted." }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      return new Response(JSON.stringify({ error: `AI error ${resp.status}: ${t.slice(0, 200)}` }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const j = await resp.json();
    const args = j?.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
    let parsed: any = {};
    try { parsed = args ? JSON.parse(args) : {}; } catch { parsed = {}; }
    return new Response(JSON.stringify(parsed), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
