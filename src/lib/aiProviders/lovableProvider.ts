import { supabase } from "@/integrations/supabase/client";
import type { OdenehoProvider, SummaryRequest, PredictionRequest, ChatMessage, RiskAssessment } from "./index";
import { levelFromScore } from "./index";

// Calls the `odeneho-intelligence` edge function which proxies Lovable AI.
// Switching to a future proprietary model only requires swapping this provider.
async function call(action: string, payload: unknown): Promise<any> {
  const { data, error } = await supabase.functions.invoke("odeneho-intelligence", {
    body: { action, payload },
  });
  if (error) throw error;
  return data;
}

export const lovableProvider: OdenehoProvider = {
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
};
