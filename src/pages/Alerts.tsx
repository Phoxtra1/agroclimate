import { useState, useEffect, useMemo, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useGeolocation } from "@/hooks/useGeolocation";
import { useWeather } from "@/hooks/useWeather";
import { useToast } from "@/hooks/use-toast";
import { useUserAlerts } from "@/hooks/useUserAlerts";
import {
  Bell, ChevronDown, ChevronUp, Check, Trash2,
  MessageSquarePlus, Send, Loader2,
  Wind, Droplets, Thermometer, CloudRain, CloudLightning,
  Waves, Plane, Eye, Sprout, Fish
} from "lucide-react";
import {
  AlertTriangle, CheckCircle, Info, AlertOctagon
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";

/* ============================================================
 * TYPES & INTERFACES
 * ============================================================ */

/** Severity levels for alert classification */
type Severity = "info" | "success" | "warning" | "danger";

/** Alert type matching the visual style map */
type AlertType = "info" | "success" | "warning" | "danger";

/** Industry tags for filtering relevance */
type IndustryTag =
  | "crop"
  | "livestock"
  | "aquaculture"
  | "flight"
  | "surveyor"
  | "general";

/** Timing window for proactive alerts */
type TimingWindow = "Next 24h" | "1–3 Days" | "3–5 Days" | "4–7 Days";

/** A single weather data point from the forecast */
interface WeatherDataPoint {
  date: string;
  temp: number;          // °C
  humidity: number;      // %
  windSpeed: number;     // km/h
  windGust?: number;     // km/h
  rainfall: number;      // mm
  description: string;
  pressure?: number;     // hPa
  visibility?: number;   // km
  uvIndex?: number;
}

/** A generated proactive alert */
interface ProactiveAlert {
  id: string;
  type: AlertType;
  title: string;
  message: string;
  detail: string;        // "Why" — contextual supporting data
  timing: TimingWindow;
  tags: IndustryTag[];
  isRead: boolean;
  time: string;
  icon: string;          // icon key for rendering
}

/* ============================================================
 * THRESHOLDS — Configurable trigger points for alert generation
 * ============================================================
 *
 * These thresholds determine when an alert is fired. They are
 * calibrated to avoid false alerts while providing sufficient
 * lead time for preparation.
 * ============================================================ */

const THRESHOLDS = {
  // --- Rainfall thresholds (mm/day) ---
  LIGHT_RAIN: 2.5,
  MODERATE_RAIN: 10,
  HEAVY_RAIN: 25,
  EXTREME_RAIN: 50,

  // --- Wind thresholds (km/h) ---
  MODERATE_WIND: 30,
  STRONG_WIND: 50,
  SEVERE_WIND: 75,       // Potential tornado / cyclone conditions
  EXTREME_WIND: 100,     // Confirmed severe storm / tornado

  // --- Temperature thresholds (°C) ---
  FROST_RISK: 3,
  COLD_STRESS: 5,
  HEAT_STRESS_LIVESTOCK: 32,
  EXTREME_HEAT: 38,
  AQUA_TEMP_LOW: 15,
  AQUA_TEMP_HIGH: 32,

  // --- Humidity thresholds (%) ---
  FUNGAL_RISK_HUMIDITY: 85,
  DUST_STORM_LOW_HUMIDITY: 20,

  // --- Dry period (consecutive days without significant rain) ---
  DRY_PERIOD_IRRIGATION: 5,
  PROLONGED_DRY: 14,

  // --- Flight / aerial risk ---
  FLIGHT_WIND_CAUTION: 35,
  FLIGHT_WIND_DANGER: 55,
  FLIGHT_VISIBILITY_LOW: 3,    // km
  FLIGHT_GUST_SEVERE: 65,

  // --- Pressure drop for storm prediction (hPa over 24h) ---
  RAPID_PRESSURE_DROP: 8,
};

/* ============================================================
 * 1. WEATHER ANALYSIS
 * ------------------------------------------------------------
 * Parses raw forecast data and classifies conditions.
 * Returns structured insights for the recommendation engine.
 * ============================================================ */

interface WeatherInsight {
  daysOfData: number;
  maxRainfall: number;
  totalRainfall: number;
  consecutiveDryDays: number;
  maxWindSpeed: number;
  maxWindGust: number;
  maxTemp: number;
  minTemp: number;
  avgHumidity: number;
  maxHumidity: number;
  hasFrostRisk: boolean;
  hasHeatStress: boolean;
  hasHeavyRain: boolean;
  hasStormRisk: boolean;
  hasTornadoRisk: boolean;
  needsIrrigation: boolean;
  pressureDropDetected: boolean;
  lowVisibility: boolean;
  dataByDay: WeatherDataPoint[];
}

/**
 * analyzeWeatherData
 *
 * HOW IT WORKS:
 * - Iterates through forecast data points (typically 7 days).
 * - Calculates aggregates (max wind, total rain, dry streaks).
 * - Flags boolean risk indicators for downstream consumption.
 * - Consecutive dry days are counted to avoid false irrigation alerts
 *   during rainy periods.
 */
function analyzeWeatherData(forecast: WeatherDataPoint[]): WeatherInsight {
  if (!forecast || forecast.length === 0) {
    return {
      daysOfData: 0, maxRainfall: 0, totalRainfall: 0,
      consecutiveDryDays: 0, maxWindSpeed: 0, maxWindGust: 0,
      maxTemp: 0, minTemp: 0, avgHumidity: 0, maxHumidity: 0,
      hasFrostRisk: false, hasHeatStress: false, hasHeavyRain: false,
      hasStormRisk: false, hasTornadoRisk: false, needsIrrigation: false,
      pressureDropDetected: false, lowVisibility: false, dataByDay: [],
    };
  }

  let consecutiveDryDays = 0;
  let currentDryStreak = 0;
  let totalRainfall = 0;
  let maxRainfall = 0;
  let maxWindSpeed = 0;
  let maxWindGust = 0;
  let maxTemp = -Infinity;
  let minTemp = Infinity;
  let totalHumidity = 0;
  let maxHumidity = 0;
  let pressureDropDetected = false;
  let lowVisibility = false;

  for (let i = 0; i < forecast.length; i++) {
    const day = forecast[i];
    totalRainfall += day.rainfall;
    maxRainfall = Math.max(maxRainfall, day.rainfall);
    maxWindSpeed = Math.max(maxWindSpeed, day.windSpeed);
    maxWindGust = Math.max(maxWindGust, day.windGust ?? day.windSpeed);
    maxTemp = Math.max(maxTemp, day.temp);
    minTemp = Math.min(minTemp, day.temp);
    totalHumidity += day.humidity;
    maxHumidity = Math.max(maxHumidity, day.humidity);

    // Count consecutive dry days for irrigation logic
    if (day.rainfall < THRESHOLDS.LIGHT_RAIN) {
      currentDryStreak++;
      consecutiveDryDays = Math.max(consecutiveDryDays, currentDryStreak);
    } else {
      currentDryStreak = 0;
    }

    // Detect rapid pressure drops (storm prediction)
    if (i > 0 && day.pressure && forecast[i - 1].pressure) {
      const drop = (forecast[i - 1].pressure as number) - (day.pressure as number);
      if (drop >= THRESHOLDS.RAPID_PRESSURE_DROP) {
        pressureDropDetected = true;
      }
    }

    // Low visibility detection
    if (day.visibility !== undefined && day.visibility < THRESHOLDS.FLIGHT_VISIBILITY_LOW) {
      lowVisibility = true;
    }
  }

  const avgHumidity = totalHumidity / forecast.length;

  return {
    daysOfData: forecast.length,
    maxRainfall,
    totalRainfall,
    consecutiveDryDays,
    maxWindSpeed,
    maxWindGust,
    maxTemp,
    minTemp,
    avgHumidity,
    maxHumidity,
    hasFrostRisk: minTemp <= THRESHOLDS.FROST_RISK,
    hasHeatStress: maxTemp >= THRESHOLDS.HEAT_STRESS_LIVESTOCK,
    hasHeavyRain: maxRainfall >= THRESHOLDS.HEAVY_RAIN,
    hasStormRisk: maxWindSpeed >= THRESHOLDS.STRONG_WIND || pressureDropDetected,
    hasTornadoRisk: maxWindGust >= THRESHOLDS.SEVERE_WIND,
    needsIrrigation: consecutiveDryDays >= THRESHOLDS.DRY_PERIOD_IRRIGATION && totalRainfall < 10,
    pressureDropDetected,
    lowVisibility,
    dataByDay: forecast,
  };
}

/* ============================================================
 * 2. ENVIRONMENTAL RISK CALCULATION
 * ------------------------------------------------------------
 * Evaluates compound risks: fungal disease, dust storms,
 * water quality shifts, etc.
 * ============================================================ */

interface EnvironmentalRisk {
  fungalRisk: boolean;
  dustStormRisk: boolean;
  aquaTempStress: boolean;
  pollenSurge: boolean;
  waterQualityRisk: boolean;
}

/**
 * calculateEnvironmentalRisks
 *
 * HOW IT WORKS:
 * - Combines humidity + temperature to flag fungal disease risk.
 * - Low humidity + high wind = dust storm potential.
 * - Temperature extremes affect aquaculture water quality.
 * - High temps + moderate humidity = pollen surge risk.
 * - Heavy rainfall near aquaculture = water quality disruption.
 */
function calculateEnvironmentalRisks(insight: WeatherInsight): EnvironmentalRisk {
  return {
    // Fungal risk: high humidity AND warm temperatures
    fungalRisk:
      insight.maxHumidity >= THRESHOLDS.FUNGAL_RISK_HUMIDITY &&
      insight.maxTemp >= 18 &&
      insight.maxTemp <= 30,

    // Dust storm: very low humidity + strong winds
    dustStormRisk:
      insight.avgHumidity <= THRESHOLDS.DUST_STORM_LOW_HUMIDITY &&
      insight.maxWindSpeed >= THRESHOLDS.MODERATE_WIND,

    // Aquaculture temperature stress
    aquaTempStress:
      insight.minTemp <= THRESHOLDS.AQUA_TEMP_LOW ||
      insight.maxTemp >= THRESHOLDS.AQUA_TEMP_HIGH,

    // Pollen surge: warm + dry + light wind
    pollenSurge:
      insight.maxTemp >= 25 &&
      insight.avgHumidity <= 60 &&
      insight.maxWindSpeed >= 15 &&
      insight.maxWindSpeed <= 40,

    // Water quality risk: heavy rain runoff into aquaculture
    waterQualityRisk:
      insight.hasHeavyRain && insight.totalRainfall >= 40,
  };
}

/* ============================================================
 * 3. FLIGHT RISK DETECTION
 * ------------------------------------------------------------
 * Separate module to detect aerial/airborne risks affecting
 * crops, livestock, aquaculture, and farm operations.
 *
 * HOW FLIGHT RISKS ARE CALCULATED:
 * - Wind speed and gust thresholds are compared against forecast.
 * - Storm probability is inferred from pressure drops + wind.
 * - Visibility data flags low-vis conditions for pilots.
 * - Tornado risk uses combined gust + pressure indicators.
 *
 * HOW THE ALERT IS TRIGGERED:
 * - Each risk returns a severity and timing window.
 * - Alerts are pushed into the main alert stack.
 *
 * HOW RECOMMENDATIONS ARE GENERATED:
 * - Actionable statements are constructed based on severity.
 * - Industry-specific advice is appended (crop cover, shelter, etc.).
 * ============================================================ */

interface FlightRisk {
  severity: Severity;
  type: "tornado" | "cyclone" | "hailstorm" | "dust_storm" | "strong_wind" | "low_visibility" | "none";
  windSpeed: number;
  gustSpeed: number;
  timing: TimingWindow;
  description: string;
}

/**
 * detectFlightRisks
 *
 * Evaluates aerial risks from weather insight data.
 * Returns the highest-severity flight risk detected.
 */
function detectFlightRisks(insight: WeatherInsight, envRisks: EnvironmentalRisk): FlightRisk {
  // Determine timing based on when the worst conditions appear
  const peakWindDay = insight.dataByDay.reduce(
    (worst, day, idx) => (day.windSpeed > (insight.dataByDay[worst]?.windSpeed ?? 0) ? idx : worst),
    0
  );
  const timing: TimingWindow = peakWindDay <= 1 ? "Next 24h" : peakWindDay <= 3 ? "1–3 Days" : "3–5 Days";

  // --- Tornado / cyclone risk (highest priority) ---
  if (insight.hasTornadoRisk && insight.pressureDropDetected) {
    return {
      severity: "danger",
      type: "tornado",
      windSpeed: insight.maxWindSpeed,
      gustSpeed: insight.maxWindGust,
      timing,
      description: `Tornado/cyclone risk detected. Wind gusts up to ${insight.maxWindGust} km/h with rapid pressure drop. Secure all outdoor equipment, cover crops, and shelter livestock immediately. Avoid all fieldwork during high winds.`,
    };
  }

  // --- Dust storm risk ---
  if (envRisks.dustStormRisk && insight.maxWindGust >= THRESHOLDS.FLIGHT_GUST_SEVERE) {
    return {
      severity: "danger",
      type: "dust_storm",
      windSpeed: insight.maxWindSpeed,
      gustSpeed: insight.maxWindGust,
      timing,
      description: `Dust storm conditions expected. Wind ${insight.maxWindSpeed} km/h with low humidity. Protect seedlings, secure greenhouse covers, and shelter animals. Airborne dust may trigger crop disease and livestock respiratory stress.`,
    };
  }

  // --- Severe wind / hailstorm ---
  if (insight.maxWindSpeed >= THRESHOLDS.FLIGHT_WIND_DANGER) {
    return {
      severity: "warning",
      type: "strong_wind",
      windSpeed: insight.maxWindSpeed,
      gustSpeed: insight.maxWindGust,
      timing,
      description: `Strong wind and potential hail expected. Wind speeds up to ${insight.maxWindSpeed} km/h. Protect young plants, check greenhouse stability, and monitor livestock housing. Secure loose farm equipment and irrigation systems.`,
    };
  }

  // --- Low visibility ---
  if (insight.lowVisibility) {
    return {
      severity: "warning",
      type: "low_visibility",
      windSpeed: insight.maxWindSpeed,
      gustSpeed: insight.maxWindGust,
      timing,
      description: `Low visibility conditions detected (< ${THRESHOLDS.FLIGHT_VISIBILITY_LOW} km). Unsafe for aerial surveying and flight operations. Postpone drone or aircraft activities. Exercise caution on farm roads.`,
    };
  }

  // --- Moderate wind caution ---
  if (insight.maxWindSpeed >= THRESHOLDS.FLIGHT_WIND_CAUTION) {
    return {
      severity: "info",
      type: "strong_wind",
      windSpeed: insight.maxWindSpeed,
      gustSpeed: insight.maxWindGust,
      timing,
      description: `Moderate winds (${insight.maxWindSpeed} km/h) expected. Monitor conditions before aerial operations. Light crops may need temporary support.`,
    };
  }

  return {
    severity: "info",
    type: "none",
    windSpeed: insight.maxWindSpeed,
    gustSpeed: insight.maxWindGust,
    timing: "Next 24h",
    description: "",
  };
}

/* ============================================================
 * 4. RECOMMENDATION ENGINE
 * ------------------------------------------------------------
 * Generates the full alert stack from analyzed data.
 *
 * Each function handles a specific domain:
 *   - Crop recommendations
 *   - Livestock recommendations
 *   - Aquaculture recommendations
 *   - Surveyor recommendations
 *   - Flight/aerial recommendations
 *   - Environmental/disaster recommendations
 * ============================================================ */

let alertIdCounter = 0;
function makeId(): string {
  alertIdCounter++;
  return `proactive-${Date.now()}-${alertIdCounter}`;
}

function timeLabel(dayIndex: number): TimingWindow {
  if (dayIndex <= 1) return "Next 24h";
  if (dayIndex <= 3) return "1–3 Days";
  if (dayIndex <= 5) return "3–5 Days";
  return "4–7 Days";
}

/**
 * generateRecommendations
 *
 * Master function that orchestrates all recommendation generators.
 * Returns a deduplicated, priority-sorted alert stack.
 */
function generateRecommendations(
  insight: WeatherInsight,
  envRisks: EnvironmentalRisk,
  flightRisk: FlightRisk,
  locationName: string
): ProactiveAlert[] {
  const alerts: ProactiveAlert[] = [];
  const now = new Date().toLocaleString();

  // ---- CROP RECOMMENDATIONS ----

  /**
   * Irrigation alert — ONLY fires during prolonged dry periods.
   * Avoids false alerts during rainy periods by checking
   * consecutive dry days AND low total rainfall.
   */
  if (insight.needsIrrigation) {
    alerts.push({
      id: makeId(),
      type: "warning",
      title: "Initiate Irrigation",
      message: `Dry period of ${insight.consecutiveDryDays}+ days forecast for ${locationName}. Initiate irrigation for tomatoes, leafy vegetables, and shallow-rooted crops. Check soil moisture daily.`,
      detail: `Total rainfall forecast: ${insight.totalRainfall.toFixed(1)} mm over ${insight.daysOfData} days. Consecutive dry days: ${insight.consecutiveDryDays}.`,
      timing: "1–3 Days",
      tags: ["crop"],
      isRead: false,
      time: now,
      icon: "droplets",
    });
  }

  /**
   * Heavy rain / crop cover alert
   */
  if (insight.hasHeavyRain) {
    const peakDay = insight.dataByDay.findIndex(d => d.rainfall >= THRESHOLDS.HEAVY_RAIN);
    alerts.push({
      id: makeId(),
      type: "warning",
      title: "Heavy Rain — Protect Crops",
      message: `Heavy rain (up to ${insight.maxRainfall.toFixed(0)} mm/day) expected ${timeLabel(peakDay)} in ${locationName}. Cover young crops and secure greenhouses. No irrigation needed. Ensure drainage channels are clear.`,
      detail: `Peak rainfall: ${insight.maxRainfall.toFixed(1)} mm. Wind: ${insight.maxWindSpeed} km/h. Humidity: ${insight.maxHumidity}%.`,
      timing: timeLabel(peakDay),
      tags: ["crop", "general"],
      isRead: false,
      time: now,
      icon: "cloud-rain",
    });
  }

  /**
   * Fungal disease risk — triggered by high humidity + warm temps
   */
  if (envRisks.fungalRisk) {
    alerts.push({
      id: makeId(),
      type: "warning",
      title: "Monitor for Fungal Risk",
      message: `High humidity (${insight.maxHumidity}%) with warm temperatures creates favorable conditions for fungal diseases in ${locationName}. Inspect crops for early signs of blight, mildew, or rust. Apply preventive fungicide if appropriate.`,
      detail: `Max humidity: ${insight.maxHumidity}%. Temp range: ${insight.minTemp.toFixed(0)}–${insight.maxTemp.toFixed(0)}°C.`,
      timing: "1–3 Days",
      tags: ["crop"],
      isRead: false,
      time: now,
      icon: "sprout",
    });
  }

  /**
   * Frost risk for crops
   */
  if (insight.hasFrostRisk) {
    alerts.push({
      id: makeId(),
      type: "danger",
      title: "Frost Risk — Protect Sensitive Crops",
      message: `Temperature dropping to ${insight.minTemp.toFixed(0)}°C in ${locationName}. Cover frost-sensitive crops (seedlings, tropical plants). Use mulch or frost cloth. Move potted plants indoors.`,
      detail: `Minimum temperature: ${insight.minTemp.toFixed(1)}°C. Frost threshold: ${THRESHOLDS.FROST_RISK}°C.`,
      timing: "Next 24h",
      tags: ["crop"],
      isRead: false,
      time: now,
      icon: "thermometer",
    });
  }

  // ---- LIVESTOCK RECOMMENDATIONS ----

  /**
   * Heat stress for livestock
   */
  if (insight.hasHeatStress) {
    alerts.push({
      id: makeId(),
      type: "warning",
      title: "Livestock Heat Stress Alert",
      message: `Temperatures reaching ${insight.maxTemp.toFixed(0)}°C in ${locationName}. Ensure adequate shade, ventilation, and water supply for all livestock. Reduce handling and transport. Monitor for signs of heat exhaustion.`,
      detail: `Max temp: ${insight.maxTemp.toFixed(1)}°C. Threshold: ${THRESHOLDS.HEAT_STRESS_LIVESTOCK}°C.`,
      timing: "Next 24h",
      tags: ["livestock"],
      isRead: false,
      time: now,
      icon: "thermometer",
    });
  }

  /**
   * Storm shelter alert for livestock
   */
  if (insight.hasStormRisk) {
    alerts.push({
      id: makeId(),
      type: "danger",
      title: "Storm Alert — Shelter Livestock",
      message: `Storm conditions expected in ${locationName} with winds up to ${insight.maxWindSpeed} km/h. Move livestock to sheltered areas. Secure fencing and pens. Ensure feed and water are accessible under cover.`,
      detail: `Wind speed: ${insight.maxWindSpeed} km/h. Gusts: ${insight.maxWindGust} km/h. Pressure drop detected: ${insight.pressureDropDetected ? "Yes" : "No"}.`,
      timing: "1–3 Days",
      tags: ["livestock", "general"],
      isRead: false,
      time: now,
      icon: "wind",
    });
  }

  /**
   * Cold stress for livestock
   */
  if (insight.minTemp <= THRESHOLDS.COLD_STRESS) {
    alerts.push({
      id: makeId(),
      type: "warning",
      title: "Cold Stress — Livestock Care",
      message: `Low temperatures (${insight.minTemp.toFixed(0)}°C) forecast for ${locationName}. Provide extra bedding and shelter for young animals. Increase feed rations. Check water troughs for freezing.`,
      detail: `Min temp: ${insight.minTemp.toFixed(1)}°C. Cold stress threshold: ${THRESHOLDS.COLD_STRESS}°C.`,
      timing: "Next 24h",
      tags: ["livestock"],
      isRead: false,
      time: now,
      icon: "thermometer",
    });
  }

  // ---- AQUACULTURE RECOMMENDATIONS ----

  /**
   * Temperature stress for aquaculture
   */
  if (envRisks.aquaTempStress) {
    const isHot = insight.maxTemp >= THRESHOLDS.AQUA_TEMP_HIGH;
    const isCold = insight.minTemp <= THRESHOLDS.AQUA_TEMP_LOW;
    alerts.push({
      id: makeId(),
      type: "warning",
      title: "Aquaculture Temperature Alert",
      message: `Water temperature may ${isHot ? "exceed safe limits" : "drop below optimal range"} in ${locationName}. ${isHot ? "Increase aeration and reduce feeding rates. Monitor dissolved oxygen." : "Consider heating systems or reduced stocking density. Watch for lethargy in fish."} `,
      detail: `Air temp range: ${insight.minTemp.toFixed(0)}–${insight.maxTemp.toFixed(0)}°C. Safe aqua range: ${THRESHOLDS.AQUA_TEMP_LOW}–${THRESHOLDS.AQUA_TEMP_HIGH}°C.`,
      timing: "1–3 Days",
      tags: ["aquaculture"],
      isRead: false,
      time: now,
      icon: "fish",
    });
  }

  /**
   * Water quality risk from heavy rainfall runoff
   */
  if (envRisks.waterQualityRisk) {
    alerts.push({
      id: makeId(),
      type: "danger",
      title: "Water Quality Risk — Aquaculture",
      message: `Heavy rainfall (${insight.totalRainfall.toFixed(0)} mm total) may cause runoff contamination in ${locationName}. Monitor pH, ammonia, and turbidity in ponds/tanks. Prepare emergency water treatment. Reduce feeding temporarily.`,
      detail: `Total rainfall: ${insight.totalRainfall.toFixed(1)} mm. Max single-day: ${insight.maxRainfall.toFixed(1)} mm.`,
      timing: "1–3 Days",
      tags: ["aquaculture"],
      isRead: false,
      time: now,
      icon: "waves",
    });
  }

  // ---- SURVEYOR RECOMMENDATIONS ----

  /**
   * Surveyor field conditions alert
   */
  if (insight.hasHeavyRain || insight.hasStormRisk || insight.lowVisibility) {
    alerts.push({
      id: makeId(),
      type: "warning",
      title: "Surveyor Field Conditions Warning",
      message: `Unfavorable field conditions expected in ${locationName}. ${insight.hasHeavyRain ? "Heavy rain will make terrain muddy and GPS accuracy may decrease. " : ""}${insight.lowVisibility ? "Low visibility reduces measurement accuracy. " : ""}${insight.hasStormRisk ? "Storm risk — postpone outdoor survey work. " : ""}Plan indoor tasks or reschedule fieldwork.`,
      detail: `Rain: ${insight.maxRainfall.toFixed(0)} mm. Wind: ${insight.maxWindSpeed} km/h. Visibility: ${insight.lowVisibility ? "Poor" : "Adequate"}.`,
      timing: "1–3 Days",
      tags: ["surveyor"],
      isRead: false,
      time: now,
      icon: "eye",
    });
  }

  // ---- FLIGHT / AERIAL RECOMMENDATIONS ----

  /**
   * Flight alert — generated from detectFlightRisks()
   * Only triggers for the user's local area.
   */
  if (flightRisk.type !== "none") {
    alerts.push({
      id: makeId(),
      type: flightRisk.severity,
      title: `Flight Alert: ${flightRisk.type.replace("_", " ").replace(/\b\w/g, c => c.toUpperCase())} Risk`,
      message: flightRisk.description,
      detail: `Wind: ${flightRisk.windSpeed} km/h. Gusts: ${flightRisk.gustSpeed} km/h. Location: ${locationName}.`,
      timing: flightRisk.timing,
      tags: ["flight", "crop", "livestock"],
      isRead: false,
      time: now,
      icon: "plane",
    });
  }

  // ---- ENVIRONMENTAL / DISASTER RECOMMENDATIONS ----

  /**
   * Tornado / severe weather alert
   */
  if (insight.hasTornadoRisk) {
    alerts.push({
      id: makeId(),
      type: "danger",
      title: "⚠️ Tornado / Severe Storm Risk",
      message: `Severe weather conditions detected for ${locationName}. Wind gusts up to ${insight.maxWindGust} km/h. Secure ALL outdoor equipment and materials. Move livestock to reinforced shelters. Cover crops where possible. Avoid fieldwork. Follow local emergency services.`,
      detail: `Max gust: ${insight.maxWindGust} km/h. Pressure drop: ${insight.pressureDropDetected ? "Detected" : "Not detected"}.`,
      timing: "Next 24h",
      tags: ["general", "crop", "livestock", "aquaculture"],
      isRead: false,
      time: now,
      icon: "cloud-lightning",
    });
  }

  /**
   * Dust storm environmental alert
   */
  if (envRisks.dustStormRisk) {
    alerts.push({
      id: makeId(),
      type: "warning",
      title: "Dust Storm — Environmental Alert",
      message: `Dry, windy conditions in ${locationName} may generate dust storms. Airborne particles can stress livestock respiratory systems and damage crop foliage. Cover water sources, reduce outdoor livestock exposure, and protect nursery plants.`,
      detail: `Humidity: ${insight.avgHumidity.toFixed(0)}%. Wind: ${insight.maxWindSpeed} km/h.`,
      timing: "1–3 Days",
      tags: ["general", "livestock", "crop"],
      isRead: false,
      time: now,
      icon: "wind",
    });
  }

  /**
   * Pollen surge (affects both crops and livestock)
   */
  if (envRisks.pollenSurge) {
    alerts.push({
      id: makeId(),
      type: "info",
      title: "Pollen Surge Conditions",
      message: `Warm, dry conditions with moderate wind in ${locationName} may cause elevated pollen levels. Monitor livestock for allergic reactions. Beekeepers: favorable conditions for pollination activity.`,
      detail: `Temp: ${insight.maxTemp.toFixed(0)}°C. Humidity: ${insight.avgHumidity.toFixed(0)}%. Wind: ${insight.maxWindSpeed} km/h.`,
      timing: "1–3 Days",
      tags: ["livestock", "crop"],
      isRead: false,
      time: now,
      icon: "sprout",
    });
  }

  // Sort by severity: danger > warning > info > success
  const severityOrder: Record<AlertType, number> = { danger: 0, warning: 1, info: 2, success: 3 };
  alerts.sort((a, b) => severityOrder[a.type] - severityOrder[b.type]);

  return alerts;
}

/* ============================================================
 * 5. VISUAL MAPS & UI CONFIGURATION
 * ============================================================ */

const iconMap: Record<AlertType, any> = {
  warning: AlertTriangle,
  danger: AlertOctagon,
  info: Info,
  success: CheckCircle,
};

/** Left-border accent color per severity for at-a-glance scanning */
const styleMap: Record<AlertType, string> = {
  warning: "border-l-warning bg-warning/5",
  danger: "border-l-destructive bg-destructive/5",
  info: "border-l-accent bg-accent/5",
  success: "border-l-success bg-success/5",
};

const iconColorMap: Record<AlertType, string> = {
  warning: "text-warning",
  danger: "text-destructive",
  info: "text-accent",
  success: "text-success",
};

/** Industry tag colors */
const tagColorMap: Record<IndustryTag, string> = {
  crop: "bg-success/10 text-success border-success/20",
  livestock: "bg-warning/10 text-warning border-warning/20",
  aquaculture: "bg-accent/10 text-accent border-accent/20",
  flight: "bg-destructive/10 text-destructive border-destructive/20",
  surveyor: "bg-primary/10 text-primary border-primary/20",
  general: "bg-muted text-muted-foreground border-border",
};

/** Icon components for alert cards */
const alertIconMap: Record<string, any> = {
  wind: Wind,
  droplets: Droplets,
  thermometer: Thermometer,
  "cloud-rain": CloudRain,
  "cloud-lightning": CloudLightning,
  waves: Waves,
  plane: Plane,
  eye: Eye,
  sprout: Sprout,
  fish: Fish,
};

/* ============================================================
 * 6. ALERTS COMPONENT
 * ============================================================ */

export default function Alerts() {
  const { user } = useAuth();
  const { position } = useGeolocation();
  const { forecast } = useWeather(position.lat, position.lon);
  const { toast } = useToast();
  const {
    alerts: visibleAlerts,
    unreadAlerts: unread,
    markRead,
    dismiss,
  } = useUserAlerts(forecast, position.locationName);

  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [dbAlerts, setDbAlerts] = useState<any[]>([]);
  const [showTicketForm, setShowTicketForm] = useState(false);
  const [ticketLoading, setTicketLoading] = useState(false);
  const [ticket, setTicket] = useState({
    subject: "",
    description: "",
    category: "general",
  });
  const [activeTagFilter, setActiveTagFilter] = useState<IndustryTag | "all">("all");

  // Fetch database disaster alerts
  useEffect(() => {
    supabase
      .from("disaster_alerts")
      .select("*")
      .eq("active", true)
      .order("created_at", { ascending: false })
      .then(({ data }) => {
        if (data) setDbAlerts(data);
      });
  }, []);

  /**
   * Generate proactive alerts from weather data.
   * Memoized to avoid recalculation on every render.
   */
  const proactiveAlerts = useMemo(() => {
    if (!forecast || forecast.length === 0) return [];

    // Step 1: Analyze weather data
    const insight = analyzeWeatherData(forecast);

    // Step 2: Calculate environmental risks
    const envRisks = calculateEnvironmentalRisks(insight);

    // Step 3: Detect flight-specific risks
    const flightRisk = detectFlightRisks(insight, envRisks);

    // Step 4: Generate full recommendation stack
    return generateRecommendations(
      insight,
      envRisks,
      flightRisk,
      position.locationName || "your area"
    );
  }, [forecast, position.locationName]);

  // Combine proactive alerts with user alerts from the hook
  const allAlerts = useMemo(() => {
    const combined = [...proactiveAlerts, ...visibleAlerts];
    if (activeTagFilter === "all") return combined;
    return combined.filter(
      (a) => "tags" in a && (a as ProactiveAlert).tags?.includes(activeTagFilter)
    );
  }, [proactiveAlerts, visibleAlerts, activeTagFilter]);

  const unreadAlerts = allAlerts.filter((a) => !a.isRead);
  const readAlerts = allAlerts.filter((a) => a.isRead);

  const toggleExpand = useCallback((id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }, []);

  const submitTicket = async () => {
    if (!ticket.subject.trim() || !ticket.description.trim()) {
      toast({
        title: "Required",
        description: "Please fill in subject and description.",
        variant: "destructive",
      });
      return;
    }
    setTicketLoading(true);
    const { error } = await supabase.from("support_tickets").insert({
      user_id: user?.id,
      subject: ticket.subject,
      description: ticket.description,
      category: ticket.category,
      location: position.locationName,
    });
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Ticket submitted", description: "Our support team will review your report." });
      setTicket({ subject: "", description: "", category: "general" });
      setShowTicketForm(false);
    }
    setTicketLoading(false);
  };

  const industryFilters: { label: string; value: IndustryTag | "all" }[] = [
    { label: "All", value: "all" },
    { label: "🌾 Crops", value: "crop" },
    { label: "🐄 Livestock", value: "livestock" },
    { label: "🐟 Aquaculture", value: "aquaculture" },
    { label: "✈️ Flight", value: "flight" },
    { label: "📐 Surveyor", value: "surveyor" },
  ];

  return (
    <div className="p-4 lg:p-8 max-w-6xl mx-auto">
      {/* ---- Header ---- */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-bold">Proactive Alerts</h1>
          {unreadAlerts.length > 0 && (
            <span className="bg-destructive text-destructive-foreground text-xs px-2 py-0.5 rounded-full font-semibold">
              {unreadAlerts.length} new
            </span>
          )}
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={() => setShowTicketForm(!showTicketForm)}
        >
          <MessageSquarePlus className="h-4 w-4 mr-1" /> Support Ticket
        </Button>
      </div>

      {/* ---- Industry Tag Filters ---- */}
      <div className="flex flex-wrap gap-2 mb-6">
        {industryFilters.map((f) => (
          <button
            key={f.value}
            onClick={() => setActiveTagFilter(f.value)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
              activeTagFilter === f.value
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-card text-muted-foreground border-border hover:border-primary/50"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* ---- Support Ticket Form ---- */}
      {showTicketForm && (
        <div className="bg-card border border-border rounded-xl p-4 mb-6 space-y-3">
          <h3 className="font-semibold text-sm">Submit a Support Ticket</h3>
          <Input
            placeholder="Subject"
            value={ticket.subject}
            onChange={(e) => setTicket({ ...ticket, subject: e.target.value })}
          />
          <Select
            value={ticket.category}
            onValueChange={(v) => setTicket({ ...ticket, category: v })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="general">General</SelectItem>
              <SelectItem value="weather">Weather Issue</SelectItem>
              <SelectItem value="crop">Crop Problem</SelectItem>
              <SelectItem value="livestock">Livestock Issue</SelectItem>
              <SelectItem value="aquaculture">Aquaculture Issue</SelectItem>
              <SelectItem value="flight">Flight / Aerial Risk</SelectItem>
              <SelectItem value="surveyor">Survey Conditions</SelectItem>
              <SelectItem value="technical">Technical Problem</SelectItem>
              <SelectItem value="complaint">Complaint</SelectItem>
            </SelectContent>
          </Select>
          <Textarea
            placeholder="Describe your issue..."
            value={ticket.description}
            onChange={(e) => setTicket({ ...ticket, description: e.target.value })}
            rows={4}
          />
          <div className="flex gap-2">
            <Button onClick={submitTicket} disabled={ticketLoading} size="sm">
              {ticketLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <Send className="h-4 w-4 mr-1" /> Submit
                </>
              )}
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setShowTicketForm(false)}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      {/* ---- Database Disaster Alerts (Critical/External) ---- */}
      {dbAlerts.length > 0 && (
        <section className="mb-6">
          <h2 className="font-semibold text-sm text-destructive mb-3">
            ⚠️ DISASTER ALERTS
          </h2>
          <div className="space-y-3">
            {dbAlerts.map((alert) => (
              <div
                key={alert.id}
                className="rounded-lg border-l-4 border-l-destructive bg-destructive/5 p-4"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <AlertOctagon className="h-4 w-4 text-destructive" />
                      <h4 className="font-semibold text-sm">{alert.title}</h4>
                      <Badge variant="outline" className="text-[10px]">
                        {alert.severity}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {alert.description}
                    </p>
                    {alert.affected_regions?.length > 0 && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Regions: {alert.affected_regions.join(", ")}
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground mt-1">
                      {new Date(alert.created_at).toLocaleString()}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ---- Main Alert Stack ---- */}
      <div className="grid lg:grid-cols-2 gap-6">
        <div className="space-y-5">
          {/* Unread / New Alerts */}
          {unreadAlerts.length > 0 && (
            <section>
              <h2 className="font-semibold text-sm text-muted-foreground mb-3">
                NEW
              </h2>
              <div className="space-y-3">
                {unreadAlerts.map((a: any) => {
                  const Icon = iconMap[a.type as AlertType] ?? Info;
                  const expanded = expandedIds.has(a.id);
                  const DetailIcon = a.icon ? alertIconMap[a.icon] : null;

                  return (
                    <div
                      key={a.id}
                      className={`rounded-lg border-l-4 p-4 ${
                        styleMap[a.type as AlertType] ?? "border-l-accent bg-accent/5"
                      } transition-all`}
                    >
                      <div className="flex gap-3">
                        <Icon
                          className={`h-5 w-5 mt-0.5 shrink-0 ${
                            iconColorMap[a.type as AlertType] ?? "text-accent"
                          }`}
                        />
                        <div className="flex-1 min-w-0">
                          {/* Header: Title + Severity + Timing */}
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2 flex-wrap">
                              <h4 className="font-semibold text-sm">{a.title}</h4>
                              <span className="h-2 w-2 rounded-full bg-destructive shrink-0" />
                              {a.timing && (
                                <Badge variant="outline" className="text-[10px]">
                                  {a.timing}
                                </Badge>
                              )}
                            </div>
                            <button
                              onClick={() => toggleExpand(a.id)}
                              className="text-muted-foreground hover:text-foreground"
                            >
                              {expanded ? (
                                <ChevronUp className="h-4 w-4" />
                              ) : (
                                <ChevronDown className="h-4 w-4" />
                              )}
                            </button>
                          </div>

                          {/* Body: Action statement */}
                          <p
                            className={`text-sm text-muted-foreground mt-1 ${
                              !expanded ? "line-clamp-2" : ""
                            }`}
                          >
                            {a.message}
                          </p>

                          {/* Expanded: Contextual detail */}
                          {expanded && a.detail && (
                            <p className="text-xs text-muted-foreground/70 mt-2 italic">
                              {a.detail}
                            </p>
                          )}

                          {/* Footer: Tags + Actions */}
                          <div className="flex items-center gap-2 mt-2 flex-wrap">
                            {a.tags?.map((tag: IndustryTag) => (
                              <span
                                key={tag}
                                className={`text-[10px] px-2 py-0.5 rounded-full border font-medium ${
                                  tagColorMap[tag] ?? tagColorMap.general
                                }`}
                              >
                                #{tag}
                              </span>
                            ))}
                            <span className="flex-1" />
                            <p className="text-xs text-muted-foreground">{a.time}</p>
                            {markRead && (
                              <button
                                onClick={() => markRead(a.id)}
                                className="text-xs text-primary hover:underline flex items-center gap-1"
                              >
                                <Check className="h-3 w-3" /> Mark read
                              </button>
                            )}
                            {dismiss && (
                              <button
                                onClick={() => dismiss(a.id)}
                                className="text-xs text-destructive hover:underline flex items-center gap-1"
                              >
                                <Trash2 className="h-3 w-3" /> Dismiss
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {/* Read / Earlier Alerts */}
          {readAlerts.length > 0 && (
            <section>
              <h2 className="font-semibold text-sm text-muted-foreground mb-3">
                EARLIER
              </h2>
              <div className="space-y-3">
                {readAlerts.map((a: any) => {
                  const Icon = iconMap[a.type as AlertType] ?? Info;
                  const expanded = expandedIds.has(a.id);

                  return (
                    <div
                      key={a.id}
                      className={`rounded-lg border-l-4 p-4 ${
                        styleMap[a.type as AlertType] ?? "border-l-accent bg-accent/5"
                      } opacity-70 transition-all`}
                    >
                      <div className="flex gap-3">
                        <Icon
                          className={`h-5 w-5 mt-0.5 shrink-0 ${
                            iconColorMap[a.type as AlertType] ?? "text-accent"
                          }`}
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2 flex-wrap">
                              <h4 className="font-semibold text-sm">{a.title}</h4>
                              {a.timing && (
                                <Badge variant="outline" className="text-[10px]">
                                  {a.timing}
                                </Badge>
                              )}
                            </div>
                            <button
                              onClick={() => toggleExpand(a.id)}
                              className="text-muted-foreground hover:text-foreground"
                            >
                              {expanded ? (
                                <ChevronUp className="h-4 w-4" />
                              ) : (
                                <ChevronDown className="h-4 w-4" />
                              )}
                            </button>
                          </div>
                          <p
                            className={`text-sm text-muted-foreground mt-1 ${
                              !expanded ? "line-clamp-2" : ""
                            }`}
                          >
                            {a.message}
                          </p>
                          {expanded && a.detail && (
                            <p className="text-xs text-muted-foreground/70 mt-2 italic">
                              {a.detail}
                            </p>
                          )}
                          <div className="flex items-center gap-2 mt-2 flex-wrap">
                            {a.tags?.map((tag: IndustryTag) => (
                              <span
                                key={tag}
                                className={`text-[10px] px-2 py-0.5 rounded-full border font-medium ${
                                  tagColorMap[tag] ?? tagColorMap.general
                                }`}
                              >
                                #{tag}
                              </span>
                            ))}
                            <span className="flex-1" />
                            <p className="text-xs text-muted-foreground">{a.time}</p>
                            {dismiss && (
                              <button
                                onClick={() => dismiss(a.id)}
                                className="text-xs text-destructive hover:underline flex items-center gap-1"
                              >
                                <Trash2 className="h-3 w-3" /> Dismiss
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {/* Empty State */}
          {allAlerts.length === 0 && dbAlerts.length === 0 && (
            <div className="text-center py-12">
              <Bell className="h-12 w-12 mx-auto text-muted-foreground/30" />
              <p className="text-muted-foreground mt-3">
                No alerts for your area right now
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Alerts are generated automatically from weather and environmental data
              </p>
            </div>
          )}
        </div>

        {/* ---- Sidebar Info ---- */}
        <div className="space-y-4">
          <div className="bg-muted rounded-xl p-4">
            <h3 className="font-semibold text-sm mb-2">How Alerts Work</h3>
            <ul className="text-xs text-muted-foreground space-y-1.5">
              <li>• Weather data is analyzed for rainfall, wind, temperature & humidity</li>
              <li>• Alerts are generated for your specific location only</li>
              <li>• Recommendations cover crops, livestock, aquaculture, flight & surveying</li>
              <li>• Timing windows: Next 24h, 1–3 Days, 3–5 Days, 4–7 Days</li>
              <li>• Filter by industry using the tags above</li>
            </ul>
          </div>
          <div className="bg-muted rounded-xl p-4 text-center">
            <p className="text-sm text-muted-foreground">
              📱 Critical alerts are also sent via SMS to your registered phone number.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
