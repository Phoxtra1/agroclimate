// Odeneho AI — Provider Abstraction Layer
// Goal: swap providers (Lovable AI Gateway, OpenAI, future proprietary models, local SLMs)
// without rewriting feature code. Every feature talks to the unified Provider interface.

export type RiskLevel = "low" | "moderate" | "high" | "critical";

export interface RiskAssessment {
  category: string;
  score: number; // 0..100
  level: RiskLevel;
  rationale: string;
  recommendations: string[];
}

export interface SummaryRequest {
  topic: string;
  data: Record<string, unknown>;
  audience?: "farmer" | "admin" | "buyer";
  language?: string;
}

export interface PredictionRequest {
  domain: "weather" | "crop" | "livestock" | "aquaculture" | "inventory" | "market" | "transport";
  data: Record<string, unknown>;
  horizonHours?: number;
}

export interface ChatMessage { role: "system" | "user" | "assistant"; content: string; }

export interface OdenehoProvider {
  id: string;
  generateSummary(req: SummaryRequest): Promise<string>;
  generatePrediction(req: PredictionRequest): Promise<{ headline: string; detail: string; confidence: number }>;
  generateRecommendations(context: Record<string, unknown>): Promise<string[]>;
  generateRiskAssessment(category: string, signals: Record<string, unknown>): Promise<RiskAssessment>;
  chatCompletion(messages: ChatMessage[]): Promise<string>;
}

export function levelFromScore(score: number): RiskLevel {
  if (score >= 76) return "critical";
  if (score >= 51) return "high";
  if (score >= 26) return "moderate";
  return "low";
}
