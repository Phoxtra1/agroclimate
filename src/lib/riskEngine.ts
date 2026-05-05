// Risk Scoring Engine — deterministic, fast, dependable. Used as a fallback to AI predictions
// and to feed structured signals to the Odeneho AI for second-pass refinement.
import { levelFromScore, type RiskAssessment } from "./aiProviders";

interface WeatherSignals {
  rainProb?: number; // 0..100
  windKph?: number;
  tempC?: number;
  humidity?: number;
}

export function floodRisk(s: WeatherSignals & { riverLevelPct?: number }): RiskAssessment {
  let score = 0;
  if ((s.rainProb ?? 0) > 70) score += 35;
  else if ((s.rainProb ?? 0) > 40) score += 18;
  if ((s.riverLevelPct ?? 0) > 80) score += 45;
  else if ((s.riverLevelPct ?? 0) > 60) score += 25;
  if ((s.humidity ?? 0) > 85) score += 10;
  return {
    category: "flood",
    score: Math.min(100, score),
    level: levelFromScore(score),
    rationale: `Rain ${s.rainProb ?? "?"}%, river ${s.riverLevelPct ?? "?"}%`,
    recommendations: score > 50 ? ["Open drainage", "Move stored grain to higher ground", "Postpone river transport"] : ["Monitor conditions"],
  };
}

export function droughtRisk(s: WeatherSignals & { rainfallMmWeek?: number }): RiskAssessment {
  let score = 0;
  if ((s.rainfallMmWeek ?? 99) < 5) score += 40;
  else if ((s.rainfallMmWeek ?? 99) < 15) score += 20;
  if ((s.tempC ?? 0) > 36) score += 30;
  else if ((s.tempC ?? 0) > 32) score += 15;
  if ((s.humidity ?? 100) < 30) score += 20;
  return {
    category: "drought",
    score: Math.min(100, score),
    level: levelFromScore(score),
    rationale: `Rainfall ${s.rainfallMmWeek ?? "?"}mm/wk, temp ${s.tempC ?? "?"}°C`,
    recommendations: score > 50 ? ["Schedule irrigation", "Mulch beds", "Prioritize drought-tolerant crops"] : ["Continue normal watering"],
  };
}

export function aquacultureOxygenRisk(s: { tempC?: number; ph?: number; dissolvedO2?: number }): RiskAssessment {
  let score = 0;
  if ((s.dissolvedO2 ?? 99) < 3) score += 60;
  else if ((s.dissolvedO2 ?? 99) < 5) score += 30;
  if ((s.tempC ?? 0) > 32) score += 20;
  if ((s.ph ?? 7) < 6 || (s.ph ?? 7) > 9) score += 15;
  return {
    category: "aquaculture-oxygen",
    score: Math.min(100, score),
    level: levelFromScore(score),
    rationale: `O₂ ${s.dissolvedO2 ?? "?"}mg/L, pH ${s.ph ?? "?"}, ${s.tempC ?? "?"}°C`,
    recommendations: score > 50 ? ["Aerate ponds immediately", "Reduce feeding", "Move fingerlings"] : ["Routine monitoring"],
  };
}

export function inventorySpoilageRisk(s: { humidity?: number; tempC?: number; daysStored?: number; perishability?: "low" | "med" | "high" }): RiskAssessment {
  let score = 0;
  const p = s.perishability || "med";
  const pBoost = p === "high" ? 25 : p === "med" ? 10 : 0;
  score += pBoost;
  if ((s.humidity ?? 0) > 75) score += 25;
  if ((s.tempC ?? 0) > 30) score += 20;
  if ((s.daysStored ?? 0) > 14) score += 20;
  return {
    category: "spoilage",
    score: Math.min(100, score),
    level: levelFromScore(score),
    rationale: `RH ${s.humidity ?? "?"}%, ${s.tempC ?? "?"}°C, ${s.daysStored ?? 0}d stored`,
    recommendations: score > 50 ? ["Move stock to cool storage", "Sell or process within 48h", "Inspect for mold"] : ["Routine checks"],
  };
}
