// Risk Scoring Engine — deterministic, fast, dependable. Used as a fallback to AI predictions
// and to feed structured signals to the Dipa for second-pass refinement.
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

export interface LocalAgroRiskResult {
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

export function calculateAgroRiskLocal(
  lat: number,
  lon: number,
  boundary: [number, number][] | undefined,
  forecast: any[],
  incidents: { lat: number; lon: number; type: string; date: string }[] = []
): LocalAgroRiskResult {
  const today = forecast?.[0] || {};
  const temp = today.tempHigh ?? today.temp ?? 28;
  const humidity = today.humidity ?? 65;
  const wind = today.wind ?? 10;
  const rainProb = today.rainProb ?? 0;
  const rainMm = today.rainMm ?? 0;
  const soilMoisture = today.soilMoisture ?? 40;

  // 1. Terrain & Elevation details (Hills, Valleys, Slopes)
  let slope = 2; // degrees
  let terrainType: "Flat Plains" | "Valley" | "Gentle Slope" | "Steep Hills" = "Flat Plains";

  const isHilly = lat > 6.2 && lon > -0.6 && lat < 7.8;
  const isVolta = lat > 5.9 && lat < 9.6 && lon > -1.5 && lon < 0.2;

  if (isHilly) {
    slope = boundary && boundary.length > 2 ? 14 + (lat % 0.01) * 800 : 12;
    terrainType = slope > 15 ? "Steep Hills" : "Gentle Slope";
  } else if (isVolta) {
    slope = 1.5;
    terrainType = "Valley";
  } else {
    slope = 3.5;
    terrainType = "Gentle Slope";
  }

  // If a boundary polygon is defined, introduce some variation to show distribution
  const polygonSpan = boundary && boundary.length > 2 
    ? Math.max(...boundary.map(b => b[0])) - Math.min(...boundary.map(b => b[0]))
    : 0;
  if (polygonSpan > 0.001) {
    slope += polygonSpan * 500;
  }
  slope = Math.min(45, Math.round(slope * 10) / 10);

  // 2. Incident Proximity Boosts
  let nearbyFloodIncident = false;
  let nearbyLandslideIncident = false;
  let nearbyErosionIncident = false;
  let nearbyDroughtIncident = false;

  incidents.forEach(inc => {
    const dLat = (inc.lat - lat) * 111; // km
    const dLon = (inc.lon - lon) * 111 * Math.cos(lat * Math.PI / 180);
    const dist = Math.sqrt(dLat * dLat + dLon * dLon);
    if (dist < 5.0) {
      const type = inc.type.toLowerCase();
      if (type.includes("flood") || type.includes("waterlog")) nearbyFloodIncident = true;
      if (type.includes("landslide")) nearbyLandslideIncident = true;
      if (type.includes("erosion")) nearbyErosionIncident = true;
      if (type.includes("drought")) nearbyDroughtIncident = true;
    }
  });

  // 3. Score Calculations
  let floodScore = 0;
  if (isVolta) floodScore += 30; // base risk in floodplain
  floodScore += (rainProb * 0.4);
  floodScore += (rainMm * 0.8);
  if (soilMoisture > 70) floodScore += 15;
  if (nearbyFloodIncident) floodScore += 35;
  floodScore = Math.round(Math.min(100, Math.max(5, floodScore)));

  let waterloggingScore = 0;
  if (terrainType === "Valley") waterloggingScore += 25;
  waterloggingScore += (soilMoisture * 0.6);
  waterloggingScore += (rainMm * 0.5);
  if (nearbyFloodIncident) waterloggingScore += 20;
  waterloggingScore = Math.round(Math.min(100, Math.max(5, waterloggingScore)));

  let erosionScore = 0;
  erosionScore += (slope * 1.8);
  erosionScore += (wind * 0.8);
  erosionScore += (rainMm * 0.5);
  if (nearbyErosionIncident) erosionScore += 25;
  erosionScore = Math.round(Math.min(100, Math.max(5, erosionScore)));

  let landslideScore = 0;
  if (slope > 10) {
    landslideScore += (slope * 2.2);
    landslideScore += (soilMoisture * 0.3);
    landslideScore += (rainMm * 0.6);
    if (nearbyLandslideIncident) landslideScore += 30;
  } else {
    landslideScore = slope * 0.5;
  }
  landslideScore = Math.round(Math.min(100, Math.max(0, landslideScore)));

  let climateScore = 0;
  if (temp > 33) climateScore += (temp - 33) * 8; // heat stress
  if (soilMoisture < 25) climateScore += (25 - soilMoisture) * 2; // dry soil
  if (nearbyDroughtIncident) climateScore += 30;
  climateScore = Math.round(Math.min(100, Math.max(5, climateScore)));

  let vulnerabilityScore = (
    floodScore * 0.25 + 
    waterloggingScore * 0.20 + 
    erosionScore * 0.20 + 
    landslideScore * 0.20 + 
    climateScore * 0.15
  );
  
  const maxSubScore = Math.max(floodScore, waterloggingScore, erosionScore, landslideScore, climateScore);
  if (maxSubScore > 75) {
    vulnerabilityScore = vulnerabilityScore * 0.7 + maxSubScore * 0.3;
  }
  vulnerabilityScore = Math.round(Math.min(100, Math.max(5, vulnerabilityScore)));

  // 4. Terrain Narrative
  let terrainAnalysis = `Terrain classification: ${terrainType}. Average slope is estimated at ${slope}°. `;
  if (terrainType === "Steep Hills") {
    terrainAnalysis += "High surface run-off velocity and gravitational slip hazards are present. Soil structural reinforcement is recommended.";
  } else if (terrainType === "Valley") {
    terrainAnalysis += "Low elevation drainage sink. Prone to surface water pooling and silt accumulation from adjacent slopes.";
  } else {
    terrainAnalysis += "Relatively stable gentle gradient. Minor susceptibility to sheet wash erosion during heavy downpours.";
  }

  // 5. Crop Suitability
  const suitability: LocalAgroRiskResult["suitability"] = [];
  
  let maizeLevel: "high" | "medium" | "low" = "high";
  let maizeNotes = "Grows well in standard soils.";
  if (waterloggingScore > 60 || floodScore > 70) {
    maizeLevel = "low";
    maizeNotes = "Prone to root rot in waterlogged fields.";
  } else if (waterloggingScore > 40 || slope > 15) {
    maizeLevel = "medium";
    maizeNotes = "Requires raised beds or contour planting on slopes.";
  }
  suitability.push({ crop: "Maize", suitability: maizeLevel, notes: maizeNotes });

  let riceLevel: "high" | "medium" | "low" = "low";
  let riceNotes = "Requires high water volume.";
  if (terrainType === "Valley" && waterloggingScore > 50 && slope < 5) {
    riceLevel = "high";
    riceNotes = "Excellent lowland valley conditions for paddy rice cultivation.";
  } else if (slope < 10) {
    riceLevel = "medium";
    riceNotes = "Can be cultivated if bunds are established to retain moisture.";
  } else {
    riceLevel = "low";
    riceNotes = "Not suitable for steep slopes without terracing.";
  }
  suitability.push({ crop: "Rice", suitability: riceLevel, notes: riceNotes });

  let cassavaLevel: "high" | "medium" | "low" = "high";
  let cassavaNotes = "Drought-hardy tuber crop.";
  if (floodScore > 60 || waterloggingScore > 50) {
    cassavaLevel = "low";
    cassavaNotes = "Critical warning: root tubers will decay rapidly under waterlogging.";
  } else if (slope > 20) {
    cassavaLevel = "medium";
    cassavaNotes = "Risk of soil erosion exposing roots. Mulching is required.";
  }
  suitability.push({ crop: "Cassava", suitability: cassavaLevel, notes: cassavaNotes });

  let vegLevel: "high" | "medium" | "low" = "high";
  let vegNotes = "Short growth cycles allow flexible scheduling.";
  if (wind > 30 || floodScore > 50) {
    vegLevel = "low";
    vegNotes = "Delicate leaves and roots vulnerable to physical storm damage.";
  } else if (waterloggingScore > 40 || climateScore > 50) {
    vegLevel = "medium";
    vegNotes = "Requires drip irrigation during dry spells and raised beds.";
  }
  suitability.push({ crop: "Vegetables", suitability: vegLevel, notes: vegNotes });

  let yamLevel: "high" | "medium" | "low" = "high";
  let yamNotes = "Deep rooting tuber. High yields in loam.";
  if (waterloggingScore > 50) {
    yamLevel = "low";
    yamNotes = "Tuber decay risk. Soil saturation exceeds tolerance threshold.";
  } else if (slope > 12) {
    yamLevel = "medium";
    yamNotes = "Plant in mounds across the contour to avoid erosion.";
  }
  suitability.push({ crop: "Yam", suitability: yamLevel, notes: yamNotes });

  // 6. Actionable Recommendations
  const recommendations: string[] = [];
  if (waterloggingScore > 50) {
    recommendations.push("Establish open deep-cut drainage channels to discharge excess water.");
  }
  if (floodScore > 60) {
    recommendations.push("Avoid planting flood-sensitive crops during this high-risk forecast window.");
    recommendations.push("Delay planting schedules until cumulative rainfall projections decrease.");
  }
  if (erosionScore > 45) {
    recommendations.push("Apply mulch covers and plant vetiver grass rows along terrain contours to bind topsoil.");
  }
  if (landslideScore > 50) {
    recommendations.push("Construct stone bund structures and terracing on sloped sections to prevent slippage.");
  }
  if (waterloggingScore > 35 && waterloggingScore <= 60) {
    recommendations.push("Adopt raised-bed farming techniques (mounds/ridges) to protect crop root zones.");
  }
  if (climateScore > 60) {
    recommendations.push("Schedule supplementary drip irrigation and apply mulch to conserve remaining soil moisture.");
  }
  if (floodScore > 75) {
    recommendations.push("Trigger early harvest protocol for mature crops to avoid catastrophic field losses.");
  }

  if (recommendations.length < 4) {
    recommendations.push("Implement routine soil moisture and nutrient depletion monitoring.");
    recommendations.push("Maintain agro-forestry perimeter trees to act as windbreaks and stabilize soil.");
    recommendations.push("Incorporate organic compost to enhance soil structure and water retention.");
  }

  return {
    floodScore,
    waterloggingScore,
    erosionScore,
    landslideScore,
    climateScore,
    vulnerabilityScore,
    terrainAnalysis,
    suitability,
    recommendations: recommendations.slice(0, 6),
  };
}
