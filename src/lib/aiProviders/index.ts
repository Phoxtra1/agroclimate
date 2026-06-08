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

export interface AIAlertAdvisory {
  category: "weather" | "crop" | "livestock" | "aquaculture" | "environment" | "flight" | "general";
  score: number;
  level: RiskLevel;
  diseaseRisk: string;
  disasterWarning: string;
  advice: string;
  proactiveAlerts: {
    title: string;
    message: string;
    type: "warning" | "danger" | "info" | "success";
  }[];
}

export interface AIEnvironmentalAssessment {
  ecologicalScore: number;
  analysis: string;
  airQualityStatus: "Good" | "Moderate" | "Poor" | "Hazardous";
  disasters: {
    type: string;
    severity: RiskLevel;
    description: string;
  }[];
  agriculturalImpacts: {
    sector: "Crops" | "Livestock" | "Aquaculture";
    status: RiskLevel;
    factors: string[];
  }[];
  flightRisk: {
    severity: RiskLevel;
    factors: string[];
  };
}

export interface AIAgroRiskAssessment {
  floodScore: number;
  waterloggingScore: number;
  erosionScore: number;
  landslideScore: number;
  climateScore: number;
  vulnerabilityScore: number;
  terrainAnalysis: string;
  suitability: { crop: string; suitability: "high" | "medium" | "low"; notes: string }[];
  recommendations: string[];
}

export interface OdenehoProvider {
  id: string;
  generateSummary(req: SummaryRequest): Promise<string>;
  generatePrediction(req: PredictionRequest): Promise<{ headline: string; detail: string; confidence: number }>;
  generateRecommendations(context: Record<string, unknown>): Promise<string[]>;
  generateRiskAssessment(category: string, signals: Record<string, unknown>): Promise<RiskAssessment>;
  chatCompletion(messages: ChatMessage[]): Promise<string>;
  generateAlertsAdvisory(location: string, forecast: any[]): Promise<AIAlertAdvisory[]>;
  generateEnvironmentalAssessment(location: string, forecast: any[]): Promise<AIEnvironmentalAssessment>;
  generateAgroRiskAssessment(location: string, lat: number, lon: number, boundary?: [number, number][], forecast?: any[]): Promise<AIAgroRiskAssessment>;
}

export function levelFromScore(score: number): RiskLevel {
  if (score >= 76) return "critical";
  if (score >= 51) return "high";
  if (score >= 26) return "moderate";
  return "low";
}
