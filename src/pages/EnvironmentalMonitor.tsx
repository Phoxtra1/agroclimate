import { useEffect, useState, useMemo, useCallback } from "react";
import { useGeolocation } from "@/hooks/useGeolocation";
import { useWeather } from "@/hooks/useWeather";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getActiveProvider } from "@/lib/aiProviders/registry";
import { AIEnvironmentalAssessment } from "@/lib/aiProviders/index";
import {
  Wind, Thermometer, Droplets, Eye, AlertTriangle, CloudRain,
  Sprout, Activity, Waves, Flame, Tornado, Sun, Gauge, RefreshCw,
  Fish, TreePine, Bug, Zap, CloudFog, Snowflake, Sparkles, Loader2
} from "lucide-react";

// =============================================================================
// TYPES — Structured environmental status output
// =============================================================================

type Severity = "Low" | "Moderate" | "High" | "Critical";

interface RainfallStatus {
  intensity: "None" | "Light" | "Moderate" | "Heavy" | "Extreme";
  expected48h: number; // mm total
  trend: "Increasing" | "Decreasing" | "Stable";
}

interface WindStatus {
  speed: number;
  gust: number;
  destructivePotential: Severity;
  description: string;
}

interface TemperatureStatus {
  current: number;
  heatStress: Severity;
  coldStress: Severity;
  advice: string;
}

interface HumidityStatus {
  level: number;
  condition: "Dry" | "Comfortable" | "Humid" | "Very Humid";
  diseaseRiskFactor: boolean;
}

interface DisasterRisk {
  type: string;
  severity: Severity;
  icon: React.ElementType;
  description: string;
}

interface AgriculturalImpact {
  sector: string;
  icon: React.ElementType;
  status: Severity;
  factors: string[];
}

interface FlightRisk {
  severity: Severity;
  factors: string[];
}

interface AirQualityStatus {
  level: "Good" | "Moderate" | "Poor" | "Hazardous";
  risks: string[];
}

interface EnvironmentState {
  rainfall: RainfallStatus;
  wind: WindStatus;
  temperature: TemperatureStatus;
  humidity: HumidityStatus;
  disasters: DisasterRisk[];
  agriculturalImpacts: AgriculturalImpact[];
  flightRisk: FlightRisk;
  airQuality: AirQualityStatus;
  lastUpdated: Date;
}

// =============================================================================
// THRESHOLDS — Centralized constants for risk classification
// =============================================================================

const THRESHOLDS = {
  /** Rainfall intensity (mm/day) */
  RAIN_LIGHT: 5,
  RAIN_MODERATE: 15,
  RAIN_HEAVY: 30,
  RAIN_EXTREME: 50,

  /** Wind (km/h) */
  WIND_MODERATE: 20,
  WIND_STRONG: 35,
  WIND_DESTRUCTIVE: 50,
  WIND_GUST_SEVERE: 60,

  /** Temperature (°C) */
  HEAT_MODERATE: 32,
  HEAT_HIGH: 38,
  HEAT_EXTREME: 42,
  COLD_MODERATE: 10,
  COLD_SEVERE: 5,

  /** Humidity (%) */
  HUMIDITY_DRY: 30,
  HUMIDITY_COMFORTABLE_HIGH: 65,
  HUMIDITY_HIGH: 80,
  HUMIDITY_DISEASE: 75,

  /** Derived risks */
  FLOOD_RAIN_48H: 60,
  DROUGHT_DAYS: 5,
  DROUGHT_RAIN_MAX: 2,
  FIRE_HUMIDITY: 25,
  FIRE_TEMP: 35,

  /** Pressure (hPa) */
  PRESSURE_DROP_STORM: 1005,
} as const;

// =============================================================================
// ENVIRONMENTAL CALCULATIONS
// =============================================================================

/**
 * Classifies rainfall intensity from mm/day value.
 */
function classifyRainfall(mm: number): RainfallStatus["intensity"] {
  if (mm <= 0) return "None";
  if (mm <= THRESHOLDS.RAIN_LIGHT) return "Light";
  if (mm <= THRESHOLDS.RAIN_MODERATE) return "Moderate";
  if (mm <= THRESHOLDS.RAIN_HEAVY) return "Heavy";
  return "Extreme";
}

/**
 * Analyzes rainfall across forecast window.
 * Computes 48h total and determines trend direction.
 */
function analyzeRainfall(forecast: any[]): RainfallStatus {
  const today = forecast[0]?.rainfall ?? 0;
  const tomorrow = forecast[1]?.rainfall ?? 0;
  const expected48h = today + tomorrow;
  const dayAfter = forecast[2]?.rainfall ?? 0;

  let trend: RainfallStatus["trend"] = "Stable";
  if (tomorrow > today + 3 || dayAfter > tomorrow + 3) trend = "Increasing";
  else if (tomorrow < today - 3 && dayAfter < tomorrow - 3) trend = "Decreasing";

  return {
    intensity: classifyRainfall(today),
    expected48h,
    trend,
  };
}

/**
 * Evaluates wind conditions and destructive potential.
 */
function analyzeWind(forecast: any[]): WindStatus {
  const w = forecast[0];
  const speed = w?.windSpeed ?? 0;
  const gust = w?.windGust ?? 0;
  const maxForce = Math.max(speed, gust);

  let destructivePotential: Severity = "Low";
  let description = "Calm conditions. No wind-related concerns.";

  if (maxForce >= THRESHOLDS.WIND_DESTRUCTIVE) {
    destructivePotential = "Critical";
    description = `Dangerous winds at ${speed} km/h with gusts up to ${gust} km/h. Structural damage possible.`;
  } else if (maxForce >= THRESHOLDS.WIND_STRONG) {
    destructivePotential = "High";
    description = `Strong winds at ${speed} km/h. Gusts reaching ${gust} km/h. Unsecured structures at risk.`;
  } else if (maxForce >= THRESHOLDS.WIND_MODERATE) {
    destructivePotential = "Moderate";
    description = `Moderate winds at ${speed} km/h. Minor disruption to field operations.`;
  }

  return { speed, gust, destructivePotential, description };
}

/**
 * Computes heat and cold stress from temperature and humidity.
 * Uses simplified heat index: T + 0.5 × (H − 50).
 */
function analyzeTemperature(forecast: any[]): TemperatureStatus {
  const w = forecast[0];
  const temp = w?.temp ?? 25;
  const humidity = w?.humidity ?? 50;
  const heatIndex = temp + 0.5 * (humidity - 50);

  let heatStress: Severity = "Low";
  let coldStress: Severity = "Low";
  let advice = "Comfortable conditions for field work and livestock.";

  if (heatIndex >= THRESHOLDS.HEAT_EXTREME) {
    heatStress = "Critical";
    advice = "Extreme heat. Dangerous for humans and all livestock. Avoid outdoor exposure.";
  } else if (heatIndex >= THRESHOLDS.HEAT_HIGH) {
    heatStress = "High";
    advice = "Severe heat stress likely. Livestock require shade and continuous water access.";
  } else if (heatIndex >= THRESHOLDS.HEAT_MODERATE) {
    heatStress = "Moderate";
    advice = "Elevated heat. Monitor livestock hydration and take breaks during field work.";
  }

  if (temp <= THRESHOLDS.COLD_SEVERE) {
    coldStress = "High";
    advice = "Cold stress risk. Protect frost-sensitive crops and young livestock.";
  } else if (temp <= THRESHOLDS.COLD_MODERATE) {
    coldStress = "Moderate";
    advice = "Cool conditions. Monitor cold-sensitive crops overnight.";
  }

  return { current: temp, heatStress, coldStress, advice };
}

/**
 * Evaluates humidity and determines disease risk factor.
 */
function analyzeHumidity(forecast: any[]): HumidityStatus {
  const h = forecast[0]?.humidity ?? 50;

  let condition: HumidityStatus["condition"] = "Comfortable";
  if (h < THRESHOLDS.HUMIDITY_DRY) condition = "Dry";
  else if (h > THRESHOLDS.HUMIDITY_HIGH) condition = "Very Humid";
  else if (h > THRESHOLDS.HUMIDITY_COMFORTABLE_HIGH) condition = "Humid";

  return {
    level: h,
    condition,
    diseaseRiskFactor: h >= THRESHOLDS.HUMIDITY_DISEASE,
  };
}

/**
 * DISASTER RISK DETECTION
 * Detects flood, drought, fire, and storm risks from forecast patterns.
 * Uses multi-day trends, not isolated data points.
 */
function detectDisasters(forecast: any[]): DisasterRisk[] {
  const risks: DisasterRisk[] = [];

  // --- Flood risk: heavy cumulative rainfall over 48h ---
  const rain48h = (forecast[0]?.rainfall ?? 0) + (forecast[1]?.rainfall ?? 0);
  if (rain48h >= THRESHOLDS.FLOOD_RAIN_48H * 1.5) {
    risks.push({ type: "Flood Risk", severity: "Critical", icon: Waves, description: `${rain48h}mm rainfall expected in 48h. Severe flooding likely in low-lying areas.` });
  } else if (rain48h >= THRESHOLDS.FLOOD_RAIN_48H) {
    risks.push({ type: "Flood Risk", severity: "High", icon: Waves, description: `${rain48h}mm rainfall expected in 48h. Flooding possible in drainage-poor areas.` });
  } else if (rain48h >= THRESHOLDS.FLOOD_RAIN_48H * 0.6) {
    risks.push({ type: "Flood Risk", severity: "Moderate", icon: Waves, description: `${rain48h}mm rainfall expected in 48h. Monitor low-lying fields.` });
  }

  // --- Drought: prolonged dry period (check 7-day window) ---
  const dryDays = forecast.filter(d => (d.rainfall ?? 0) <= THRESHOLDS.DROUGHT_RAIN_MAX).length;
  if (dryDays >= THRESHOLDS.DROUGHT_DAYS && rain48h < 5) {
    const severity: Severity = dryDays >= 7 ? "High" : "Moderate";
    risks.push({ type: "Drought Conditions", severity, icon: Sun, description: `${dryDays} of 7 forecast days with minimal rainfall. Soil moisture depletion likely.` });
  }

  // --- Fire risk: dry air + high temp (harmattan-type conditions) ---
  const humidity = forecast[0]?.humidity ?? 50;
  const temp = forecast[0]?.temp ?? 25;
  const todayRain = forecast[0]?.rainfall ?? 0;

  // Only flag fire risk when it's actually dry (avoid false alarm during rain)
  if (humidity <= THRESHOLDS.FIRE_HUMIDITY && temp >= THRESHOLDS.FIRE_TEMP && todayRain < 2) {
    const severity: Severity = humidity <= 15 && temp >= 40 ? "Critical" : humidity <= 20 ? "High" : "Moderate";
    risks.push({ type: "Fire Outbreak Risk", severity, icon: Flame, description: `Humidity at ${humidity}% with ${temp}°C. Dry vegetation highly flammable. Harmattan-type conditions.` });
  }

  // --- Storm / tornado-type risks: pressure drop + high wind + gusts ---
  const pressure = forecast[0]?.pressure ?? 1013;
  const windGust = forecast[0]?.windGust ?? 0;
  const windSpeed = forecast[0]?.windSpeed ?? 0;

  if (pressure <= THRESHOLDS.PRESSURE_DROP_STORM && windGust >= THRESHOLDS.WIND_GUST_SEVERE) {
    risks.push({ type: "Severe Storm", severity: "Critical", icon: Tornado, description: `Pressure at ${pressure} hPa with ${windGust} km/h gusts. Tornado-type conditions possible.` });
  } else if (pressure <= THRESHOLDS.PRESSURE_DROP_STORM && windSpeed >= THRESHOLDS.WIND_STRONG) {
    risks.push({ type: "Storm Risk", severity: "High", icon: Zap, description: `Low pressure (${pressure} hPa) with strong winds (${windSpeed} km/h). Severe weather developing.` });
  } else if (windSpeed >= THRESHOLDS.WIND_STRONG) {
    risks.push({ type: "Strong Wind Event", severity: "Moderate", icon: Wind, description: `Sustained winds at ${windSpeed} km/h may damage crops and structures.` });
  }

  // --- Low visibility risk ---
  const visibility = forecast[0]?.visibility ?? 10;
  if (visibility < 2) {
    risks.push({ type: "Low Visibility", severity: "High", icon: CloudFog, description: `Visibility at ${visibility} km. Fog or dust conditions reducing operational safety.` });
  }

  // --- Frost risk ---
  if (temp <= 2) {
    risks.push({ type: "Frost Risk", severity: temp <= 0 ? "High" : "Moderate", icon: Snowflake, description: `Temperature at ${temp}°C. Frost damage likely on exposed crops.` });
  }

  return risks.sort((a, b) => severityOrder(b.severity) - severityOrder(a.severity));
}

/**
 * AGRICULTURAL IMPACT MAPPING
 * Determines how current conditions affect crops, livestock, and aquaculture.
 */
function assessAgriculturalImpact(
  forecast: any[],
  rainfall: RainfallStatus,
  humidity: HumidityStatus,
  temperature: TemperatureStatus,
  wind: WindStatus
): AgriculturalImpact[] {
  const impacts: AgriculturalImpact[] = [];

  // --- Crop impact ---
  const cropFactors: string[] = [];
  let cropSeverity: Severity = "Low";

  if (humidity.diseaseRiskFactor && rainfall.intensity !== "None") {
    cropFactors.push("Fungal disease risk elevated from high humidity and moisture");
    cropSeverity = raiseSeverity(cropSeverity, "Moderate");
  }
  if (humidity.diseaseRiskFactor && temperature.current > 25) {
    cropFactors.push("Warm, humid conditions favor pest proliferation");
    cropSeverity = raiseSeverity(cropSeverity, "Moderate");
  }
  if (rainfall.intensity === "Heavy" || rainfall.intensity === "Extreme") {
    cropFactors.push("Waterlogging risk from heavy rainfall may damage root systems");
    cropSeverity = raiseSeverity(cropSeverity, "High");
  }
  if (temperature.heatStress === "High" || temperature.heatStress === "Critical") {
    cropFactors.push("Heat stress reduces photosynthesis and crop yield");
    cropSeverity = raiseSeverity(cropSeverity, "High");
  }
  if (temperature.coldStress !== "Low") {
    cropFactors.push("Cold stress may damage frost-sensitive crops");
    cropSeverity = raiseSeverity(cropSeverity, temperature.coldStress);
  }
  if (wind.destructivePotential !== "Low") {
    cropFactors.push("Wind damage risk to young plants and tall crops");
    cropSeverity = raiseSeverity(cropSeverity, wind.destructivePotential);
  }
  if (cropFactors.length === 0) cropFactors.push("No significant crop stress detected");

  impacts.push({ sector: "Crops", icon: Sprout, status: cropSeverity, factors: cropFactors });

  // --- Livestock impact ---
  const livestockFactors: string[] = [];
  let livestockSeverity: Severity = "Low";

  if (temperature.heatStress !== "Low") {
    livestockFactors.push(`Heat stress: ${temperature.heatStress}. Animals need shade and water access`);
    livestockSeverity = raiseSeverity(livestockSeverity, temperature.heatStress);
  }
  if (temperature.coldStress !== "Low") {
    livestockFactors.push("Cold exposure risk for young or vulnerable animals");
    livestockSeverity = raiseSeverity(livestockSeverity, temperature.coldStress);
  }
  if (humidity.level > 80 && temperature.current > 28) {
    livestockFactors.push("High humidity + heat increases disease transmission risk");
    livestockSeverity = raiseSeverity(livestockSeverity, "Moderate");
  }
  if (wind.destructivePotential === "High" || wind.destructivePotential === "Critical") {
    livestockFactors.push("Strong winds may damage shelters and stress animals");
    livestockSeverity = raiseSeverity(livestockSeverity, "High");
  }
  if (rainfall.intensity === "Heavy" || rainfall.intensity === "Extreme") {
    livestockFactors.push("Wet conditions increase hoof disease and respiratory illness risk");
    livestockSeverity = raiseSeverity(livestockSeverity, "Moderate");
  }
  if (livestockFactors.length === 0) livestockFactors.push("Conditions comfortable for livestock");

  impacts.push({ sector: "Livestock", icon: Activity, status: livestockSeverity, factors: livestockFactors });

  // --- Aquaculture impact ---
  const aquaFactors: string[] = [];
  let aquaSeverity: Severity = "Low";

  if (temperature.current > 32) {
    aquaFactors.push("Water temperature likely elevated. Dissolved oxygen levels may drop");
    aquaSeverity = raiseSeverity(aquaSeverity, "High");
  } else if (temperature.current > 28) {
    aquaFactors.push("Warm water conditions. Monitor oxygen levels in ponds");
    aquaSeverity = raiseSeverity(aquaSeverity, "Moderate");
  }
  if (temperature.current < 15) {
    aquaFactors.push("Cold water stress for tropical fish and shrimp species");
    aquaSeverity = raiseSeverity(aquaSeverity, "Moderate");
  }
  if (rainfall.expected48h > 40) {
    aquaFactors.push("Heavy rain may cause pond overflow and introduce contaminants");
    aquaSeverity = raiseSeverity(aquaSeverity, "High");
  }
  if (wind.destructivePotential !== "Low") {
    aquaFactors.push("Wind-driven wave action may stress fish and damage pond structures");
    aquaSeverity = raiseSeverity(aquaSeverity, wind.destructivePotential);
  }
  if (humidity.level < 30 && temperature.current > 35) {
    aquaFactors.push("Rapid evaporation may lower water levels in shallow ponds");
    aquaSeverity = raiseSeverity(aquaSeverity, "Moderate");
  }
  if (aquaFactors.length === 0) aquaFactors.push("Stable conditions for aquaculture operations");

  impacts.push({ sector: "Aquaculture", icon: Fish, status: aquaSeverity, factors: aquaFactors });

  return impacts;
}

/**
 * FLIGHT & AIRBORNE RISK INTEGRATION
 * Monitors wind, dust, storm patterns affecting farm operations and structures.
 */
function assessFlightRisk(forecast: any[], wind: WindStatus): FlightRisk {
  const factors: string[] = [];
  let severity: Severity = "Low";

  const w = forecast[0];
  const humidity = w?.humidity ?? 50;
  const visibility = w?.visibility ?? 10;
  const pressure = w?.pressure ?? 1013;
  const gust = w?.windGust ?? 0;

  // Wind-based risks
  if (wind.destructivePotential === "Critical") {
    factors.push("Destructive winds — all aerial and outdoor operations unsafe");
    severity = "Critical";
  } else if (wind.destructivePotential === "High") {
    factors.push("Strong winds affecting crop covers, greenhouses, and loose equipment");
    severity = raiseSeverity(severity, "High");
  } else if (wind.destructivePotential === "Moderate") {
    factors.push("Moderate winds may affect precision drone spraying");
    severity = raiseSeverity(severity, "Moderate");
  }

  // Dust/particulate movement
  if (humidity < 25 && wind.speed > 20) {
    factors.push("Dust storm conditions: dry air + wind moving particulates across fields");
    severity = raiseSeverity(severity, "High");
  }

  // Low visibility
  if (visibility < 3) {
    factors.push(`Reduced visibility (${visibility} km) affecting safe movement and operations`);
    severity = raiseSeverity(severity, "Moderate");
  }
  if (visibility < 1) {
    severity = raiseSeverity(severity, "High");
  }

  // Storm travel patterns
  if (pressure < THRESHOLDS.PRESSURE_DROP_STORM && gust > 40) {
    factors.push("Storm system moving through area — airborne debris risk");
    severity = raiseSeverity(severity, "High");
  }

  // Pollen / biological airborne risk (warm + humid + light wind)
  if (humidity > 60 && w?.temp > 25 && wind.speed < 15 && wind.speed > 5) {
    factors.push("Conditions favor pollen and spore dispersal — crop disease vector");
    severity = raiseSeverity(severity, "Low");
  }

  if (factors.length === 0) factors.push("No significant airborne or flight-related risks");

  return { severity, factors };
}

/**
 * AIR QUALITY INFERENCE (no sensor — derived from weather)
 */
function inferAirQuality(forecast: any[]): AirQualityStatus {
  const w = forecast[0];
  if (!w) return { level: "Good", risks: [] };

  const risks: string[] = [];
  let level: AirQualityStatus["level"] = "Good";

  if (w.windSpeed > 25 && w.humidity < 35) {
    risks.push("Dust and particulate matter raised by strong dry winds");
    level = "Moderate";
  }
  if (w.humidity < 25) {
    risks.push("Very dry air increases suspended particulates");
    level = level === "Good" ? "Moderate" : level;
  }
  if (w.temp > 38) {
    risks.push("Extreme heat may cause ground-level ozone formation");
    level = "Poor";
  }
  if (w.windSpeed < 5 && w.humidity > 70) {
    risks.push("Stagnant air trapping pollutants near ground level");
    level = level === "Good" ? "Moderate" : level;
  }
  if (w.humidity > 85 && w.temp > 30) {
    risks.push("Haze likely from high humidity and temperature");
  }
  if (w.visibility !== undefined && w.visibility < 2) {
    risks.push("Very low visibility indicating poor air conditions");
    level = "Poor";
  }

  return { level, risks };
}

// =============================================================================
// UTILITY HELPERS
// =============================================================================

const SEVERITY_ORDER: Record<Severity, number> = { Low: 0, Moderate: 1, High: 2, Critical: 3 };
function severityOrder(s: Severity): number { return SEVERITY_ORDER[s]; }
function raiseSeverity(current: Severity, incoming: Severity): Severity {
  return severityOrder(incoming) > severityOrder(current) ? incoming : current;
}

function severityColor(s: Severity): string {
  switch (s) {
    case "Critical": return "text-destructive";
    case "High": return "text-destructive";
    case "Moderate": return "text-warning";
    case "Low": return "text-primary";
  }
}

function severityBg(s: Severity): string {
  switch (s) {
    case "Critical": return "bg-destructive/10 border-destructive/20";
    case "High": return "bg-destructive/5 border-destructive/15";
    case "Moderate": return "bg-accent border-accent";
    case "Low": return "bg-muted border-border";
  }
}

function airQualityColor(level: AirQualityStatus["level"]): string {
  switch (level) {
    case "Hazardous": return "bg-destructive/10 text-destructive";
    case "Poor": return "bg-destructive/5 text-destructive";
    case "Moderate": return "bg-accent text-accent-foreground";
    case "Good": return "bg-primary/10 text-primary";
  }
}

// =============================================================================
// REAL-TIME UPDATE HOOK
// =============================================================================

/**
 * Processes forecast data into a structured EnvironmentState.
 * Re-runs whenever forecast data changes.
 * In production, useWeather would poll or use WebSocket for real-time updates;
 * the component recomputes status on every new data push.
 */
function useEnvironmentState(forecast: any[]): EnvironmentState | null {
  return useMemo(() => {
    if (!forecast || forecast.length === 0) return null;

    // Map WeatherDay format to internal format expected by analysis functions
    const mapped = forecast.map((day: any) => ({
      temp: day.temp ?? day.tempHigh ?? 25,
      humidity: day.humidity ?? 60,
      windSpeed: day.windSpeed ?? day.wind ?? 5,
      windGust: day.windGust ?? (day.wind ? day.wind * 1.4 : 8),
      rainfall: day.rainfall ?? (day.rainProb != null ? day.rainProb * 0.3 : 0),
      pressure: day.pressure ?? 1013,
      visibility: day.visibility ?? 10,
    }));

    const rainfall = analyzeRainfall(mapped);
    const wind = analyzeWind(mapped);
    const temperature = analyzeTemperature(mapped);
    const humidity = analyzeHumidity(mapped);
    const disasters = detectDisasters(mapped);
    const agriculturalImpacts = assessAgriculturalImpact(mapped, rainfall, humidity, temperature, wind);
    const flightRisk = assessFlightRisk(mapped, wind);
    const airQuality = inferAirQuality(mapped);

    return {
      rainfall,
      wind,
      temperature,
      humidity,
      disasters,
      agriculturalImpacts,
      flightRisk,
      airQuality,
      lastUpdated: new Date(),
    };
  }, [forecast]);
}

// =============================================================================
// COMPONENT — Rendering structured environment status
// =============================================================================

export default function EnvironmentalMonitor() {
  const { position } = useGeolocation();
  const { forecast } = useWeather(position.lat, position.lon);
  const envState = useEnvironmentState(forecast);

  const [aiEnv, setAiEnv] = useState<AIEnvironmentalAssessment | null>(null);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  const fetchAiAssessment = useCallback(async (force = false) => {
    if (!forecast || forecast.length === 0 || !position.locationName) return;

    const cacheKey = `agroclimate_ai_env_${position.locationName.replace(/[^a-zA-Z]/g, "").toLowerCase()}`;
    if (!force) {
      const cached = sessionStorage.getItem(cacheKey);
      if (cached) {
        try {
          const parsed = JSON.parse(cached);
          if (Date.now() - parsed.timestamp < 4 * 60 * 60 * 1000) {
            setAiEnv(parsed.assessment);
            return;
          }
        } catch { /* bad cache */ }
      }
    }

    setIsAiLoading(true);
    setAiError(null);
    try {
      const provider = getActiveProvider();
      const data = await provider.generateEnvironmentalAssessment(position.locationName, forecast);
      if (data && typeof data.ecologicalScore === "number") {
        setAiEnv(data);
        sessionStorage.setItem(cacheKey, JSON.stringify({ assessment: data, timestamp: Date.now() }));
      } else {
        throw new Error("Invalid environmental assessment data structure");
      }
    } catch (err: any) {
      console.warn("AI Environmental Assessment failed:", err);
      setAiError(err.message || "AI service temporarily offline");
    } finally {
      setIsAiLoading(false);
    }
  }, [forecast, position.locationName]);

  useEffect(() => {
    fetchAiAssessment();
  }, [fetchAiAssessment]);

  const mergedDisasters = useMemo(() => {
    if (!envState) return [];
    if (!aiEnv) return envState.disasters;

    const aiMappedDisasters = aiEnv.disasters.map((d) => {
      let icon = AlertTriangle;
      const t = d.type.toLowerCase();
      if (t.includes("flood") || t.includes("rain") || t.includes("water")) icon = Waves;
      else if (t.includes("drought") || t.includes("heat") || t.includes("dry")) icon = Sun;
      else if (t.includes("fire") || t.includes("burn")) icon = Flame;
      else if (t.includes("wind") || t.includes("storm") || t.includes("tornado")) icon = Tornado;

      return {
        type: d.type,
        severity: d.severity.charAt(0).toUpperCase() + d.severity.slice(1) as Severity,
        icon,
        description: d.description,
        isAiBacked: true,
      };
    });

    return [...aiMappedDisasters, ...envState.disasters];
  }, [envState, aiEnv]);

  const mergedImpacts = useMemo(() => {
    if (!envState) return [];
    if (!aiEnv) return envState.agriculturalImpacts;

    return envState.agriculturalImpacts.map((imp) => {
      const aiImp = aiEnv.agriculturalImpacts.find((ai) => ai.sector === imp.sector);
      if (aiImp) {
        return {
          ...imp,
          status: aiImp.status.charAt(0).toUpperCase() + aiImp.status.slice(1) as Severity,
          factors: [...aiImp.factors, ...imp.factors.filter(f => !f.includes("No significant"))],
          isAiBacked: true,
        };
      }
      return imp;
    });
  }, [envState, aiEnv]);

  // Real-time clock tick for "last updated" display freshness
  const [, setTick] = useState(0);
  useEffect(() => {
    const interval = setInterval(() => setTick(t => t + 1), 30_000);
    return () => clearInterval(interval);
  }, []);

  if (!envState) {
    return (
      <div className="p-4 lg:p-8 max-w-5xl mx-auto">
        <div className="text-center py-16 text-muted-foreground">
          <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-3" />
          <p className="text-sm">Loading environmental data…</p>
        </div>
      </div>
    );
  }

  const locationLabel = position.locationName !== "Unknown"
    ? position.locationName
    : `${position.lat.toFixed(2)}°, ${position.lon.toFixed(2)}°`;

  return (
    <div className="p-4 lg:p-8 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
            Environmental Monitor
            {isAiLoading && <Loader2 className="h-5 w-5 animate-spin text-primary" />}
          </h1>
          <p className="text-sm text-muted-foreground">{locationLabel}</p>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <RefreshCw className="h-3 w-3" />
          <span>Updated {envState.lastUpdated.toLocaleTimeString()}</span>
        </div>
      </div>

      {/* AI Ecological Health Summary */}
      {aiEnv ? (
        <Card className="border-primary/20 bg-primary/5 overflow-hidden relative shadow-md">
          <div className="absolute top-0 right-0 h-40 w-40 bg-primary/10 rounded-full blur-3xl" />
          <CardContent className="p-5 flex flex-col md:flex-row items-center gap-6">
            <div className="relative h-20 w-20 flex items-center justify-center flex-shrink-0">
              <svg className="w-full h-full transform -rotate-90">
                <circle cx="40" cy="40" r="32" stroke="hsl(var(--border))" strokeWidth="6" fill="transparent" />
                <circle
                  cx="40" cy="40" r="32"
                  stroke={aiEnv.ecologicalScore > 75 ? "hsl(var(--primary))" : aiEnv.ecologicalScore > 45 ? "hsl(var(--warning))" : "hsl(var(--destructive))"}
                  strokeWidth="6"
                  fill="transparent"
                  strokeDasharray={2 * Math.PI * 32}
                  strokeDashoffset={2 * Math.PI * 32 * (1 - aiEnv.ecologicalScore / 100)}
                  className="transition-all duration-1000 ease-out"
                />
              </svg>
              <div className="absolute text-center">
                <span className="text-xl font-black text-foreground">{aiEnv.ecologicalScore}</span>
                <p className="text-[8px] text-muted-foreground font-semibold uppercase">Health</p>
              </div>
            </div>
            
            <div className="flex-1 space-y-2">
              <div className="flex items-center gap-2">
                <Badge className="bg-primary text-primary-foreground border-transparent animate-pulse flex items-center gap-1 text-[10px]">
                  <Sparkles className="h-3 w-3" /> Odeneho AI Ecological Analysis
                </Badge>
              </div>
              <p className="text-sm font-semibold text-foreground">Community Ecological Health Summary</p>
              <p className="text-xs text-muted-foreground leading-relaxed italic">
                "{aiEnv.analysis}"
              </p>
            </div>

            <Button
              size="sm"
              variant="outline"
              className="bg-background hover:bg-muted border-primary/20 flex items-center gap-1 text-xs shrink-0"
              onClick={() => fetchAiAssessment(true)}
              disabled={isAiLoading}
            >
              {isAiLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
              Analyze Ecology
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-border/40 bg-card/50">
          <CardContent className="p-4 flex items-center justify-between text-xs">
            <span className="text-muted-foreground flex items-center gap-1.5">
              <Sparkles className="h-4 w-4 text-primary animate-pulse animate-duration-1000" />
              Unlock real-time AI Ecological Risk and Outbreak Assessments for {locationLabel}.
            </span>
            <Button
              size="sm"
              className="bg-primary text-primary-foreground flex items-center gap-1.5"
              onClick={() => fetchAiAssessment(true)}
              disabled={isAiLoading}
            >
              {isAiLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
              Trigger AI Analysis
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Primary Conditions Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Rainfall */}
        <Card className="border-border">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <CloudRain className="h-4 w-4 text-muted-foreground" />
              <span className="text-xs font-medium text-muted-foreground">Rainfall</span>
            </div>
            <p className="text-lg font-bold text-foreground">{envState.rainfall.intensity}</p>
            <p className="text-xs text-muted-foreground">{envState.rainfall.expected48h}mm in 48h</p>
            <Badge variant="outline" className="mt-2 text-[10px]">
              {envState.rainfall.trend}
            </Badge>
          </CardContent>
        </Card>

        {/* Wind */}
        <Card className="border-border">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <Wind className="h-4 w-4 text-muted-foreground" />
              <span className="text-xs font-medium text-muted-foreground">Wind</span>
            </div>
            <p className="text-lg font-bold text-foreground">{envState.wind.speed} km/h</p>
            <p className="text-xs text-muted-foreground">Gusts: {envState.wind.gust} km/h</p>
            <Badge variant="outline" className={`mt-2 text-[10px] ${severityColor(envState.wind.destructivePotential)}`}>
              {envState.wind.destructivePotential}
            </Badge>
          </CardContent>
        </Card>

        {/* Temperature */}
        <Card className="border-border">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <Thermometer className="h-4 w-4 text-muted-foreground" />
              <span className="text-xs font-medium text-muted-foreground">Temperature</span>
            </div>
            <p className="text-lg font-bold text-foreground">{envState.temperature.current}°C</p>
            <p className="text-xs text-muted-foreground">
              Heat: <span className={severityColor(envState.temperature.heatStress)}>{envState.temperature.heatStress}</span>
              {envState.temperature.coldStress !== "Low" && (
                <> · Cold: <span className={severityColor(envState.temperature.coldStress)}>{envState.temperature.coldStress}</span></>
              )}
            </p>
          </CardContent>
        </Card>

        {/* Humidity */}
        <Card className="border-border">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <Droplets className="h-4 w-4 text-muted-foreground" />
              <span className="text-xs font-medium text-muted-foreground">Humidity</span>
            </div>
            <p className="text-lg font-bold text-foreground">{envState.humidity.level}%</p>
            <p className="text-xs text-muted-foreground">{envState.humidity.condition}</p>
            {envState.humidity.diseaseRiskFactor && (
              <Badge variant="outline" className="mt-2 text-[10px] text-destructive">
                <Bug className="h-2.5 w-2.5 mr-1" /> Disease Risk
              </Badge>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Disaster Risks */}
      {mergedDisasters.length > 0 && (
        <Card className="border-destructive/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2 text-foreground">
              <AlertTriangle className="h-4 w-4 text-destructive" />
              Disaster Risk Detection
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {mergedDisasters.map((d, i) => (
              <div key={i} className={`flex items-start gap-3 p-3 rounded-lg border ${severityBg(d.severity)}`}>
                <d.icon className={`h-4 w-4 mt-0.5 flex-shrink-0 ${severityColor(d.severity)}`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-foreground">{d.type}</span>
                    <Badge variant="outline" className={`text-[10px] ${severityColor(d.severity)}`}>{d.severity}</Badge>
                    {(d as any).isAiBacked && (
                      <Badge className="bg-primary/10 text-primary border-primary/20 text-[8px] h-4 flex items-center gap-0.5">
                        <Sparkles className="h-2 w-2" /> AI Backed
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">{d.description}</p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Agricultural Impact */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2 text-foreground">
            <TreePine className="h-4 w-4 text-primary" />
            Agricultural Impact Status
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {mergedImpacts.map((impact, i) => (
            <div key={i} className={`p-3 rounded-lg border ${severityBg(impact.status)}`}>
              <div className="flex items-center gap-2 mb-1.5">
                <impact.icon className={`h-4 w-4 ${severityColor(impact.status)}`} />
                <span className="text-sm font-medium text-foreground">{impact.sector}</span>
                {(impact as any).isAiBacked && (
                  <Badge className="bg-primary/10 text-primary border-primary/20 text-[8px] h-4 flex items-center gap-0.5">
                    <Sparkles className="h-2 w-2" /> AI Backed
                  </Badge>
                )}
                <Badge variant="outline" className={`text-[10px] ml-auto ${severityColor(impact.status)}`}>
                  {impact.status}
                </Badge>
              </div>
              <ul className="space-y-1">
                {impact.factors.map((f, j) => (
                  <li key={j} className="text-xs text-muted-foreground flex items-start gap-1.5">
                    <span className="text-muted-foreground mt-1">•</span>
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="grid md:grid-cols-2 gap-4">
        {/* Flight & Airborne Risk */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2 text-foreground">
              <Tornado className="h-4 w-4 text-muted-foreground" />
              Flight & Airborne Risk
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Badge variant="outline" className={`mb-3 ${severityColor(envState.flightRisk.severity)}`}>
              {envState.flightRisk.severity}
            </Badge>
            <ul className="space-y-1.5">
              {envState.flightRisk.factors.map((f, i) => (
                <li key={i} className="text-xs text-muted-foreground flex items-start gap-1.5">
                  <Wind className="h-3 w-3 mt-0.5 flex-shrink-0 text-muted-foreground" />
                  <span>{f}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        {/* Air Quality */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2 text-foreground">
              <Eye className="h-4 w-4 text-muted-foreground" />
              Air Quality Inference
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Badge className={`mb-3 ${airQualityColor(envState.airQuality.level)}`}>
              {envState.airQuality.level}
            </Badge>
            {envState.airQuality.risks.length > 0 ? (
              <ul className="space-y-1.5">
                {envState.airQuality.risks.map((r, i) => (
                  <li key={i} className="text-xs text-muted-foreground flex items-start gap-1.5">
                    <AlertTriangle className="h-3 w-3 mt-0.5 flex-shrink-0 text-accent-foreground" />
                    <span>{r}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-muted-foreground">No significant air quality concerns.</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* 7-Day Environmental Outlook */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2 text-foreground">
            <Gauge className="h-4 w-4 text-muted-foreground" />
            7-Day Environmental Outlook
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-7 gap-2">
            {forecast.slice(0, 7).map((day, i) => {
              const dayTemp = (day as any).temp ?? day.tempHigh ?? 25;
              const dayHumidity = day.humidity ?? 50;
              const dayWind = (day as any).windSpeed ?? day.wind ?? 0;
              const dayRain = (day as any).rainfall ?? day.rainProb ?? 0;
              const heatIdx = dayTemp + 0.5 * (dayHumidity - 50);

              let heatLevel: Severity = "Low";
              if (heatIdx >= THRESHOLDS.HEAT_EXTREME) heatLevel = "Critical";
              else if (heatIdx >= THRESHOLDS.HEAT_HIGH) heatLevel = "High";
              else if (heatIdx >= THRESHOLDS.HEAT_MODERATE) heatLevel = "Moderate";

              const dayLabel = new Date(day.date).toLocaleDateString("en", { weekday: "short" });

              return (
                <div key={i} className="bg-muted rounded-lg p-2 text-center">
                  <p className="text-[10px] font-medium text-muted-foreground mb-1">{i === 0 ? "Today" : dayLabel}</p>
                  <p className="text-sm font-bold text-foreground">{dayTemp}°C</p>
                  <p className="text-[10px] text-muted-foreground">{dayWind} km/h</p>
                  <p className="text-[10px] text-muted-foreground">{dayRain}mm</p>
                  <Badge variant="outline" className={`text-[9px] mt-1 ${severityColor(heatLevel)}`}>
                    {heatLevel}
                  </Badge>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
