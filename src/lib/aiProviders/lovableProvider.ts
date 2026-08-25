import { supabase } from "@/integrations/supabase/client";
import type { DipaProvider, SummaryRequest, PredictionRequest, ChatMessage, RiskAssessment, AIAlertAdvisory, AIEnvironmentalAssessment, AIAgroRiskAssessment } from "./index";
import { levelFromScore } from "./index";

import { getActiveModelSync } from "@/hooks/useAiModel";

// Calls the `dipa-intelligence` edge function which proxies Lovable AI.
// The active model is chosen in the admin AI Layer and forwarded per call so
// every AgroClimate component uses the currently selected engine.
async function call(action: string, payload: unknown): Promise<any> {
  const model = getActiveModelSync().gatewayModel;
  const started = performance.now();
  const { data, error } = await supabase.functions.invoke("dipa-intelligence", {
    body: { action, payload, model },
  });
  // Fire-and-forget usage log (best effort)
  try {
    const { data: { user } } = await supabase.auth.getUser();
    await supabase.from("ai_usage_logs").insert({
      user_id: user?.id ?? null, model, action,
      latency_ms: Math.round(performance.now() - started),
      ok: !error, error: error?.message?.slice(0, 500) ?? null,
    });
  } catch { /* logging is non-critical */ }
  if (error) throw error;
  return data;
}

export const lovableProvider: DipaProvider = {
  id: "lovable-ai-gateway",
  async generateSummary(req: SummaryRequest) {
    const r = await call("summary", req);
    return String(r?.text || "");
  },
  async generatePrediction(req: PredictionRequest) {
    const r = await call("prediction", req);
    return { headline: r?.headline || "", detail: r?.detail || "", confidence: Number(r?.confidence ?? 0.5) };
  },
  async generateRecommendations(context: Record<string, unknown>) {
    const r = await call("recommendations", context);
    return Array.isArray(r?.items) ? r.items.map(String) : [];
  },
  async generateRiskAssessment(category: string, signals: Record<string, unknown>): Promise<RiskAssessment> {
    const r = await call("risk", { category, signals });
    const score = Math.max(0, Math.min(100, Number(r?.score ?? 0)));
    return {
      category,
      score,
      level: levelFromScore(score),
      rationale: r?.rationale || "",
      recommendations: Array.isArray(r?.recommendations) ? r.recommendations.map(String) : [],
    };
  },
  async chatCompletion(messages: ChatMessage[]) {
    const r = await call("chat", { messages });
    return String(r?.text || "");
  },
  async generateAlertsAdvisory(location: string, forecast: any[]): Promise<AIAlertAdvisory[]> {
    const prompt = `Analyze the 7-day weather forecast for the location: ${location}.
Forecast data: ${JSON.stringify(forecast)}.

Perform a comprehensive agricultural risk assessment and generate proactive alerts for each of the following 6 categories:
1. "weather"
2. "crop"
3. "livestock"
4. "aquaculture"
5. "environment"
6. "flight"

For each category, provide:
- A risk score (0 to 100)
- A risk level ("low", "moderate", "high", or "critical")
- Disease outbreak risk (e.g. Blight/Rust for crops, Heat Stress/Pneumonia for livestock, Fungus for fish, or "None")
- Potential disasters or hazards (e.g. Flooding, Drought, Fire, Severe Storms, or "None")
- Highly accurate, actionable proactive advice for the farmer or surveyor
- 1 to 2 detailed proactive alerts (each having a title, message, and severity type: "warning", "danger", "info", or "success")

Respond ONLY with a valid, clean JSON array of objects with the following schema:
[
  {
    "category": "weather" | "crop" | "livestock" | "aquaculture" | "environment" | "flight",
    "score": number,
    "level": "low" | "moderate" | "high" | "critical",
    "diseaseRisk": string,
    "disasterWarning": string,
    "advice": string,
    "proactiveAlerts": [
      {
        "title": string,
        "message": string,
        "type": "warning" | "danger" | "info" | "success"
      }
    ]
  }
]
Do not wrap your output in markdown code blocks like \`\`\`json. Return only the raw JSON.`;

    const text = await lovableProvider.chatCompletion([
      { role: "system", content: "You are an expert agricultural climate analysis engine. Return only clean raw JSON as requested, without any markdown formatting or surrounding backticks." },
      { role: "user", content: prompt }
    ]);

    try {
      const cleanJson = text.replace(/```json/g, "").replace(/```/g, "").trim();
      return JSON.parse(cleanJson);
    } catch (e) {
      console.error("Failed to parse AI Alerts Advisory response:", text, e);
      return [];
    }
  },
  async generateEnvironmentalAssessment(location: string, forecast: any[]): Promise<AIEnvironmentalAssessment> {
    const prompt = `Analyze the 7-day weather forecast for the location: ${location}.
Forecast data: ${JSON.stringify(forecast)}.

Perform a holistic ecological and environmental assessment of this community.
Provide:
- An overall ecological health score (0 to 100, where 100 is pristine/stable, and 0 is severe distress/disaster)
- A concise, expert, factual paragraph summarizing the current environmental conditions and how they impact local farming/ecology.
- Air Quality Status: "Good" | "Moderate" | "Poor" | "Hazardous"
- Any disaster risks (type, severity: "low" | "moderate" | "high" | "critical", and description)
- Agricultural Impacts for "Crops", "Livestock", and "Aquaculture" (sector, status: "low" | "moderate" | "high" | "critical", and bulleted factors/stressors)
- Flight and Airborne risk status (drone operation safety wind shear and particulate risk: severity "low" | "moderate" | "high" | "critical", and factors)

Respond ONLY with a valid, clean JSON object with the following schema:
{
  "ecologicalScore": number,
  "analysis": string,
  "airQualityStatus": "Good" | "Moderate" | "Poor" | "Hazardous",
  "disasters": [
    { "type": string, "severity": "low" | "moderate" | "high" | "critical", "description": string }
  ],
  "agriculturalImpacts": [
    { "sector": "Crops" | "Livestock" | "Aquaculture", "status": "low" | "moderate" | "high" | "critical", "factors": [string] }
  ],
  "flightRisk": {
    "severity": "low" | "moderate" | "high" | "critical",
    "factors": [string]
  }
}
Do not wrap your output in markdown code blocks like \`\`\`json. Return only the raw JSON.`;

    const text = await lovableProvider.chatCompletion([
      { role: "system", content: "You are an expert environmental and agricultural sensor intelligence engine. Return only clean raw JSON as requested, without any markdown formatting or surrounding backticks." },
      { role: "user", content: prompt }
    ]);

    try {
      const cleanJson = text.replace(/```json/g, "").replace(/```/g, "").trim();
      return JSON.parse(cleanJson);
    } catch (e) {
      console.error("Failed to parse AI Environmental Assessment response:", text, e);
      throw e;
    }
  },
  async generateAgroRiskAssessment(location: string, lat: number, lon: number, boundary?: [number, number][], forecast?: any[]): Promise<AIAgroRiskAssessment> {
    const boundaryStr = boundary ? JSON.stringify(boundary) : "Not specified";
    const prompt = `Analyze the environmental and terrain risks for the agricultural plot/location at: ${location} (Coordinates: Lat ${lat}, Lon ${lon}).
Boundary vertices: ${boundaryStr}.
7-Day weather forecast: ${JSON.stringify(forecast)}.

Perform a comprehensive AgroRisk analysis. You must output the following metrics:
- floodScore: Risk of flooding (0 to 100)
- waterloggingScore: Risk of water ponding or poor drainage (0 to 100)
- erosionScore: Risk of soil erosion from rain, wind, and terrain slope (0 to 100)
- landslideScore: Risk of slope failure/landslide (0 to 100)
- climateScore: Risk from temperature extremes, droughts, or humidity stress (0 to 100)
- vulnerabilityScore: Combined farm vulnerability index (0 to 100)
- terrainAnalysis: Summary of the terrain topography (slopes, hills, valleys) and how it affects risk
- suitability: Array of crop suitability mappings. For each crop (e.g. Maize, Cassava, Rice, Yam, Cocoa, Vegetables), specify a suitability level ("high", "medium", or "low") and explanatory notes.
- recommendations: List of 4-6 specific, actionable agricultural recommendations for this location.

Respond ONLY with a valid, clean JSON object with the following schema:
{
  "floodScore": number,
  "waterloggingScore": number,
  "erosionScore": number,
  "landslideScore": number,
  "climateScore": number,
  "vulnerabilityScore": number,
  "terrainAnalysis": string,
  "suitability": [
    { "crop": string, "suitability": "high" | "medium" | "low", "notes": string }
  ],
  "recommendations": [string]
}
Do not wrap your output in markdown code blocks like \`\`\`json. Return only the raw JSON.`;

    const text = await lovableProvider.chatCompletion([
      { role: "system", content: "You are an expert agricultural risk intelligence and terrain analysis engine. Return only clean raw JSON as requested, without any markdown formatting or surrounding backticks." },
      { role: "user", content: prompt }
    ]);

    try {
      const cleanJson = text.replace(/```json/g, "").replace(/```/g, "").trim();
      return JSON.parse(cleanJson);
    } catch (e) {
      console.error("Failed to parse AI AgroRisk Assessment response:", text, e);
      throw e;
    }
  }
};
