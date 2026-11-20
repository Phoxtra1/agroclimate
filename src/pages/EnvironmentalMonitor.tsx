import { useEffect, useState, useMemo, useCallback, useRef } from "react";
import { useGeolocation } from "@/hooks/useGeolocation";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useWeather } from "@/hooks/useWeather";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getActiveProvider } from "@/lib/aiProviders/registry";
import { AIAgroRiskAssessment, AIEnvironmentalAssessment, RiskLevel } from "@/lib/aiProviders/index";
import { calculateAgroRiskLocal, LocalAgroRiskResult } from "@/lib/riskEngine";
import { saveFarm as dbSaveFarm, listFarms as dbListFarms, deleteFarm as dbDeleteFarm, saveAgroRiskIncident as dbSaveIncident, listAgroRiskIncidents as dbListIncidents } from "@/services/satellite/geospatial";
import { OpenInSatelliteButton } from "@/components/satellite/OpenInSatelliteButton";
import { MapContainer, TileLayer, Marker, Popup, Polygon, Circle, useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

import {
  Wind, Thermometer, Droplets, Eye, AlertTriangle, CloudRain,
  Sprout, Activity, Waves, Flame, Tornado, Sun, Gauge, RefreshCw,
  Fish, TreePine, Bug, Zap, CloudFog, Snowflake, Sparkles, Loader2,
  MapPin, Plus, Trash2, CheckCircle2, ShieldAlert, Mountain, HelpCircle
} from "lucide-react";

// Fix Leaflet default marker icons in Vite
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

// =============================================================================
// TYPES & CONSTANTS
// =============================================================================
type Severity = "Low" | "Moderate" | "High" | "Critical";

interface RainfallStatus {
  intensity: "None" | "Light" | "Moderate" | "Heavy" | "Extreme";
  expected48h: number;
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

function readUserStorage<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) as T : fallback;
  } catch {
    return fallback;
  }
}

function writeUserStorage<T>(key: string, value: T) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* local fallback is optional */ }
}

const userStorageKey = (name: string, userId: string) => `agrorisk_${name}_${userId}`;

interface IncidentReport {
  id: string;
  lat: number;
  lon: number;
  type: "Flooding" | "Waterlogging" | "Soil Erosion" | "Landslide" | "Drought";
  description: string;
  date: string;
  status: "unverified";
  source: "user_report";
}

interface SavedFarm {
  id: string;
  name: string;
  lat: number;
  lon: number;
  boundary?: [number, number][];
}

const THRESHOLDS = {
  RAIN_LIGHT: 5,
  RAIN_MODERATE: 15,
  RAIN_HEAVY: 30,
  RAIN_EXTREME: 50,
  WIND_MODERATE: 20,
  WIND_STRONG: 35,
  WIND_DESTRUCTIVE: 50,
  WIND_GUST_SEVERE: 60,
  HEAT_MODERATE: 32,
  HEAT_HIGH: 38,
  HEAT_EXTREME: 42,
  COLD_MODERATE: 10,
  COLD_SEVERE: 5,
  HUMIDITY_DRY: 30,
  HUMIDITY_COMFORTABLE_HIGH: 65,
  HUMIDITY_HIGH: 80,
  HUMIDITY_DISEASE: 75,
  FLOOD_RAIN_48H: 60,
  DROUGHT_DAYS: 5,
  DROUGHT_RAIN_MAX: 2,
  FIRE_HUMIDITY: 25,
  FIRE_TEMP: 35,
  PRESSURE_DROP_STORM: 1005,
} as const;

// Approximate reference overlays only; not surveyed hazard boundaries.
const HAZARD_OVERLAYS = [
  { name: "Lower Volta Floodplain", coords: [[6.4, 0.2], [6.0, 0.3], [5.9, -0.1], [6.3, -0.1]], color: "#dc2626", fillOpacity: 0.25, risk: "CRITICAL FLOOD ZONE" },
  { name: "Kwahu Steep Mountain Slopes", coords: [[6.7, -0.8], [6.5, -0.6], [6.4, -0.9], [6.6, -1.1]], color: "#f97316", fillOpacity: 0.2, risk: "HIGH EROSION & LANDSLIDE ZONE" },
  { name: "White Volta Runoff Basin", coords: [[10.4, -0.9], [9.8, -0.7], [9.6, -1.2], [10.2, -1.3]], color: "#dc2626", fillOpacity: 0.25, risk: "CRITICAL RUNOFF ZONE" }
];

// =============================================================================
// MAP HELPERS
// =============================================================================
function FlyTo({ lat, lon, zoom = 12 }: { lat: number; lon: number; zoom?: number }) {
  const map = useMap();
  useEffect(() => {
    map.flyTo([lat, lon], zoom, { duration: 1.2 });
  }, [lat, lon, zoom, map]);
  return null;
}

function MapEventsListener({
  onMapClick,
  activeMode
}: {
  onMapClick: (lat: number, lon: number) => void;
  activeMode: string;
}) {
  useMapEvents({
    click(e) {
      onMapClick(e.latlng.lat, e.latlng.lng);
    }
  });
  return null;
}

// =============================================================================
// ENVIRONMENTAL CALCULATIONS (EXISTING CODE PRESERVED)
// =============================================================================
function classifyRainfall(mm: number): RainfallStatus["intensity"] {
  if (mm <= 0) return "None";
  if (mm <= THRESHOLDS.RAIN_LIGHT) return "Light";
  if (mm <= THRESHOLDS.RAIN_MODERATE) return "Moderate";
  if (mm <= THRESHOLDS.RAIN_HEAVY) return "Heavy";
  return "Extreme";
}

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

function detectDisasters(forecast: any[]): DisasterRisk[] {
  const risks: DisasterRisk[] = [];

  const rain48h = (forecast[0]?.rainfall ?? 0) + (forecast[1]?.rainfall ?? 0);
  if (rain48h >= THRESHOLDS.FLOOD_RAIN_48H * 1.5) {
    risks.push({ type: "Flood Risk", severity: "Critical", icon: Waves, description: `${rain48h}mm rainfall expected in 48h. Severe flooding likely in low-lying areas.` });
  } else if (rain48h >= THRESHOLDS.FLOOD_RAIN_48H) {
    risks.push({ type: "Flood Risk", severity: "High", icon: Waves, description: `${rain48h}mm rainfall expected in 48h. Flooding possible in drainage-poor areas.` });
  } else if (rain48h >= THRESHOLDS.FLOOD_RAIN_48H * 0.6) {
    risks.push({ type: "Flood Risk", severity: "Moderate", icon: Waves, description: `${rain48h}mm rainfall expected in 48h. Monitor low-lying fields.` });
  }

  const dryDays = forecast.filter(d => (d.rainfall ?? 0) <= THRESHOLDS.DROUGHT_RAIN_MAX).length;
  if (dryDays >= THRESHOLDS.DROUGHT_DAYS && rain48h < 5) {
    const severity: Severity = dryDays >= 7 ? "High" : "Moderate";
    risks.push({ type: "Drought Conditions", severity, icon: Sun, description: `${dryDays} of 7 forecast days with minimal rainfall. Soil moisture depletion likely.` });
  }

  const humidity = forecast[0]?.humidity ?? 50;
  const temp = forecast[0]?.temp ?? 25;
  const todayRain = forecast[0]?.rainfall ?? 0;

  if (humidity <= THRESHOLDS.FIRE_HUMIDITY && temp >= THRESHOLDS.FIRE_TEMP && todayRain < 2) {
    const severity: Severity = humidity <= 15 && temp >= 40 ? "Critical" : humidity <= 20 ? "High" : "Moderate";
    risks.push({ type: "Fire Outbreak Risk", severity, icon: Flame, description: `Humidity at ${humidity}% with ${temp}°C. Dry vegetation highly flammable. Harmattan-type conditions.` });
  }

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

  const visibility = forecast[0]?.visibility ?? 10;
  if (visibility < 2) {
    risks.push({ type: "Low Visibility", severity: "High", icon: CloudFog, description: `Visibility at ${visibility} km. Fog or dust conditions reducing operational safety.` });
  }

  if (temp <= 2) {
    risks.push({ type: "Frost Risk", severity: temp <= 0 ? "High" : "Moderate", icon: Snowflake, description: `Temperature at ${temp}°C. Frost damage likely on exposed crops.` });
  }

  return risks.sort((a, b) => severityOrder(b.severity) - severityOrder(a.severity));
}

function assessAgriculturalImpact(
  forecast: any[],
  rainfall: RainfallStatus,
  humidity: HumidityStatus,
  temperature: TemperatureStatus,
  wind: WindStatus
): AgriculturalImpact[] {
  const impacts: AgriculturalImpact[] = [];

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

function assessFlightRisk(forecast: any[], wind: WindStatus): FlightRisk {
  const factors: string[] = [];
  let severity: Severity = "Low";

  const w = forecast[0];
  const humidity = w?.humidity ?? 50;
  const visibility = w?.visibility ?? 10;
  const pressure = w?.pressure ?? 1013;
  const gust = w?.windGust ?? 0;

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

  if (humidity < 25 && wind.speed > 20) {
    factors.push("Dust storm conditions: dry air + wind moving particulates across fields");
    severity = raiseSeverity(severity, "High");
  }

  if (visibility < 3) {
    factors.push(`Reduced visibility (${visibility} km) affecting safe movement and operations`);
    severity = raiseSeverity(severity, "Moderate");
  }
  if (visibility < 1) {
    severity = raiseSeverity(severity, "High");
  }

  if (pressure < THRESHOLDS.PRESSURE_DROP_STORM && gust > 40) {
    factors.push("Storm system moving through area — airborne debris risk");
    severity = raiseSeverity(severity, "High");
  }

  if (humidity > 60 && w?.temp > 25 && wind.speed < 15 && wind.speed > 5) {
    factors.push("Conditions favor pollen and spore dispersal — crop disease vector");
    severity = raiseSeverity(severity, "Low");
  }

  if (factors.length === 0) factors.push("No significant airborne or flight-related risks");

  return { severity, factors };
}

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
    case "Moderate": return "bg-warning/10 border-warning/20";
    case "Low": return "bg-muted border-border";
  }
}

function airQualityColor(level: AirQualityStatus["level"]): string {
  switch (level) {
    case "Hazardous": return "bg-destructive/10 text-destructive border border-destructive/20";
    case "Poor": return "bg-destructive/5 text-destructive border border-destructive/10";
    case "Moderate": return "bg-amber-100 text-amber-800 border border-amber-200 dark:bg-amber-950/30 dark:text-amber-300 dark:border-amber-900/50";
    case "Good": return "bg-primary/10 text-primary border border-primary/20";
  }
}

function useEnvironmentState(forecast: any[]): EnvironmentState | null {
  return useMemo(() => {
    if (!forecast || forecast.length === 0) return null;

    const mapped = forecast.map((day: any) => ({
      temp: day.temp ?? day.tempHigh ?? 25,
      humidity: day.humidity ?? 60,
      windSpeed: day.windSpeed ?? day.wind ?? 5,
      windGust: day.windGust ?? (day.wind ? day.wind * 1.4 : 8),
      rainfall: day.rainfall ?? day.rainMm ?? (day.rainProb != null ? day.rainProb * 0.3 : 0),
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
// MAIN ENVIRONMENTAL & AGRORISK COMPONENT
// =============================================================================
export default function EnvironmentalMonitor() {
  const { user } = useAuth();
  const { position } = useGeolocation();
  const [assessmentTarget, setAssessmentTarget] = useState<{
    lat: number; lon: number; locationName: string; boundary?: [number, number][]; manual: boolean;
  }>(() => ({
    lat: position.lat, lon: position.lon, locationName: position.locationName, manual: false,
  }));
  const { forecast, source: weatherSource, lastUpdated: weatherLastUpdated, forecastLocation } = useWeather(
    assessmentTarget.lat,
    assessmentTarget.lon,
  );
  const locationIsFresh = assessmentTarget.manual ||
    position.source === "gps" ||
    (position.source === "cached" && !!position.updatedAt && Date.now() - position.updatedAt < 24 * 60 * 60 * 1000);
  const weatherIsFresh = weatherSource === "live" ||
    (weatherSource === "cache" && !!weatherLastUpdated && Date.now() - weatherLastUpdated.getTime() < 60 * 60 * 1000);
  const forecastMatchesTarget = !!forecastLocation && Math.abs(forecastLocation.lat - assessmentTarget.lat) < 0.1 && Math.abs(forecastLocation.lon - assessmentTarget.lon) < 0.1;
  const weatherUsable = forecastMatchesTarget && locationIsFresh && weatherIsFresh;
  const envState = useEnvironmentState(forecast);

  const currentUserId = useRef<string | null>(user?.id ?? null);
  const previousUserId = useRef<string | null>(user?.id ?? null);
  currentUserId.current = user?.id ?? null;
  const farmRequestVersion = useRef(0);
  const incidentRequestVersion = useRef(0);
  const aiEnvRequestVersion = useRef(0);

  useEffect(() => {
    setAssessmentTarget((current) => current.manual ? current : {
      lat: position.lat,
      lon: position.lon,
      locationName: position.locationName,
      manual: false,
    });
  }, [position.lat, position.lon, position.locationName]);

  // Tab State
  const [activeTab, setActiveTab] = useState<"sensors" | "agrorisk">("sensors");

  // AgroRisk Interactive Map States
  const [activeMode, setActiveMode] = useState<"automatic" | "quick" | "boundary" | "incident">("quick");
  const [mapCenter, setMapCenter] = useState<[number, number]>([position.lat || 5.6037, position.lon || -0.187]);
  const [mapZoom, setMapZoom] = useState(12);

  // Map markers & geometries
  const [clickPoint, setClickPoint] = useState<[number, number] | null>(null);
  const [clickLocationName, setClickLocationName] = useState("");
  const [selectedFarmId, setSelectedFarmId] = useState<string>("");
  const [drawnBoundary, setDrawnBoundary] = useState<[number, number][]>([]);

  // Owner-scoped DB and local fallback states.
  const [farms, setFarms] = useState<SavedFarm[]>([]);
  const [incidents, setIncidents] = useState<IncidentReport[]>([]);
  const [loadingFarms, setLoadingFarms] = useState(false);

  // Dynamic risk assessment states
  const [agroRiskData, setAgroRiskData] = useState<LocalAgroRiskResult | null>(null);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [aiAgroRisk, setAiAgroRisk] = useState<AIAgroRiskAssessment | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);

  // Incident reporting state
  const [incidentType, setIncidentType] = useState<IncidentReport["type"]>("Flooding");
  const [incidentDesc, setIncidentDesc] = useState("");

  // Farm registration state
  const [farmName, setFarmName] = useState("");
  const [savingFarm, setSavingFarm] = useState(false);

  // Existing Dipa AI summary states
  const [aiEnv, setAiEnv] = useState<AIEnvironmentalAssessment | null>(null);
  const [isAiEnvLoading, setIsAiEnvLoading] = useState(false);

  const reloadFarms = useCallback(async () => {
    const userId = user?.id;
    const version = ++farmRequestVersion.current;
    if (!userId) {
      setFarms([]);
      setLoadingFarms(false);
      return;
    }
    setLoadingFarms(true);
    const localKey = userStorageKey("local_farms", userId);
    const localFarms = readUserStorage<SavedFarm[]>(localKey, []);
    try {
      const dbFarms = await dbListFarms(userId);
      if (version !== farmRequestVersion.current || userId !== currentUserId.current) return;
      // Legacy boundaries were stored in one browser key. Attach them only to
      // farm rows already returned by this account-scoped database query.
      const legacyBoundaries = readUserStorage<Record<string, [number, number][]>>("agrorisk_farm_boundaries", {});
      const mappedDb = dbFarms.map((farm: any) => ({
        id: farm.id,
        name: farm.name,
        lat: Number(farm.lat),
        lon: Number(farm.lon),
        boundary: (farm.boundary || legacyBoundaries[farm.id]) as [number, number][] | undefined,
      }));
      const finalFarms = [
        ...mappedDb,
        ...localFarms.filter((localFarm) => !mappedDb.some((dbFarm) => dbFarm.id === localFarm.id)),
      ];
      setFarms(finalFarms);
    } catch (error) {
      if (version !== farmRequestVersion.current || userId !== currentUserId.current) return;
      console.warn("[AgroRisk] Database farm load failed; showing this account's local fallback:", error);
      setFarms(localFarms);
    } finally {
      if (version === farmRequestVersion.current && userId === currentUserId.current) setLoadingFarms(false);
    }
  }, [user?.id]);

  const reloadIncidents = useCallback(async () => {
    const userId = user?.id;
    const version = ++incidentRequestVersion.current;
    if (!userId) {
      setIncidents([]);
      return;
    }
    const localKey = userStorageKey("incidents", userId);
    const localIncidents = readUserStorage<IncidentReport[]>(localKey, []);
    try {
      const dbIncidents = await dbListIncidents(userId);
      if (version !== incidentRequestVersion.current || userId !== currentUserId.current) return;
      const mapped = dbIncidents.map((incident) => ({
        id: incident.id,
        lat: Number(incident.lat),
        lon: Number(incident.lon),
        type: incident.incident_type,
        description: incident.description,
        date: incident.reported_at,
        status: "unverified" as const,
        source: "user_report" as const,
      }));
      setIncidents([
        ...mapped,
        ...localIncidents.filter((localIncident) => !mapped.some((item) => item.id === localIncident.id)),
      ]);
    } catch (error) {
      if (version !== incidentRequestVersion.current || userId !== currentUserId.current) return;
      console.warn("[AgroRisk] Database incident load failed; showing this account's local fallback:", error);
      setIncidents(localIncidents);
    }
  }, [user?.id]);

  useEffect(() => {
    const nextUserId = user?.id ?? null;
    if (previousUserId.current === nextUserId) return;
    previousUserId.current = nextUserId;
    setFarms([]);
    setIncidents([]);
    setSelectedFarmId("");
    setDrawnBoundary([]);
    setAgroRiskData(null);
    setAiAgroRisk(null);
    setAiEnv(null);
    setAssessmentTarget({
      lat: position.lat,
      lon: position.lon,
      locationName: position.locationName,
      manual: false,
    });
  }, [user?.id, position.lat, position.lon, position.locationName]);

  useEffect(() => {
    void reloadFarms();
    void reloadIncidents();
    return () => {
      farmRequestVersion.current += 1;
      incidentRequestVersion.current += 1;
    };
  }, [reloadFarms, reloadIncidents]);

  useEffect(() => {
    const userId = user?.id;
    if (!userId) return;
    const channel = supabase.channel(`agro-risk-owner-${userId}`)
      .on("postgres_changes", {
        event: "*", schema: "public", table: "farms", filter: `user_id=eq.${userId}`,
      }, () => { void reloadFarms(); })
      .on("postgres_changes", {
        event: "*", schema: "public", table: "geo_features", filter: `owner_id=eq.${userId}`,
      }, () => { void reloadFarms(); })
      .on("postgres_changes", {
        event: "*", schema: "public", table: "agro_risk_incidents", filter: `user_id=eq.${userId}`,
      }, () => { void reloadIncidents(); })
      .subscribe();

    const refreshOnFocus = () => {
      if (document.visibilityState === "visible") {
        void reloadFarms();
        void reloadIncidents();
      }
    };
    window.addEventListener("focus", refreshOnFocus);
    document.addEventListener("visibilitychange", refreshOnFocus);
    return () => {
      window.removeEventListener("focus", refreshOnFocus);
      document.removeEventListener("visibilitychange", refreshOnFocus);
      void supabase.removeChannel(channel);
    };
  }, [user?.id, reloadFarms, reloadIncidents]);

  // Reverse Geocoding helper for quick map pin
  const fetchAddress = async (lat: number, lon: number): Promise<string> => {
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&zoom=16`,
        { headers: { "Accept": "application/json", "User-Agent": "AgroClimate/1.0" } }
      );
      if (res.ok) {
        const data = await res.json();
        return data.display_name ? data.display_name.split(",").slice(0, 3).join(",") : `${lat.toFixed(4)}, ${lon.toFixed(4)}`;
      }
    } catch { /* Fall back to raw coordinates when reverse geocoding is unavailable. */ }
    return `${lat.toFixed(4)}, ${lon.toFixed(4)}`;
  };

  // ---------------------------------------------------------------------------
  // RISK EVALUATION TRIGGERS (DYNAMIC UPDATES)
  // ---------------------------------------------------------------------------
  const updateRiskAssessment = useCallback((
    lat: number,
    lon: number,
    boundary?: [number, number][],
    locName = "Selected Coordinates",
  ) => {
    if (!Number.isFinite(lat) || lat < -90 || lat > 90 || !Number.isFinite(lon) || lon < -180 || lon > 180) return;
    setAiError(null);
    setAiAgroRisk(null);
    setAiEnv(null);
    setAssessmentTarget({ lat, lon, boundary, locationName: locName, manual: true });
  }, []);

  // Local estimates and AI assessment are calculated only against a forecast
  // associated with the selected farm/map coordinates.
  useEffect(() => {
    if (!forecastMatchesTarget || !forecast?.length) {
      setAgroRiskData(null);
      setAiAgroRisk(null);
      setIsAiLoading(false);
      return;
    }

    const localAssessment = calculateAgroRiskLocal(
      assessmentTarget.lat,
      assessmentTarget.lon,
      assessmentTarget.boundary,
      forecast,
      incidents,
    );
    setAgroRiskData(localAssessment);

    if (!weatherUsable) {
      setAiAgroRisk(null);
      setAiError("AI risk analysis is paused because current provider weather or a recent location fix is unavailable. The local estimate is not an official warning.");
      setIsAiLoading(false);
      return;
    }

    let active = true;
    setAiError(null);
    setIsAiLoading(true);
    const run = async () => {
      try {
        const provider = getActiveProvider();
        const aiResponse = await provider.generateAgroRiskAssessment(
          assessmentTarget.locationName,
          assessmentTarget.lat,
          assessmentTarget.lon,
          assessmentTarget.boundary,
          forecast,
        );
        if (!active) return;
        if (aiResponse && typeof aiResponse.vulnerabilityScore === "number") {
          setAiAgroRisk(aiResponse);
        } else {
          throw new Error("Invalid AI payload");
        }
      } catch (error) {
        if (!active) return;
        console.warn("[AgroRisk] AI assessment unavailable:", error);
        setAiError("Advanced AI recommendations are unavailable. Viewing the local rule-based risk estimate.");
      } finally {
        if (active) setIsAiLoading(false);
      }
    };
    void run();
    return () => { active = false; };
  }, [assessmentTarget, forecast, forecastMatchesTarget, incidents, weatherUsable]);

  // Keep the map centred on the device location until the user selects a farm or map point.
  useEffect(() => {
    if (!Number.isFinite(position.lat) || !Number.isFinite(position.lon) || assessmentTarget.manual) return;
    setMapCenter([position.lat, position.lon]);
    setClickPoint([position.lat, position.lon]);
    setClickLocationName(position.locationName);
  }, [position.lat, position.lon, position.locationName, assessmentTarget.manual]);

  // ---------------------------------------------------------------------------
  // INTERACTIVE MAP CLICK ROUTER
  // ---------------------------------------------------------------------------
  const handleMapClick = async (lat: number, lon: number) => {
    setClickPoint([lat, lon]);

    if (activeMode === "boundary") {
      const newDrawn = [...drawnBoundary, [lat, lon] as [number, number]];
      setDrawnBoundary(newDrawn);
      updateRiskAssessment(lat, lon, newDrawn, "Custom Farm Boundary");
    } else if (activeMode === "quick") {
      setClickLocationName("Loading coordinates address...");
      const addr = await fetchAddress(lat, lon);
      setClickLocationName(addr);
      updateRiskAssessment(lat, lon, undefined, addr);
    } else if (activeMode === "incident") {
      // Do nothing, just register coords
      const addr = await fetchAddress(lat, lon);
      setClickLocationName(addr);
    }
  };

  // ---------------------------------------------------------------------------
  // USER ACTIONS: REGISTER FARMS & REPORT HAZARDS
  // ---------------------------------------------------------------------------
  const handleRegisterFarm = async () => {
    if (!user?.id) {
      alert("Sign in to save a farm location.");
      return;
    }
    if (!farmName.trim()) return;
    if (activeMode === "boundary") {
      const uniquePoints = new Set(drawnBoundary.map(([lat, lon]) => `${lat.toFixed(7)},${lon.toFixed(7)}`));
      const invalidPoint = drawnBoundary.some(([lat, lon]) => !Number.isFinite(lat) || lat < -90 || lat > 90 || !Number.isFinite(lon) || lon < -180 || lon > 180);
      if (drawnBoundary.length < 3 || uniquePoints.size < 3 || invalidPoint) {
        alert("Please draw a valid farm boundary with at least three distinct WGS84 points.");
        return;
      }
    }
    if (!clickPoint) return;

    setSavingFarm(true);
    const boundary = activeMode === "boundary" ? drawnBoundary : undefined;
    let savedFarm: SavedFarm;
    try {
      const dbFarm = await dbSaveFarm({
        name: farmName.trim(),
        location: { lat: clickPoint[0], lon: clickPoint[1] },
        user_id: user.id,
        boundary,
      });
      savedFarm = {
        id: dbFarm.id,
        name: dbFarm.name || farmName.trim(),
        lat: Number(dbFarm.lat),
        lon: Number(dbFarm.lon),
        boundary,
      };
    } catch (error) {
      if (currentUserId.current !== user.id) return;
      console.warn("[AgroRisk] Database farm save failed; storing a private local fallback:", error);
      savedFarm = {
        id: `local_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        name: farmName.trim(),
        lat: clickPoint[0],
        lon: clickPoint[1],
        boundary,
      };
      const localKey = userStorageKey("local_farms", user.id);
      const localFarms = readUserStorage<SavedFarm[]>(localKey, []);
      writeUserStorage(localKey, [savedFarm, ...localFarms]);
      alert("Farm saved on this device only. It could not be synchronized to your account yet.");
    } finally {
      setSavingFarm(false);
    }

    setFarmName("");
    setDrawnBoundary([]);
    setSelectedFarmId(savedFarm.id);
    setMapCenter([savedFarm.lat, savedFarm.lon]);
    setClickPoint([savedFarm.lat, savedFarm.lon]);
    setClickLocationName(savedFarm.name);
    updateRiskAssessment(savedFarm.lat, savedFarm.lon, savedFarm.boundary, savedFarm.name);
    await reloadFarms();
  };

  const handleReportIncident = async () => {
    if (!user?.id) {
      alert("Sign in to submit an incident report.");
      return;
    }
    if (!clickPoint) {
      alert("Please click a location on the map to specify the incident point.");
      return;
    }
    if (!incidentDesc.trim() || incidentDesc.trim().length > 2000) {
      alert("Please provide an incident description between 1 and 2,000 characters.");
      return;
    }

    const farmId = selectedFarmId && !selectedFarmId.startsWith("local_") ? selectedFarmId : undefined;
    let newIncident: IncidentReport;
    try {
      const saved = await dbSaveIncident({
        lat: clickPoint[0],
        lon: clickPoint[1],
        type: incidentType,
        description: incidentDesc.trim(),
        farmId,
      });
      newIncident = {
        id: saved.id,
        lat: Number(saved.lat),
        lon: Number(saved.lon),
        type: saved.incident_type,
        description: saved.description,
        date: saved.reported_at,
        status: "unverified",
        source: "user_report",
      };
    } catch (error) {
      if (currentUserId.current !== user.id) return;
      console.warn("[AgroRisk] Incident report database save failed; storing a private local fallback:", error);
      newIncident = {
        id: `local_incident_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        lat: clickPoint[0],
        lon: clickPoint[1],
        type: incidentType,
        description: incidentDesc.trim(),
        date: new Date().toISOString(),
        status: "unverified",
        source: "user_report",
      };
      const localKey = userStorageKey("incidents", user.id);
      const localIncidents = readUserStorage<IncidentReport[]>(localKey, []);
      writeUserStorage(localKey, [newIncident, ...localIncidents]);
      alert("Incident report saved on this device only. It could not be synchronized to your account yet.");
    }

    setIncidents((previous) => [newIncident, ...previous.filter((item) => item.id !== newIncident.id)]);
    setIncidentDesc("");
    updateRiskAssessment(clickPoint[0], clickPoint[1], drawnBoundary, clickLocationName);
  };

  const handleDeleteFarm = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!user?.id || !confirm("Are you sure you want to delete this farm?")) return;
    try {
      if (!id.startsWith("local_")) await dbDeleteFarm(id);
      const localKey = userStorageKey("local_farms", user.id);
      const localFarms = readUserStorage<SavedFarm[]>(localKey, []);
      writeUserStorage(localKey, localFarms.filter((farm) => farm.id !== id));
      setFarms((previous) => previous.filter((farm) => farm.id !== id));

      if (selectedFarmId === id) {
        setSelectedFarmId("");
        setDrawnBoundary([]);
        setAgroRiskData(null);
        setAiAgroRisk(null);
        setAssessmentTarget({
          lat: position.lat,
          lon: position.lon,
          locationName: position.locationName,
          manual: false,
        });
        setMapCenter([position.lat, position.lon]);
        setClickPoint([position.lat, position.lon]);
        setClickLocationName(position.locationName);
      }
    } catch (error) {
      alert(error instanceof Error ? error.message : "Could not delete farm.");
    }
  };

  const handleSelectFarm = (farm: SavedFarm) => {
    setSelectedFarmId(farm.id);
    setMapCenter([farm.lat, farm.lon]);
    setClickPoint([farm.lat, farm.lon]);
    setClickLocationName(farm.name);
    setMapZoom(14);
    setDrawnBoundary(farm.boundary || []);
    updateRiskAssessment(farm.lat, farm.lon, farm.boundary, farm.name);
  };

  // ---------------------------------------------------------------------------
  // EXISTING ECOLOGICAL health API FETCH (PRESERVED)
  // ---------------------------------------------------------------------------
  const fetchAiAssessment = useCallback(async (force = false) => {
    if (!forecast?.length || !assessmentTarget.locationName) return;
    if (!weatherUsable) {
      setAiEnv(null);
      setIsAiEnvLoading(false);
      return;
    }

    const locationKey = assessmentTarget.locationName.replace(/[^a-zA-Z0-9]/g, "").toLowerCase();
    const cacheKey = `agroclimate_ai_env_${locationKey}_${weatherLastUpdated?.getTime() || "current"}`;
    if (!force) {
      try {
        const cached = sessionStorage.getItem(cacheKey);
        if (cached) {
          const parsed = JSON.parse(cached);
          if (Date.now() - parsed.timestamp < 4 * 60 * 60 * 1000) {
            setAiEnv(parsed.assessment);
            return;
          }
        }
      } catch { /* cache is optional */ }
    }

    const requestVersion = ++aiEnvRequestVersion.current;
    setIsAiEnvLoading(true);
    try {
      const provider = getActiveProvider();
      const data = await provider.generateEnvironmentalAssessment(assessmentTarget.locationName, forecast);
      if (requestVersion === aiEnvRequestVersion.current && data && typeof data.ecologicalScore === "number") {
        setAiEnv(data);
        try { sessionStorage.setItem(cacheKey, JSON.stringify({ assessment: data, timestamp: Date.now() })); } catch { /* cache is optional */ }
      }
    } catch (error) {
      if (requestVersion === aiEnvRequestVersion.current) {
        setAiEnv(null);
        console.warn("[AgroRisk] AI environmental assessment unavailable:", error);
      }
    } finally {
      if (requestVersion === aiEnvRequestVersion.current) setIsAiEnvLoading(false);
    }
  }, [forecast, assessmentTarget.locationName, weatherUsable, weatherLastUpdated]);

  useEffect(() => {
    void fetchAiAssessment();
    return () => { aiEnvRequestVersion.current += 1; };
  }, [fetchAiAssessment]);

  // Merge legacy disasters
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

  // Clock tick
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
          <p className="text-sm">Loading environmental monitor…</p>
        </div>
      </div>
    );
  }

  const locationLabel = assessmentTarget.locationName !== "Unknown"
    ? assessmentTarget.locationName
    : `${assessmentTarget.lat.toFixed(2)}°, ${assessmentTarget.lon.toFixed(2)}°`;

  // Risk display configuration
  const overallScore = aiAgroRisk?.vulnerabilityScore ?? agroRiskData?.vulnerabilityScore ?? 0;
  const terrainText = aiAgroRisk?.terrainAnalysis ?? agroRiskData?.terrainAnalysis ?? "Analyzing terrain features...";
  const recommendations = aiAgroRisk?.recommendations ?? agroRiskData?.recommendations ?? [];
  const cropSuitability = aiAgroRisk?.suitability ?? agroRiskData?.suitability ?? [];

  const floodScore = aiAgroRisk?.floodScore ?? agroRiskData?.floodScore ?? 0;
  const waterlogScore = aiAgroRisk?.waterloggingScore ?? agroRiskData?.waterloggingScore ?? 0;
  const erosionScore = aiAgroRisk?.erosionScore ?? agroRiskData?.erosionScore ?? 0;
  const landslideScore = aiAgroRisk?.landslideScore ?? agroRiskData?.landslideScore ?? 0;
  const climateScore = aiAgroRisk?.climateScore ?? agroRiskData?.climateScore ?? 0;

  const getRiskClassification = (score: number) => {
    if (score >= 76) return { label: "CRITICAL RISK", color: "bg-destructive text-destructive-foreground", textColor: "text-destructive" };
    if (score >= 51) return { label: "HIGH RISK", color: "bg-orange-500 text-white", textColor: "text-orange-500" };
    if (score >= 26) return { label: "MODERATE RISK", color: "bg-warning text-warning-foreground", textColor: "text-warning" };
    return { label: "LOW RISK", color: "bg-primary text-primary-foreground", textColor: "text-primary" };
  };

  const getSuitabilityColor = (s: "high" | "medium" | "low") => {
    if (s === "high") return "bg-primary/20 text-primary border-primary/30";
    if (s === "medium") return "bg-warning/20 text-warning border-warning/30";
    return "bg-destructive/20 text-destructive border-destructive/30";
  };

  return (
    <div className="p-4 lg:p-8 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-foreground flex items-center gap-2 tracking-tight">
            Agro &amp; Climate Risk Intelligence
            {isAiLoading && <Loader2 className="h-5 w-5 animate-spin text-primary" />}
          </h1>
          <p className="text-sm text-muted-foreground">{locationLabel}</p>
        </div>
        <div className="flex items-center gap-3">
          {clickPoint && (
            <OpenInSatelliteButton lat={clickPoint[0]} lon={clickPoint[1]} label={clickLocationName || "AgroRisk selected location"} zoom={16}>
              Open selected risk location in Satellite
            </OpenInSatelliteButton>
          )}
          {/* Tabs switch */}
          <div className="bg-muted p-1 rounded-lg flex items-center border border-border">
            <button
              onClick={() => setActiveTab("sensors")}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                activeTab === "sensors"
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Weather &amp; Environment
            </button>
            <button
              onClick={() => setActiveTab("agrorisk")}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all flex items-center gap-1 ${
                activeTab === "agrorisk"
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Sparkles className="h-3 w-3 text-primary animate-pulse" />
              AgroRisk Intelligence
            </button>
          </div>
          <div className="hidden md:flex items-center gap-1.5 text-xs text-muted-foreground">
            <RefreshCw className="h-3 w-3" />
            <span>Weather input: {!forecastMatchesTarget ? "Updating selected location" : weatherSource === "live" ? "Live provider" : weatherSource === "cache" ? "Cached provider" : "Sample fallback"} · Updated {envState.lastUpdated.toLocaleTimeString()}</span>
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-xs text-muted-foreground">
        AgroRisk scores are model-based estimates using the forecast for the selected coordinates, weather-derived soil proxies, coordinate-based terrain heuristics and private user-submitted incident reports. Soil moisture is not a soil-sensor reading; terrain is not a DEM/survey; incident reports are unverified and only recent reports influence the estimate. These outputs are not official warnings. AI analysis is withheld when provider weather or a recent/selected location basis is unavailable.
      </div>

      {/* =======================================================================
          TAB 1: ENVIRONMENT SENSORS (RAW DATA LAYER - PRESERVED & ENHANCED)
          ======================================================================= */}
      {activeTab === "sensors" && (
        <div className="space-y-6 animate-fadeIn">
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
                      <Sparkles className="h-3 w-3" /> Dipa Ecological Analysis
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
                  disabled={isAiEnvLoading}
                >
                  {isAiEnvLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                  Analyze Ecology
                </Button>
              </CardContent>
            </Card>
          ) : (
            <Card className="border-border/40 bg-card/50">
              <CardContent className="p-4 flex items-center justify-between text-xs">
                <span className="text-muted-foreground flex items-center gap-1.5">
                  <Sparkles className="h-4 w-4 text-primary animate-pulse" />
                  Unlock real-time AI Ecological Risk and Outbreak Assessments for {locationLabel}.
                </span>
                <Button
                  size="sm"
                  className="bg-primary text-primary-foreground flex items-center gap-1.5"
                  onClick={() => fetchAiAssessment(true)}
                  disabled={isAiEnvLoading}
                >
                  {isAiEnvLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                  Trigger AI Analysis
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Primary Conditions Grid */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {/* Rainfall */}
            <Card className="border-border shadow-sm">
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
            <Card className="border-border shadow-sm">
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
            <Card className="border-border shadow-sm">
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
            <Card className="border-border shadow-sm">
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
            <Card className="border-destructive/20 shadow-sm">
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
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">{d.description}</p>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Agricultural Impact */}
          <Card className="shadow-sm">
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

          {/* Secondary Details Grid */}
          <div className="grid md:grid-cols-2 gap-4">
            <Card className="shadow-sm">
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

            <Card className="shadow-sm">
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
                        <AlertTriangle className="h-3 w-3 mt-0.5 flex-shrink-0 text-amber-500" />
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

          {/* 7-Day Outlook */}
          <Card className="shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2 text-foreground">
                <Gauge className="h-4 w-4 text-muted-foreground" />
                7-Day Environmental Outlook
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-7 gap-2 overflow-x-auto min-w-[500px]">
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
                    <div key={i} className="bg-muted rounded-lg p-2 text-center min-w-[70px]">
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
      )}

      {/* =======================================================================
          TAB 2: AGRORISK INTELLIGENCE (NEW LAYER)
          ======================================================================= */}
      {activeTab === "agrorisk" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 animate-fadeIn">
          {/* LEFT COLUMN: Map & Farmer Experience Modes (8 Columns) */}
          <div className="lg:col-span-7 space-y-6">
            <Card className="border-border shadow-md overflow-hidden">
              <CardHeader className="pb-3 border-b border-border bg-muted/40">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  <div>
                    <CardTitle className="text-sm font-bold flex items-center gap-1.5 text-foreground">
                      <MapPin className="h-4 w-4 text-primary" />
                      AgroRisk Interactive Map Layer
                    </CardTitle>
                    <p className="text-xs text-muted-foreground">Risk estimates combine weather-provider data or fallback forecasts, terrain calculations and user-reported incidents. No field sensor network is connected.</p>
                  </div>
                  {/* Mode select buttons */}
                  <div className="flex flex-wrap gap-1 bg-background p-1 rounded-md border text-xs">
                    <button
                      onClick={() => { setActiveMode("quick"); setDrawnBoundary([]); }}
                      className={`px-2 py-1 rounded transition-colors ${activeMode === "quick" ? "bg-primary text-primary-foreground font-semibold" : "text-muted-foreground hover:text-foreground"}`}
                    >
                      Quick Pin
                    </button>
                    <button
                      onClick={() => { setActiveMode("automatic"); setDrawnBoundary([]); }}
                      className={`px-2 py-1 rounded transition-colors ${activeMode === "automatic" ? "bg-primary text-primary-foreground font-semibold" : "text-muted-foreground hover:text-foreground"}`}
                    >
                      Monitor Farms
                    </button>
                    <button
                      onClick={() => { setActiveMode("boundary"); setDrawnBoundary([]); }}
                      className={`px-2 py-1 rounded transition-colors ${activeMode === "boundary" ? "bg-primary text-primary-foreground font-semibold" : "text-muted-foreground hover:text-foreground"}`}
                    >
                      Draw Boundary
                    </button>
                    <button
                      onClick={() => { setActiveMode("incident"); setDrawnBoundary([]); }}
                      className={`px-2 py-1 rounded transition-colors flex items-center gap-1 ${activeMode === "incident" ? "bg-destructive text-destructive-foreground font-semibold" : "text-muted-foreground hover:text-foreground"}`}
                    >
                      <AlertTriangle className="h-2.5 w-2.5" />
                      Report Hazard
                    </button>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="p-0 relative">\n                <div className="border-b bg-amber-500/5 px-4 py-2 text-xs text-muted-foreground">Reference hazard polygons are illustrative geographic context, not live satellite detections or official hazard boundaries. Reported incidents are user-submitted and are not independently verified.</div>
                {/* Information bar depending on active mode */}
                <div className="bg-primary/10 border-b border-primary/20 px-4 py-2.5 text-xs text-foreground flex items-center justify-between z-10 relative">
                  {activeMode === "quick" && (
                    <span><strong>Quick Location Analysis:</strong> Click anywhere on the map to evaluate soil, water, and terrain risk.</span>
                  )}
                  {activeMode === "automatic" && (
                    <span><strong>Automatic Monitoring:</strong> Click on your registered farms below to pull real-time weather & slope logs.</span>
                  )}
                  {activeMode === "boundary" && (
                    <span className="flex flex-col sm:flex-row sm:items-center justify-between w-full gap-2">
                      <span><strong>Farm Boundary Analysis:</strong> Click points on the map to outline boundaries. Click "Register" to save.</span>
                      {drawnBoundary.length > 0 && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setDrawnBoundary([])}
                          className="h-6 text-[10px] text-destructive hover:bg-destructive/10 shrink-0"
                        >
                          Clear Vertices ({drawnBoundary.length})
                        </Button>
                      )}
                    </span>
                  )}
                  {activeMode === "incident" && (
                    <span><strong>Incident Reporting:</strong> Click a spot on the map, select the type of hazard, and save to warn others.</span>
                  )}
                </div>

                {/* Leaflet Map */}
                <div className="h-[450px] w-full z-0 relative">
                  <MapContainer center={mapCenter} zoom={mapZoom} className="h-full w-full">
                    <TileLayer
                      attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                      url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    />
                    
                    {/* Geolocation Fly to helper */}
                    <FlyTo lat={mapCenter[0]} lon={mapCenter[1]} zoom={mapZoom} />

                    {/* Interactive clicks listener */}
                    <MapEventsListener onMapClick={handleMapClick} activeMode={activeMode} />

                    {/* Click position marker */}
                    {clickPoint && (
                      <Marker position={clickPoint}>
                        <Popup>
                          <div className="text-xs p-1">
                            <p className="font-semibold text-primary">{activeMode === "incident" ? "Incident Location Pin" : "Selected Target"}</p>
                            <p className="text-muted-foreground mt-0.5">{clickLocationName || `${clickPoint[0].toFixed(4)}, ${clickPoint[1].toFixed(4)}`}</p>
                          </div>
                        </Popup>
                      </Marker>
                    )}

                    {/* Approximate reference overlays only; not surveyed hazard boundaries. */}
                    {HAZARD_OVERLAYS.map(ho => (
                      <Polygon
                        key={ho.name}
                        positions={ho.coords as [number, number][]}
                        pathOptions={{
                          color: ho.color,
                          fillColor: ho.color,
                          fillOpacity: ho.fillOpacity,
                          weight: 2
                        }}
                      >
                        <Popup>
                          <div className="text-xs p-1">
                            <Badge variant="outline" className="mb-1 text-[8px]">Reference overlay · not live-verified</Badge><p className="font-semibold text-[10px] text-destructive">{ho.risk}</p>
                            <p className="font-bold">{ho.name}</p>
                            <p className="mt-1">Illustrative reference area only; not a verified boundary or current hazard observation.</p>
                          </div>
                        </Popup>
                      </Polygon>
                    ))}

                    {/* Dynamic color-coded zones based on incident reports */}
                    {incidents.map(inc => {
                      const color = inc.type === "Flooding" || inc.type === "Waterlogging" ? "#dc2626" : "#f97316";
                      return (
                        <Circle
                          key={inc.id}
                          center={[inc.lat, inc.lon]}
                          radius={1800} // 1.8km radius
                          pathOptions={{
                            color: color,
                            fillColor: color,
                            fillOpacity: 0.15,
                            weight: 1,
                            dashArray: "4 4"
                          }}
                        />
                      );
                    })}

                    {/* Incident report markers */}
                    {incidents.map(inc => (
                      <Marker
                        key={inc.id}
                        position={[inc.lat, inc.lon]}
                        icon={L.divIcon({
                          html: `<div class="bg-destructive border-2 border-white rounded-full p-1.5 text-white flex items-center justify-center shadow-lg" style="width: 28px; height: 28px;">
                                   <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                                 </div>`,
                          className: "",
                          iconSize: [28, 28],
                          iconAnchor: [14, 14]
                        })}
                      >
                        <Popup>
                          <div className="text-xs p-1">
                            <Badge variant="destructive" className="mb-1 text-[9px]">{inc.type} · User Report</Badge>
                            <Badge variant="outline" className="mb-1 ml-1 text-[8px]">Unverified</Badge>
                            <p className="font-semibold">{inc.description}</p>
                            <p className="text-[10px] text-muted-foreground mt-1">Reported: {new Date(inc.date).toLocaleString()}</p>
                          </div>
                        </Popup>
                      </Marker>
                    ))}

                    {/* User Drawn Farm boundary polygon */}
                    {drawnBoundary.length > 1 && (
                      <Polygon
                        positions={drawnBoundary}
                        pathOptions={{
                          color: "#16a34a",
                          fillColor: "#16a34a",
                          fillOpacity: 0.25,
                          weight: 3
                        }}
                      />
                    )}

                    {/* Saved Farm polygons & markers */}
                    {farms.map(f => (
                      <div key={f.id}>
                        {f.boundary && f.boundary.length > 2 && (
                          <Polygon
                            positions={f.boundary}
                            pathOptions={{
                              color: selectedFarmId === f.id ? "#14b8a6" : "#22c55e",
                              fillColor: selectedFarmId === f.id ? "#14b8a6" : "#22c55e",
                              fillOpacity: 0.15,
                              weight: selectedFarmId === f.id ? 4 : 2
                            }}
                          />
                        )}
                        <Marker
                          position={[f.lat, f.lon]}
                          icon={L.divIcon({
                            html: `<div class="bg-emerald-600 border-2 border-white rounded-full p-1 text-white flex items-center justify-center shadow-md ${selectedFarmId === f.id ? "ring-4 ring-emerald-500/30 scale-110" : ""}" style="width: 24px; height: 24px;">
                                     <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                                   </div>`,
                            className: "",
                            iconSize: [24, 24],
                            iconAnchor: [12, 12]
                          })}
                        >
                          <Popup>
                            <div className="text-xs p-1">
                              <p className="font-bold text-emerald-700 flex items-center gap-1">
                                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                                {f.name}
                              </p>
                              <p className="text-[10px] text-muted-foreground">Registered Location</p>
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-6 text-[10px] w-full mt-2"
                                onClick={() => handleSelectFarm(f)}
                              >
                                View Risks
                              </Button>
                            </div>
                          </Popup>
                        </Marker>
                      </div>
                    ))}
                  </MapContainer>
                </div>
              </CardContent>
            </Card>

            {/* Farm registration / Incident Report panels below map */}
            {clickPoint && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* 1. Farm Register Box */}
                {(activeMode === "boundary" || activeMode === "quick") && (
                  <Card className="border-border shadow-sm">
                    <CardHeader className="py-3 px-4 border-b">
                      <CardTitle className="text-xs font-bold flex items-center gap-1">
                        <Plus className="h-4 w-4 text-primary" />
                        Register Selected Plot
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-4 space-y-3">
                      <div className="space-y-1">
                        <Label htmlFor="farm-name" className="text-xs">Farm Name</Label>
                        <Input
                          id="farm-name"
                          placeholder="e.g. Volta Valley Maize Farm"
                          value={farmName}
                          onChange={(e) => setFarmName(e.target.value)}
                          className="h-8 text-xs"
                        />
                      </div>
                      <div className="text-[10px] text-muted-foreground bg-muted p-2 rounded">
                        <strong>Coordinates:</strong> {clickPoint[0].toFixed(5)}, {clickPoint[1].toFixed(5)}
                        {activeMode === "boundary" && ` (${drawnBoundary.length} vertices drawn)`}
                      </div>
                      <Button
                        size="sm"
                        onClick={handleRegisterFarm}
                        disabled={savingFarm || !farmName.trim()}
                        className="w-full h-8 text-xs"
                      >
                        {savingFarm ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Save Farm Location"}
                      </Button>
                    </CardContent>
                  </Card>
                )}

                {/* 2. Hazard Incident Reporter */}
                {activeMode === "incident" && (
                  <Card className="border-destructive/20 bg-destructive/5 shadow-sm">
                    <CardHeader className="py-3 px-4 border-b border-destructive/10">
                      <CardTitle className="text-xs font-bold text-destructive flex items-center gap-1">
                        <AlertTriangle className="h-4 w-4" />
                        Report Localized Hazard
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-4 space-y-3">
                      <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-1 col-span-2">
                          <Label className="text-xs">Hazard Category</Label>
                          <select
                            value={incidentType}
                            onChange={(e: any) => setIncidentType(e.target.value)}
                            className="w-full h-8 text-xs rounded-md border bg-background px-2"
                          >
                            <option value="Flooding">Flooding</option>
                            <option value="Waterlogging">Waterlogging</option>
                            <option value="Soil Erosion">Soil Erosion</option>
                            <option value="Landslide">Landslide</option>
                            <option value="Drought">Drought</option>
                          </select>
                        </div>
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor="incident-desc" className="text-xs">Incident Description</Label>
                        <Input
                          id="incident-desc"
                          placeholder="Describe severe waterlogging, landslide blockages..."
                          value={incidentDesc}
                          onChange={(e) => setIncidentDesc(e.target.value)}
                          className="h-8 text-xs"
                        />
                      </div>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={handleReportIncident}
                        disabled={!incidentDesc.trim()}
                        className="w-full h-8 text-xs"
                      >
                        Broadcast Report
                      </Button>
                    </CardContent>
                  </Card>
                )}

                {/* 3. Automatic Monitoring List */}
                {activeMode === "automatic" && (
                  <Card className="border-border shadow-sm col-span-2">
                    <CardHeader className="py-3 px-4 border-b">
                      <CardTitle className="text-xs font-bold">
                        Registered Farms ({farms.length})
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-4 max-h-48 overflow-y-auto">
                      {farms.length === 0 ? (
                        <p className="text-xs text-muted-foreground text-center py-4">No farms registered yet. Use Quick Pin or Draw Boundary to save farms.</p>
                      ) : (
                        <div className="space-y-1">
                          {farms.map(f => (
                            <div
                              key={f.id}
                              onClick={() => handleSelectFarm(f)}
                              className={`flex items-center justify-between p-2 rounded text-xs cursor-pointer border ${selectedFarmId === f.id ? "bg-primary/10 border-primary/20" : "hover:bg-muted border-transparent"}`}
                            >
                              <div className="flex items-center gap-2">
                                <div className="h-2 w-2 rounded-full bg-emerald-500" />
                                <span className="font-semibold">{f.name}</span>
                                <span className="text-[10px] text-muted-foreground">({f.boundary ? "Polygon" : "Pin"})</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="text-[10px] text-muted-foreground">{f.lat.toFixed(4)}, {f.lon.toFixed(4)}</span>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  onClick={(e) => handleDeleteFarm(f.id, e)}
                                  className="h-6 w-6 text-destructive hover:bg-destructive/10"
                                >
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )}
              </div>
            )}
          </div>

          {/* RIGHT COLUMN: AgroRisk Intelligence Panel (5 Columns) */}
          <div className="lg:col-span-5 space-y-6">
            {agroRiskData ? (
              <div className="space-y-6">
                {/* 1. Vulnerability Scoring Ring */}
                <Card className="border-primary/20 bg-primary/5 overflow-hidden relative shadow-md">
                  <div className="absolute top-0 right-0 h-32 w-32 bg-primary/10 rounded-full blur-3xl animate-pulse" />
                  <CardContent className="p-5 flex items-center gap-5">
                    {/* Ring score */}
                    <div className="relative h-24 w-24 flex items-center justify-center flex-shrink-0">
                      <svg className="w-full h-full transform -rotate-90">
                        <circle cx="48" cy="48" r="38" stroke="hsl(var(--border))" strokeWidth="8" fill="transparent" />
                        <circle
                          cx="48" cy="48" r="38"
                          stroke={overallScore > 75 ? "#dc2626" : overallScore > 50 ? "#f97316" : overallScore > 25 ? "#facc15" : "#16a34a"}
                          strokeWidth="8"
                          fill="transparent"
                          strokeDasharray={2 * Math.PI * 38}
                          strokeDashoffset={2 * Math.PI * 38 * (1 - overallScore / 100)}
                          className="transition-all duration-1000 ease-out"
                        />
                      </svg>
                      <div className="absolute text-center">
                        <span className="text-2xl font-black text-foreground">{overallScore}</span>
                        <p className="text-[7px] text-muted-foreground font-semibold uppercase">Vulnerability</p>
                      </div>
                    </div>
                    
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center gap-2">
                        <Badge className={`${getRiskClassification(overallScore).color} border-transparent text-[9px] py-0 px-2`}>
                          {getRiskClassification(overallScore).label}
                        </Badge>
                      </div>
                      <p className="text-sm font-bold text-foreground">Farm Vulnerability Score</p>
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        Rule-based vulnerability estimate using coordinate terrain heuristics, {weatherSource === "live" ? "live provider weather" : weatherSource === "cache" ? "cached provider weather" : "sample fallback weather"}, and recent unverified user reports. This is not a direct sensor measurement or an official hazard warning.
                      </p>
                    </div>
                  </CardContent>
                </Card>

                {/* 2. Terrain & Specific Hazard Subscores */}
                <Card className="shadow-sm">
                  <CardHeader className="pb-3 border-b">
                    <CardTitle className="text-xs font-bold flex items-center gap-1.5 text-foreground">
                      <Mountain className="h-4 w-4 text-primary" />
                      Terrain Risk & Hazard Indicators
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-4 space-y-4">
                    {/* Terrain classification text */}
                    <div className="text-xs text-muted-foreground bg-muted p-3 rounded-lg border border-border/40 italic">
                      "{terrainText}"
                    </div>

                    {/* Progress bars for individual risks */}
                    <div className="space-y-3">
                      {/* Flood Risk */}
                      <div className="space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-semibold text-muted-foreground flex items-center gap-1"><Waves className="h-3 w-3 text-blue-500" /> Flood Risk</span>
                          <span className={`font-bold ${getRiskClassification(floodScore).textColor}`}>{floodScore}%</span>
                        </div>
                        <div className="w-full bg-muted h-2 rounded-full overflow-hidden">
                          <div className={`h-full ${getRiskClassification(floodScore).textColor.replace('text', 'bg')}`} style={{ width: `${floodScore}%` }} />
                        </div>
                      </div>

                      {/* Waterlogging Risk */}
                      <div className="space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-semibold text-muted-foreground flex items-center gap-1"><Droplets className="h-3 w-3 text-cyan-500" /> Waterlogging Risk</span>
                          <span className={`font-bold ${getRiskClassification(waterlogScore).textColor}`}>{waterlogScore}%</span>
                        </div>
                        <div className="w-full bg-muted h-2 rounded-full overflow-hidden">
                          <div className={`h-full ${getRiskClassification(waterlogScore).textColor.replace('text', 'bg')}`} style={{ width: `${waterlogScore}%` }} />
                        </div>
                      </div>

                      {/* Erosion Risk */}
                      <div className="space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-semibold text-muted-foreground flex items-center gap-1"><Wind className="h-3 w-3 text-orange-500" /> Soil Erosion Risk</span>
                          <span className={`font-bold ${getRiskClassification(erosionScore).textColor}`}>{erosionScore}%</span>
                        </div>
                        <div className="w-full bg-muted h-2 rounded-full overflow-hidden">
                          <div className={`h-full ${getRiskClassification(erosionScore).textColor.replace('text', 'bg')}`} style={{ width: `${erosionScore}%` }} />
                        </div>
                      </div>

                      {/* Landslide Risk */}
                      <div className="space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-semibold text-muted-foreground flex items-center gap-1"><Mountain className="h-3 w-3 text-amber-600" /> Landslide Risk</span>
                          <span className={`font-bold ${getRiskClassification(landslideScore).textColor}`}>{landslideScore}%</span>
                        </div>
                        <div className="w-full bg-muted h-2 rounded-full overflow-hidden">
                          <div className={`h-full ${getRiskClassification(landslideScore).textColor.replace('text', 'bg')}`} style={{ width: `${landslideScore}%` }} />
                        </div>
                      </div>

                      {/* Climate Risk */}
                      <div className="space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-semibold text-muted-foreground flex items-center gap-1"><Sun className="h-3 w-3 text-yellow-500" /> Climate / Drought Risk</span>
                          <span className={`font-bold ${getRiskClassification(climateScore).textColor}`}>{climateScore}%</span>
                        </div>
                        <div className="w-full bg-muted h-2 rounded-full overflow-hidden">
                          <div className={`h-full ${getRiskClassification(climateScore).textColor.replace('text', 'bg')}`} style={{ width: `${climateScore}%` }} />
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* 3. Crop Suitability Analysis */}
                <Card className="shadow-sm">
                  <CardHeader className="pb-3 border-b">
                    <CardTitle className="text-xs font-bold flex items-center gap-1.5 text-foreground">
                      <Sprout className="h-4 w-4 text-primary" />
                      Agricultural Suitability Analysis
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-4 space-y-2.5 max-h-80 overflow-y-auto">
                    {cropSuitability.map((item, i) => (
                      <div key={i} className="flex items-start gap-3 p-2 rounded-lg border border-border/40 text-xs">
                        <div className="flex-1">
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-semibold text-foreground">{item.crop}</span>
                            <Badge className={`${getSuitabilityColor(item.suitability as any)} border text-[8px] py-0 px-2 uppercase font-bold`}>
                              {item.suitability}
                            </Badge>
                          </div>
                          <p className="text-[11px] text-muted-foreground mt-1">{item.notes}</p>
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>

                {/* 4. Actionable recommendations */}
                <Card className="border-primary/20 shadow-sm">
                  <CardHeader className="pb-3 border-b bg-primary/5">
                    <CardTitle className="text-xs font-bold flex items-center gap-1.5 text-foreground">
                      <ShieldAlert className="h-4 w-4 text-primary animate-pulse" />
                      Proactive Farming Recommendations
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-4">
                    {aiError && (
                      <p className="text-[10px] text-amber-600 mb-3 bg-amber-50 dark:bg-amber-950/20 p-2 rounded border border-amber-500/20">{aiError}</p>
                    )}
                    <ul className="space-y-2">
                      {recommendations.map((rec, i) => (
                        <li key={i} className="text-xs text-muted-foreground flex items-start gap-2">
                          <CheckCircle2 className="h-4 w-4 text-emerald-600 mt-0.5 shrink-0" />
                          <span>{rec}</span>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              </div>
            ) : (
              <Card className="border-border/40 shadow-sm">
                <CardContent className="p-8 text-center text-xs text-muted-foreground">
                  <HelpCircle className="h-8 w-8 text-muted-foreground/40 mx-auto mb-2" />
                  Select or click any coordinate pin on the map to display its AgroRisk vulnerability sub-scores and recommendations.
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
