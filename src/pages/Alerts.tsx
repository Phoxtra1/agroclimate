import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useGeolocation } from "@/hooks/useGeolocation";
import { useWeather } from "@/hooks/useWeather";
import { useToast } from "@/hooks/use-toast";
import { useUserAlerts } from "@/hooks/useUserAlerts";
import {
  Bell, ChevronDown, ChevronUp, Check, Trash2,
  MessageSquarePlus, Send, Loader2, RefreshCw,
  Wind, Droplets, Thermometer, CloudRain, CloudLightning,
  Waves, Plane, Eye, Sprout, Fish, Salad, AlertCircle,
} from "lucide-react";
import {
  AlertTriangle, CheckCircle, Info, AlertOctagon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";

/* ============================================================
 * TYPES & INTERFACES
 * ============================================================ */

type Severity = "info" | "success" | "warning" | "danger";
type AlertType = "info" | "success" | "warning" | "danger";
type IndustryTag =
  | "crop"
  | "livestock"
  | "aquaculture"
  | "vegetables"
  | "flight"
  | "surveyor"
  | "general";
type TimingWindow = "Next 24h" | "1–3 Days" | "3–5 Days" | "4–7 Days";

interface WeatherDataPoint {
  date: string;
  temp: number;
  humidity: number;
  windSpeed: number;
  windGust?: number;
  rainfall: number;
  description: string;
  pressure?: number;
  visibility?: number;
  uvIndex?: number;
  soilMoisture?: number;  // % — for irrigation/vegetable alerts
}

interface ProactiveAlert {
  id: string;
  type: AlertType;
  title: string;
  message: string;
  detail: string;
  timing: TimingWindow;
  tags: IndustryTag[];
  isRead: boolean;
  time: string;
  icon: string;
  generatedAt: number;   // Unix ms — used for 72h dedup
  deliveredViaPush?: boolean;
  deliveredViaSMS?: boolean;
  actionWindow?: string;
  priority?: "low" | "medium" | "high" | "critical";
}

  interface FarmProfile {
  cropType: "tomato" | "maize" | "pepper" | "rice";
  plantingDate: string;
  growthStage: "germination" | "vegetative" | "flowering" | "fruiting";
  soilType?: "sandy" | "loamy" | "clay";
  irrigationType?: "drip" | "rainfed" | "sprinkler";
}

/* ============================================================
 * DELIVERY CONSTANTS
 * ============================================================ */

/** Minimum ms between alert re-generation cycles (72 hours) */
const ALERT_INTERVAL_MS = 72 * 60 * 60 * 1000;

/** Weather data refresh interval (15 min for real-time feel) */
const WEATHER_REFRESH_MS = 15 * 60 * 1000;

/** LocalStorage keys for last-sent tracking */
const LS_LAST_GENERATED = "agri_alerts_last_generated";
const LS_ALERT_CACHE = "agri_alerts_cache";

/* ============================================================
 * THRESHOLDS
 * ============================================================ */

const THRESHOLDS = {
  LIGHT_RAIN: 2.5,
  MODERATE_RAIN: 10,
  HEAVY_RAIN: 25,
  EXTREME_RAIN: 50,
  MODERATE_WIND: 30,
  STRONG_WIND: 50,
  SEVERE_WIND: 75,
  EXTREME_WIND: 100,
  FROST_RISK: 3,
  COLD_STRESS: 5,
  HEAT_STRESS_LIVESTOCK: 32,
  EXTREME_HEAT: 38,
  AQUA_TEMP_LOW: 15,
  AQUA_TEMP_HIGH: 32,
  FUNGAL_RISK_HUMIDITY: 85,
  DUST_STORM_LOW_HUMIDITY: 20,
  DRY_PERIOD_IRRIGATION: 5,
  PROLONGED_DRY: 14,
  FLIGHT_WIND_CAUTION: 35,
  FLIGHT_WIND_DANGER: 55,
  FLIGHT_VISIBILITY_LOW: 3,
  FLIGHT_GUST_SEVERE: 65,
  RAPID_PRESSURE_DROP: 8,
  VEGETABLE_HEAT_STRESS: 35,
  VEGETABLE_COLD_STRESS: 8,
  UV_HIGH: 7,
  UV_EXTREME: 10,
};

/* ============================================================
 * DYNAMIC MESSAGE POOLS
 * Each pool has multiple variants to prevent repetition.
 * pickFrom() selects one based on day-of-week + hour seed
 * so the same user gets different messages on different days.
 * ============================================================ */

function pickFrom<T>(arr: T[], seed: number = Date.now()): T {
  // Rotate through variants using a hash of the current 3-day period + array length
  const period = Math.floor(seed / ALERT_INTERVAL_MS);
  return arr[(period + arr.length) % arr.length];
}

const MSG_POOLS = {
  irrigation: (dry: number, total: number, loc: string) =>
    pickFrom([
      `${dry}+ consecutive dry days forecast for ${loc}. Tomatoes, leafy greens, and shallow-rooted crops urgently need water. Check soil moisture at 5 cm depth.`,
      `No meaningful rainfall expected in ${loc} for ${dry} days. Schedule drip irrigation now for market garden beds and seedling trays. Root crops showing wilting risk.`,
      `Soil moisture deficit building in ${loc} — ${total.toFixed(0)} mm total rain over the forecast window. Prioritise irrigating fruiting vegetables and young transplants.`,
      `Prolonged dry spell ahead (${dry} days) in ${loc}. Activate sprinkler systems for field crops. Mulch bare soil to retain moisture. Monitor capillary break indicators.`,
    ]),

  heavyRain: (peak: number, loc: string) =>
    pickFrom([
      `Heavy downpour (${peak.toFixed(0)} mm/day) approaching ${loc}. Ridge and furrow drainage channels must be cleared now. Cover newly-sown beds and suspend fertiliser application.`,
      `Intense rain forecast for ${loc} — up to ${peak.toFixed(0)} mm in a single day. Slope erosion risk is high. Prepare sandbag barriers around vulnerable seedbeds.`,
      `${peak.toFixed(0)} mm/day rainfall expected near ${loc}. Waterlogging risk for heavy clay soils. Lift root vegetables early if possible. Anchor row covers.`,
      `Major rain event imminent in ${loc} (${peak.toFixed(0)} mm peak). Move potted crops under shelter. Pause irrigation schedules. Mark low-lying field areas for drainage inspection.`,
    ]),

  fungal: (humidity: number, loc: string) =>
    pickFrom([
      `Humidity hitting ${humidity}% in ${loc} — prime conditions for late blight on tomatoes and downy mildew on cucumbers. Spray copper-based fungicide as a preventive.`,
      `High moisture air (${humidity}% RH) persisting over ${loc}. Early-season rust and botrytis outbreaks are likely. Increase row spacing airflow and avoid overhead watering.`,
      `Fungal pressure escalating in ${loc}: humidity ${humidity}%, warm nights. Check undersides of leaves for spore colonies. Apply organic sulphur spray within 24 hours.`,
    ]),

  frost: (min: number, loc: string) =>
    pickFrom([
      `Temperature will drop to ${min.toFixed(0)}°C in ${loc} tonight. Cover frost-tender seedlings with fleece. Move citrus and subtropical crops indoors immediately.`,
      `Frost alert for ${loc}: lows of ${min.toFixed(0)}°C forecast. Apply anti-freeze spray on berry crops. Check heat cables in propagation tunnels are functioning.`,
      `Near-zero temperatures (${min.toFixed(0)}°C) expected at ${loc}. Protect legumes and young brassicas with double-layer frost cloth. Water soil before sunset to hold heat.`,
    ]),

  heatStress: (max: number, loc: string) =>
    pickFrom([
      `${max.toFixed(0)}°C expected in ${loc}. Livestock require shaded paddocks, cool fresh water every 2 hours, and reduced movement during 10:00–16:00.`,
      `Dangerous heat (${max.toFixed(0)}°C) forecast for ${loc}. Open all ventilation panels in sheds. Mist systems should run continuously. Monitor for panting and reduced feed intake.`,
      `Heat wave conditions (${max.toFixed(0)}°C) in ${loc}. Move animals to night grazing. Install temporary shade cloth over water troughs. Vet contact recommended if behavioural change is seen.`,
    ]),

  vegetableHeat: (max: number, loc: string) =>
    pickFrom([
      `Temperatures reaching ${max.toFixed(0)}°C in ${loc} will cause tip-burn on lettuce and bolting in leafy vegetables. Harvest early morning; shade tender crops.`,
      `Heat stress threshold exceeded (${max.toFixed(0)}°C) for ${loc}. Brassicas and spinach will bolt quickly. Install 30% shade cloth and increase watering frequency.`,
      `${max.toFixed(0)}°C heat alert for ${loc}. Capsicum and tomato flowers may abort above 35°C. Use overhead mist irrigation during hottest hours to cool canopy.`,
    ]),

  vegetableCold: (min: number, loc: string) =>
    pickFrom([
      `Cold spell (${min.toFixed(0)}°C) coming to ${loc}. Protect warm-season vegetables: beans, courgettes, and sweet corn are particularly vulnerable to chilling injury.`,
      `Low temperatures (${min.toFixed(0)}°C) forecast for ${loc}. Cover aubergine, capsicum, and cucumber with thermal fleece. Avoid cold water irrigation on cold mornings.`,
      `Chilling risk (${min.toFixed(0)}°C) in ${loc}. Tomato fruit set is impaired below 10°C. Use cloches over ripening fruit. Delay transplanting warm-season seedlings.`,
    ]),

  stormShelter: (wind: number, loc: string) =>
    pickFrom([
      `Storm with winds to ${wind} km/h approaching ${loc}. Secure all livestock in reinforced pens. Check fence lines for weak points. Collect hay bales off paddocks now.`,
      `Severe weather imminent in ${loc} — winds ${wind} km/h. Move vulnerable animals to covered shelter. Tie down feed troughs and water tanks. Suspend machinery operations.`,
      `${wind} km/h winds forecast for ${loc}. Bring working animals off exposed hillsides. Check structural integrity of steel sheds. Document any storm damage for insurance.`,
    ]),

  aquaTempStress: (min: number, max: number, loc: string) =>
    pickFrom([
      `Air temps of ${min.toFixed(0)}–${max.toFixed(0)}°C in ${loc} will shift pond/tank water temperatures outside the safe range. Increase aeration; reduce feeding rates by 30%.`,
      `Thermal stress window for aquaculture in ${loc}: air ${max.toFixed(0)}°C. Monitor dissolved oxygen every 3 hours. Prepare emergency aeration equipment.`,
      `Water quality risk in ${loc} from temperature extremes (${min.toFixed(0)}–${max.toFixed(0)}°C). Reduce stocking density in critical ponds. Log daily O₂ and pH readings.`,
    ]),

  disasterRain: (total: number, loc: string) =>
    pickFrom([
      `Critical rainfall total (${total.toFixed(0)} mm) forecast for ${loc}. Flash flood risk is high. All aquaculture ponds must have overflow channels cleared. Move fish feed stores to elevated ground.`,
      `Flood-level rainfall (${total.toFixed(0)} mm) approaching ${loc}. Livestock should be moved off floodplain paddocks. Emergency kit: pumps, nets, biosecurity supplies.`,
      `${total.toFixed(0)} mm total rainfall forecast — flood alert for ${loc}. Earthwork structures and levees should be inspected immediately. Report any breaches to local authority.`,
    ]),

  tornado: (gust: number, loc: string) =>
    pickFrom([
      `⚠️ Tornado/cyclone conditions detected for ${loc}. Gusts to ${gust} km/h. Evacuate livestock to the most sheltered building. All outdoor work MUST cease immediately.`,
      `Extreme wind event (${gust} km/h gusts) in ${loc}. Tornado or severe cyclone possible. Board up fragile structures. Move portable equipment indoors. Follow emergency services instructions.`,
    ]),

  surveyor: (rain: number, wind: number, loc: string) =>
    pickFrom([
      `Muddy terrain and GPS drift expected in ${loc} due to ${rain.toFixed(0)} mm rain and ${wind} km/h wind. Schedule indoor data processing tasks and postpone field traverses.`,
      `Field conditions in ${loc} will deteriorate: ${rain.toFixed(0)} mm rainfall may cause equipment slippage and level instability. Carry extra stakes and waterproof cases.`,
      `Survey postponement recommended for ${loc}. Wet soils (${rain.toFixed(0)} mm forecast) affect drone take-off safety and reflector visibility. Rebook for a dry-weather window.`,
    ]),

  uvHigh: (uv: number, loc: string) =>
    pickFrom([
      `UV Index reaching ${uv} in ${loc}. Protect outdoor farm workers with SPF 50+ sunscreen, hats, and UV-rated clothing. Schedule high-exposure work before 10:00.`,
      `High UV (${uv}) forecast for ${loc}. Limit outdoor field work during 11:00–14:00. UV also accelerates pesticide photodegradation — adjust spray timing accordingly.`,
    ]),
};

/* ============================================================
 * WEATHER ANALYSIS
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
  maxUV: number;
  hasFrostRisk: boolean;
  hasHeatStress: boolean;
  hasHeavyRain: boolean;
  hasStormRisk: boolean;
  hasTornadoRisk: boolean;
  needsIrrigation: boolean;
  pressureDropDetected: boolean;
  lowVisibility: boolean;
  hasExtremeHeat: boolean;
  dataByDay: WeatherDataPoint[];
}

function analyzeWeatherData(forecast: WeatherDataPoint[]): WeatherInsight {
  if (!forecast || forecast.length === 0) {
    return {
      daysOfData: 0, maxRainfall: 0, totalRainfall: 0,
      consecutiveDryDays: 0, maxWindSpeed: 0, maxWindGust: 0,
      maxTemp: 0, minTemp: 0, avgHumidity: 0, maxHumidity: 0, maxUV: 0,
      hasFrostRisk: false, hasHeatStress: false, hasHeavyRain: false,
      hasStormRisk: false, hasTornadoRisk: false, needsIrrigation: false,
      pressureDropDetected: false, lowVisibility: false, hasExtremeHeat: false,
      dataByDay: [],
    };
  }

  let consecutiveDryDays = 0, currentDryStreak = 0, totalRainfall = 0;
  let maxRainfall = 0, maxWindSpeed = 0, maxWindGust = 0;
  let maxTemp = -Infinity, minTemp = Infinity;
  let totalHumidity = 0, maxHumidity = 0;
  let pressureDropDetected = false, lowVisibility = false;
  let maxUV = 0;

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
    maxUV = Math.max(maxUV, day.uvIndex ?? 0);

    if (day.rainfall < THRESHOLDS.LIGHT_RAIN) {
      currentDryStreak++;
      consecutiveDryDays = Math.max(consecutiveDryDays, currentDryStreak);
    } else {
      currentDryStreak = 0;
    }

    if (i > 0 && day.pressure && forecast[i - 1].pressure) {
      const drop = (forecast[i - 1].pressure as number) - (day.pressure as number);
      if (drop >= THRESHOLDS.RAPID_PRESSURE_DROP) pressureDropDetected = true;
    }

    if (day.visibility !== undefined && day.visibility < THRESHOLDS.FLIGHT_VISIBILITY_LOW) {
      lowVisibility = true;
    }
  }

  const avgHumidity = totalHumidity / forecast.length;

  return {
    daysOfData: forecast.length,
    maxRainfall, totalRainfall, consecutiveDryDays,
    maxWindSpeed, maxWindGust, maxTemp, minTemp,
    avgHumidity, maxHumidity, maxUV,
    hasFrostRisk: minTemp <= THRESHOLDS.FROST_RISK,
    hasHeatStress: maxTemp >= THRESHOLDS.HEAT_STRESS_LIVESTOCK,
    hasExtremeHeat: maxTemp >= THRESHOLDS.EXTREME_HEAT,
    hasHeavyRain: maxRainfall >= THRESHOLDS.HEAVY_RAIN,
    hasStormRisk: maxWindSpeed >= THRESHOLDS.STRONG_WIND || pressureDropDetected,
    hasTornadoRisk: maxWindGust >= THRESHOLDS.SEVERE_WIND && pressureDropDetected,
    needsIrrigation: consecutiveDryDays >= THRESHOLDS.DRY_PERIOD_IRRIGATION && totalRainfall < 10,
    pressureDropDetected, lowVisibility,
    dataByDay: forecast,
  };
}

interface EnvironmentalRisk {
  fungalRisk: boolean;
  dustStormRisk: boolean;
  aquaTempStress: boolean;
  pollenSurge: boolean;
  waterQualityRisk: boolean;
  vegetableHeatStress: boolean;
  vegetableColdStress: boolean;
  highUVRisk: boolean;
}

function calculateEnvironmentalRisks(insight: WeatherInsight): EnvironmentalRisk {
  return {
    fungalRisk: insight.maxHumidity >= THRESHOLDS.FUNGAL_RISK_HUMIDITY && insight.maxTemp >= 18 && insight.maxTemp <= 30,
    dustStormRisk: insight.avgHumidity <= THRESHOLDS.DUST_STORM_LOW_HUMIDITY && insight.maxWindSpeed >= THRESHOLDS.MODERATE_WIND,
    aquaTempStress: insight.minTemp <= THRESHOLDS.AQUA_TEMP_LOW || insight.maxTemp >= THRESHOLDS.AQUA_TEMP_HIGH,
    pollenSurge: insight.maxTemp >= 25 && insight.avgHumidity <= 60 && insight.maxWindSpeed >= 15 && insight.maxWindSpeed <= 40,
    waterQualityRisk: insight.hasHeavyRain && insight.totalRainfall >= 40,
    vegetableHeatStress: insight.maxTemp >= THRESHOLDS.VEGETABLE_HEAT_STRESS,
    vegetableColdStress: insight.minTemp <= THRESHOLDS.VEGETABLE_COLD_STRESS && insight.minTemp > THRESHOLDS.FROST_RISK,
    highUVRisk: insight.maxUV >= THRESHOLDS.UV_HIGH,
  };
}

interface FlightRisk {
  severity: Severity;
  type: "tornado" | "cyclone" | "hailstorm" | "dust_storm" | "strong_wind" | "low_visibility" | "none";
  windSpeed: number;
  gustSpeed: number;
  timing: TimingWindow;
  description: string;
}

function detectFlightRisks(insight: WeatherInsight, envRisks: EnvironmentalRisk): FlightRisk {
  const peakWindDay = insight.dataByDay.reduce(
    (worst, day, idx) => (day.windSpeed > (insight.dataByDay[worst]?.windSpeed ?? 0) ? idx : worst), 0
  );
  const timing: TimingWindow = peakWindDay <= 1 ? "Next 24h" : peakWindDay <= 3 ? "1–3 Days" : "3–5 Days";

  if (insight.hasTornadoRisk && insight.pressureDropDetected) {
    return {
      severity: "danger", type: "tornado",
      windSpeed: insight.maxWindSpeed, gustSpeed: insight.maxWindGust, timing,
      description: `Tornado/cyclone risk detected. Gusts up to ${insight.maxWindGust} km/h with rapid pressure drop. Secure all outdoor equipment and shelter livestock immediately.`,
    };
  }
  if (envRisks.dustStormRisk && insight.maxWindGust >= THRESHOLDS.FLIGHT_GUST_SEVERE) {
    return {
      severity: "danger", type: "dust_storm",
      windSpeed: insight.maxWindSpeed, gustSpeed: insight.maxWindGust, timing,
      description: `Dust storm conditions expected. ${insight.maxWindSpeed} km/h wind with low humidity. Protect seedlings, greenhouse covers, and shelter animals.`,
    };
  }
  if (insight.maxWindSpeed >= THRESHOLDS.FLIGHT_WIND_DANGER) {
    return {
      severity: "warning", type: "strong_wind",
      windSpeed: insight.maxWindSpeed, gustSpeed: insight.maxWindGust, timing,
      description: `Strong wind and potential hail expected up to ${insight.maxWindSpeed} km/h. Protect young plants, check greenhouse stability, secure equipment.`,
    };
  }
  if (insight.lowVisibility) {
    return {
      severity: "warning", type: "low_visibility",
      windSpeed: insight.maxWindSpeed, gustSpeed: insight.maxWindGust, timing,
      description: `Low visibility (< ${THRESHOLDS.FLIGHT_VISIBILITY_LOW} km). Unsafe for aerial surveying. Postpone drone and aircraft operations.`,
    };
  }
  if (insight.maxWindSpeed >= THRESHOLDS.FLIGHT_WIND_CAUTION) {
    return {
      severity: "info", type: "strong_wind",
      windSpeed: insight.maxWindSpeed, gustSpeed: insight.maxWindGust, timing,
      description: `Moderate winds (${insight.maxWindSpeed} km/h) expected. Monitor conditions before aerial operations.`,
    };
  }
  return { severity: "info", type: "none", windSpeed: insight.maxWindSpeed, gustSpeed: insight.maxWindGust, timing: "Next 24h", description: "" };
}

/* ============================================================
 * RECOMMENDATION ENGINE — All industry domains
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

function generateRecommendations(
  insight: WeatherInsight,
  envRisks: EnvironmentalRisk,
  flightRisk: FlightRisk,
  locationName: string,
  seed: number,
  farm?: FarmProfile  
): ProactiveAlert[] {
  const now = new Date().toLocaleString();
  const ts = seed;

  const alerts: ProactiveAlert[] = [];
  const farm = { cropType: "tomato" }; // later replace with real user data
  const diseaseRisk = detectCropDiseaseRisk(insight, farm);
  
  if (diseaseRisk.blightRisk) {
  alerts.push({
    id: makeId(),
    type: "warning",
    icon: "sprout",
    title: "Tomato Blight Risk",
    message: "High humidity and moderate temperature detected. High risk of blight. Apply preventive fungicide and improve airflow.",
    detail: `Humidity: ${insight.maxHumidity}% | Temp: ${insight.maxTemp}°C`,
    timing: "1–3 Days",
    tags: ["crop"],
    isRead: false,
    time: new Date().toLocaleString(),
    generatedAt: seed,
  });
}

  // ---- CROPS ----
  if (insight.needsIrrigation) {
    alerts.push({
      id: makeId(), type: "warning", icon: "droplets",
      title: "Initiate Irrigation — Crops",
      message: MSG_POOLS.irrigation(insight.consecutiveDryDays, insight.totalRainfall, locationName),
      detail: `Total rain forecast: ${insight.totalRainfall.toFixed(1)} mm over ${insight.daysOfData} days. Dry streak: ${insight.consecutiveDryDays} days.`,
      timing: "1–3 Days", tags: ["crop"], isRead: false, time: now, generatedAt: ts,
    });
  }
  if (insight.hasHeavyRain) {
    const peakDay = insight.dataByDay.findIndex(d => d.rainfall >= THRESHOLDS.HEAVY_RAIN);
    alerts.push({
      id: makeId(), type: "warning", icon: "cloud-rain",
      title: "Heavy Rain — Protect Crops",
      message: MSG_POOLS.heavyRain(insight.maxRainfall, locationName),
      detail: `Peak rainfall: ${insight.maxRainfall.toFixed(1)} mm. Wind: ${insight.maxWindSpeed} km/h. Humidity: ${insight.maxHumidity}%.`,
      timing: timeLabel(peakDay), tags: ["crop", "general"], isRead: false, time: now, generatedAt: ts,
    });
  }
  if (envRisks.fungalRisk) {
    alerts.push({
      id: makeId(), type: "warning", icon: "sprout",
      title: "Fungal Disease Risk — Crops",
      message: MSG_POOLS.fungal(insight.maxHumidity, locationName),
      detail: `Max humidity: ${insight.maxHumidity}%. Temp: ${insight.minTemp.toFixed(0)}–${insight.maxTemp.toFixed(0)}°C.`,
      timing: "1–3 Days", tags: ["crop"], isRead: false, time: now, generatedAt: ts,
      actionWindow: "within 24 hours",
      priority: "high",
    });
  }
  if (insight.hasFrostRisk) {
    alerts.push({
      id: makeId(), type: "danger", icon: "thermometer",
      title: "Frost Risk — Crops",
      message: MSG_POOLS.frost(insight.minTemp, locationName),
      detail: `Min temp: ${insight.minTemp.toFixed(1)}°C. Frost threshold: ${THRESHOLDS.FROST_RISK}°C.`,
      timing: "Next 24h", tags: ["crop", "vegetables"], isRead: false, time: now, generatedAt: ts,
    });
  }

  // ---- VEGETABLES (separate domain) ----
  if (envRisks.vegetableHeatStress) {
    alerts.push({
      id: makeId(), type: "warning", icon: "salad",
      title: "Vegetable Heat Stress Alert",
      message: MSG_POOLS.vegetableHeat(insight.maxTemp, locationName),
      detail: `Max temp: ${insight.maxTemp.toFixed(1)}°C. Vegetable heat threshold: ${THRESHOLDS.VEGETABLE_HEAT_STRESS}°C.`,
      timing: "Next 24h", tags: ["vegetables", "crop"], isRead: false, time: now, generatedAt: ts,
    });
  }
  if (envRisks.vegetableColdStress) {
    alerts.push({
      id: makeId(), type: "warning", icon: "thermometer",
      title: "Vegetable Cold Stress Alert",
      message: MSG_POOLS.vegetableCold(insight.minTemp, locationName),
      detail: `Min temp: ${insight.minTemp.toFixed(1)}°C. Vegetable cold threshold: ${THRESHOLDS.VEGETABLE_COLD_STRESS}°C.`,
      timing: "Next 24h", tags: ["vegetables"], isRead: false, time: now, generatedAt: ts,
    });
  }

  // ---- LIVESTOCK ----
  if (insight.hasHeatStress) {
    alerts.push({
      id: makeId(), type: "warning", icon: "thermometer",
      title: "Livestock Heat Stress Alert",
      message: MSG_POOLS.heatStress(insight.maxTemp, locationName),
      detail: `Max temp: ${insight.maxTemp.toFixed(1)}°C. Threshold: ${THRESHOLDS.HEAT_STRESS_LIVESTOCK}°C.`,
      timing: "Next 24h", tags: ["livestock"], isRead: false, time: now, generatedAt: ts,
    });
  }
  if (insight.hasStormRisk) {
    alerts.push({
      id: makeId(), type: "danger", icon: "wind",
      title: "Storm Alert — Shelter Livestock",
      message: MSG_POOLS.stormShelter(insight.maxWindSpeed, locationName),
      detail: `Wind: ${insight.maxWindSpeed} km/h. Gusts: ${insight.maxWindGust} km/h. Pressure drop: ${insight.pressureDropDetected ? "Yes" : "No"}.`,
      timing: "1–3 Days", tags: ["livestock", "general"], isRead: false, time: now, generatedAt: ts,
    });
  }
  if (insight.minTemp <= THRESHOLDS.COLD_STRESS) {
    alerts.push({
      id: makeId(), type: "warning", icon: "thermometer",
      title: "Cold Stress — Livestock",
      message: `Low temperatures (${insight.minTemp.toFixed(0)}°C) forecast for ${locationName}. Extra bedding and shelter required for young animals. Increase feed rations. Check water troughs for freezing.`,
      detail: `Min temp: ${insight.minTemp.toFixed(1)}°C. Cold stress threshold: ${THRESHOLDS.COLD_STRESS}°C.`,
      timing: "Next 24h", tags: ["livestock"], isRead: false, time: now, generatedAt: ts,
    });
  }

  // ---- AQUACULTURE ----
  if (envRisks.aquaTempStress) {
    alerts.push({
      id: makeId(), type: "warning", icon: "fish",
      title: "Aquaculture Temperature Alert",
      message: MSG_POOLS.aquaTempStress(insight.minTemp, insight.maxTemp, locationName),
      detail: `Air temp: ${insight.minTemp.toFixed(0)}–${insight.maxTemp.toFixed(0)}°C. Safe aqua range: ${THRESHOLDS.AQUA_TEMP_LOW}–${THRESHOLDS.AQUA_TEMP_HIGH}°C.`,
      timing: "1–3 Days", tags: ["aquaculture"], isRead: false, time: now, generatedAt: ts,
    });
  }
  if (envRisks.waterQualityRisk) {
    alerts.push({
      id: makeId(), type: "danger", icon: "waves",
      title: "Water Quality Risk — Aquaculture",
      message: MSG_POOLS.disasterRain(insight.totalRainfall, locationName),
      detail: `Total rainfall: ${insight.totalRainfall.toFixed(1)} mm. Max/day: ${insight.maxRainfall.toFixed(1)} mm.`,
      timing: "1–3 Days", tags: ["aquaculture"], isRead: false, time: now, generatedAt: ts,
    });
  }

  // ---- SURVEYOR ----
  if (insight.hasHeavyRain || insight.hasStormRisk || insight.lowVisibility) {
    alerts.push({
      id: makeId(), type: "warning", icon: "eye",
      title: "Surveyor Field Conditions Warning",
      message: MSG_POOLS.surveyor(insight.maxRainfall, insight.maxWindSpeed, locationName),
      detail: `Rain: ${insight.maxRainfall.toFixed(0)} mm. Wind: ${insight.maxWindSpeed} km/h. Visibility: ${insight.lowVisibility ? "Poor" : "Adequate"}.`,
      timing: "1–3 Days", tags: ["surveyor"], isRead: false, time: now, generatedAt: ts,
    });
  }

  // ---- FLIGHT ----
  if (flightRisk.type !== "none") {
    alerts.push({
      id: makeId(), type: flightRisk.severity as AlertType, icon: "plane",
      title: `Flight Alert: ${flightRisk.type.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase())} Risk`,
      message: flightRisk.description,
      detail: `Wind: ${flightRisk.windSpeed} km/h. Gusts: ${flightRisk.gustSpeed} km/h. Location: ${locationName}.`,
      timing: flightRisk.timing, tags: ["flight", "crop", "livestock"],
      isRead: false, time: now, generatedAt: ts,
    });
  }

  // ---- DISASTER / TORNADO ----
  if (insight.hasTornadoRisk) {
    alerts.push({
      id: makeId(), type: "danger", icon: "cloud-lightning",
      title: "⚠️ Tornado / Severe Storm Risk",
      message: MSG_POOLS.tornado(insight.maxWindGust, locationName),
      detail: `Max gust: ${insight.maxWindGust} km/h. Pressure drop: ${insight.pressureDropDetected ? "Detected" : "Not detected"}.`,
      timing: "Next 24h", tags: ["general", "crop", "livestock", "aquaculture", "vegetables"],
      isRead: false, time: now, generatedAt: ts,
    });
  }

  // ---- UV / ENVIRONMENTAL ----
  if (envRisks.highUVRisk) {
    alerts.push({
      id: makeId(), type: "warning", icon: "sun",
      title: `High UV Index — ${insight.maxUV >= THRESHOLDS.UV_EXTREME ? "Extreme" : "High"} Exposure Risk`,
      message: MSG_POOLS.uvHigh(insight.maxUV, locationName),
      detail: `UV Index: ${insight.maxUV}. Threshold: ${THRESHOLDS.UV_HIGH}.`,
      timing: "Next 24h", tags: ["general", "crop", "vegetables"],
      isRead: false, time: now, generatedAt: ts,
    });
  }
  if (envRisks.dustStormRisk) {
    alerts.push({
      id: makeId(), type: "warning", icon: "wind",
      title: "Dust Storm — Environmental Alert",
      message: `Dry, windy conditions in ${locationName} may generate dust storms. Humidity: ${insight.avgHumidity.toFixed(0)}%. Protect water sources and reduce outdoor livestock exposure.`,
      detail: `Humidity: ${insight.avgHumidity.toFixed(0)}%. Wind: ${insight.maxWindSpeed} km/h.`,
      timing: "1–3 Days", tags: ["general", "livestock", "crop"],
      isRead: false, time: now, generatedAt: ts,
    });
  }
  if (envRisks.pollenSurge) {
    alerts.push({
      id: makeId(), type: "info", icon: "sprout",
      title: "Pollen Surge Conditions",
      message: `Warm, dry conditions with moderate wind in ${locationName} may cause elevated pollen levels. Monitor livestock for allergic reactions. Beekeepers: highly favourable pollination window.`,
      detail: `Temp: ${insight.maxTemp.toFixed(0)}°C. Humidity: ${insight.avgHumidity.toFixed(0)}%. Wind: ${insight.maxWindSpeed} km/h.`,
      timing: "1–3 Days", tags: ["livestock", "crop"],
      isRead: false, time: now, generatedAt: ts,
    });
  }

  // ---- BASELINE STATUS ALERTS ----
  // Ensure every industry tag has at least one alert so filters aren't empty
  const coveredTags = new Set(alerts.flatMap(a => a.tags));
  const baselineAlerts: { tag: IndustryTag; title: string; message: string; icon: string }[] = [
    { tag: "crop", title: "Crop Conditions — Normal", message: `No critical crop alerts for ${locationName}. Current forecast shows manageable conditions. Continue routine monitoring of soil moisture, pest pressure, and growth stages.`, icon: "sprout" },
    { tag: "vegetables", title: "Vegetable Garden — Stable", message: `Vegetable growing conditions in ${locationName} are within safe ranges. No extreme heat, frost, or excessive rainfall expected. Maintain regular watering and weeding schedules.`, icon: "salad" },
    { tag: "livestock", title: "Livestock Conditions — Safe", message: `No heat stress, cold stress, or storm risks detected for livestock in ${locationName}. Maintain standard feed and water routines. Monitor pasture quality.`, icon: "thermometer" },
    { tag: "aquaculture", title: "Aquaculture — Normal Range", message: `Air temperatures in ${locationName} are within safe bounds for pond and tank operations. Continue standard aeration and feeding schedules. Monitor dissolved oxygen.`, icon: "fish" },
    { tag: "flight", title: "Flight Conditions — Clear", message: `Wind speeds and visibility in ${locationName} are within safe operating limits for aerial surveying and drone operations. Check local NOTAMs before flight.`, icon: "plane" },
    { tag: "surveyor", title: "Survey Conditions — Favourable", message: `Field conditions in ${locationName} are suitable for ground surveying. No heavy rain or high wind expected. GPS accuracy should be normal.`, icon: "eye" },
  ];

  for (const base of baselineAlerts) {
    if (!coveredTags.has(base.tag)) {
      alerts.push({
        id: makeId(), type: "success" as AlertType, icon: base.icon,
        title: base.title,
        message: base.message,
        detail: `Based on ${insight.daysOfData}-day forecast. Temp: ${insight.minTemp.toFixed(0)}–${insight.maxTemp.toFixed(0)}°C. Rain: ${insight.totalRainfall.toFixed(1)} mm. Wind: ${insight.maxWindSpeed} km/h.`,
        timing: "1–3 Days" as TimingWindow, tags: [base.tag], isRead: false, time: now, generatedAt: ts,
      });
    }
  }

  const severityOrder: Record<AlertType, number> = { danger: 0, warning: 1, info: 2, success: 3 };
  alerts.sort((a, b) => severityOrder[a.type] - severityOrder[b.type]);
  return alerts;
}

/* ============================================================
 * PUSH NOTIFICATION HELPER
 * Requests permission and sends a Web Push notification
 * for danger-level alerts. Also calls the Supabase edge
 * function (send-alert-push) which delivers the SMS.
 * ============================================================ */

async function sendPushNotification(alert: ProactiveAlert, userId?: string) {
  // Web Push (dashboard / PWA)
  if ("Notification" in window && Notification.permission === "granted") {
    new Notification(alert.title, {
      body: alert.message.slice(0, 120),
      icon: "/favicon.ico",
      tag: alert.id,
    });
  } else if ("Notification" in window && Notification.permission === "default") {
    const perm = await Notification.requestPermission();
    if (perm === "granted") {
      new Notification(alert.title, {
        body: alert.message.slice(0, 120),
        icon: "/favicon.ico",
        tag: alert.id,
      });
    }
  }

  // Mobile SMS via Supabase edge function (if user opted in)
  if (userId && (alert.type === "danger" || alert.type === "warning")) {
    try {
      await supabase.functions.invoke("send-alert-sms", {
        body: {
          userId,
          title: alert.title,
          message: alert.message.slice(0, 160),
          severity: alert.type,
          tags: alert.tags,
        },
      });
    } catch (_e) {
      // SMS delivery is best-effort; silently ignore failures
    }
  }
}

/* ============================================================
 * VISUAL MAPS & UI CONFIG
 * ============================================================ */

const iconMap: Record<AlertType, any> = {
  warning: AlertTriangle,
  danger: AlertOctagon,
  info: Info,
  success: CheckCircle,
};

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

const tagColorMap: Record<IndustryTag, string> = {
  crop: "bg-success/10 text-success border-success/20",
  livestock: "bg-warning/10 text-warning border-warning/20",
  aquaculture: "bg-accent/10 text-accent border-accent/20",
  vegetables: "bg-emerald-500/10 text-emerald-600 border-emerald-300/30",
  flight: "bg-destructive/10 text-destructive border-destructive/20",
  surveyor: "bg-primary/10 text-primary border-primary/20",
  general: "bg-muted text-muted-foreground border-border",
};

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
  salad: Salad,
  sun: AlertCircle,
};

/* ============================================================
 * ALERTS COMPONENT
 * ============================================================ */

export default function Alerts() {
  const { user } = useAuth();
  const { position } = useGeolocation();
  const { forecast, refresh: refreshWeather } = useWeather(position.lat, position.lon);
  const { toast } = useToast();
  const {
    alerts: visibleAlerts,
    markRead,
    dismiss,
  } = useUserAlerts(forecast, position.locationName);

  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [dbAlerts, setDbAlerts] = useState<any[]>([]);
  const [showTicketForm, setShowTicketForm] = useState(false);
  const [ticketLoading, setTicketLoading] = useState(false);
  const [ticket, setTicket] = useState({ subject: "", description: "", category: "general" });
  const [activeTagFilter, setActiveTagFilter] = useState<IndustryTag | "all">("all");
  const [lastGeneratedAt, setLastGeneratedAt] = useState<number>(() => {
    const stored = localStorage.getItem(LS_LAST_GENERATED);
    return stored ? parseInt(stored, 10) : 0;
  });
  const [cachedAlerts, setCachedAlerts] = useState<ProactiveAlert[]>(() => {
    try {
      const stored = localStorage.getItem(LS_ALERT_CACHE);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });
  const [refreshing, setRefreshing] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [farm, setFarm] = useState<FarmProfile | null>(null);

  /* ----------- Real-time disaster alerts via Supabase ----------- */
  useEffect(() => {
    // Initial fetch
    supabase
      .from("disaster_alerts")
      .select("*")
      .eq("active", true)
      .order("created_at", { ascending: false })
      .then(({ data }) => { if (data) setDbAlerts(data); });
    
   useEffect(() => {
  if (!user?.id) return;

  supabase
    .from("farm_profiles")
    .select("*")
    .eq("user_id", user.id)
    .single()
    .then(({ data }) => {
      if (data) setFarm(data);
    });
}, [user?.id]);

    // Subscribe to new inserts / updates in real-time
    const channel = supabase
      .channel("disaster_alerts_rt")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "disaster_alerts" },
        (payload) => {
          if (payload.eventType === "INSERT") {
            const newAlert = payload.new as any;
            setDbAlerts(prev => [newAlert, ...prev]);
            // Push immediately for new disasters
            sendPushNotification(
            {
                id: newAlert.id,
                type: "danger" as AlertType,
                title: newAlert.title,
                message: newAlert.description,
                detail: "",
                timing: "Next 24h" as TimingWindow,
                tags: ["general"] as IndustryTag[],
                isRead: false,
                time: new Date().toLocaleString(),
                generatedAt: Date.now(),
                icon: "cloud-lightning",
              },
              user?.id
            );
          }
          if (payload.eventType === "UPDATE") {
            setDbAlerts(prev => prev.map(a => a.id === payload.new.id ? payload.new : a));
          }
          if (payload.eventType === "DELETE") {
            setDbAlerts(prev => prev.filter(a => a.id !== payload.old?.id));
          }
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user?.id]);

  /* ----------- 72-hour proactive alert generation ----------- */
  const generateAndCache = useCallback(
    (seed: number) => {
      if (!forecast || forecast.length === 0) return;

      const insight = analyzeWeatherData(forecast);
      const envRisks = calculateEnvironmentalRisks(insight);
      const flightRisk = detectFlightRisks(insight, envRisks);
      const newAlerts = generateRecommendations(
        insight, envRisks, flightRisk,
        position.locationName || "your area",
        seed
      );

      function detectCropDiseaseRisk(
  insight: WeatherInsight,
  farm?: { cropType?: string }
): CropDiseaseRisk {
  if (!farm?.cropType) return {};

  if (farm.cropType === "tomato") {
    return {
      blightRisk: insight.maxHumidity > 85 && insight.maxTemp < 30,
      bacterialSpot: insight.hasHeavyRain && insight.maxTemp > 25,
    };
  }

  if (farm.cropType === "maize") {
    return {
      leafBlight: insight.maxHumidity > 80,
    };
  }

  return {};
}

  return {};
}

      setCachedAlerts(newAlerts);
      setLastGeneratedAt(seed);
      localStorage.setItem(LS_LAST_GENERATED, String(seed));
      localStorage.setItem(LS_ALERT_CACHE, JSON.stringify(newAlerts));

      // Deliver push/SMS for danger and warning alerts
      newAlerts
        .filter(a => a.type === "danger" || a.type === "warning")
        .forEach(a => sendPushNotification(a, user?.id));
    },
    [forecast, position.locationName, user?.id]
  );

  // On mount and every 15min: check if 72h window has elapsed; regenerate if so
  useEffect(() => {
    const check = () => {
      const now = Date.now();
      if (now - lastGeneratedAt >= ALERT_INTERVAL_MS) {
        generateAndCache(now);
      }
    };

    check(); // immediate check on mount / forecast update
    intervalRef.current = setInterval(check, WEATHER_REFRESH_MS);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [generateAndCache, lastGeneratedAt]);

  const handleManualRefresh = async () => {
    setRefreshing(true);
    refreshWeather?.();
    setTimeout(() => {
      generateAndCache(Date.now());
      setRefreshing(false);
      toast({ title: "Alerts refreshed", description: "Latest weather data applied." });
    }, 1500);
  };

  /* ----------- Derived alert stack ----------- */
  const proactiveAlerts = useMemo(() => cachedAlerts, [cachedAlerts]);

  const allAlerts = useMemo(() => {
    const combined: any[] = [...proactiveAlerts, ...visibleAlerts];
    if (activeTagFilter === "all") return combined;
    return combined.filter(
      (a) => "tags" in a && a.tags?.includes(activeTagFilter)
    );
  }, [proactiveAlerts, visibleAlerts, activeTagFilter]);

  const unreadAlerts = allAlerts.filter(a => !a.isRead);
  const readAlerts = allAlerts.filter(a => a.isRead);

  const toggleExpand = useCallback((id: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }, []);

  const submitTicket = async () => {
    if (!ticket.subject.trim() || !ticket.description.trim()) {
      toast({ title: "Required", description: "Please fill in subject and description.", variant: "destructive" });
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
    { label: "🥦 Vegetables", value: "vegetables" },
    { label: "🐄 Livestock", value: "livestock" },
    { label: "🐟 Aquaculture", value: "aquaculture" },
    { label: "✈️ Flight", value: "flight" },
    { label: "📐 Surveyor", value: "surveyor" },
  ];

  // Live countdown timer that ticks every 60 seconds
  const [nextRefreshIn, setNextRefreshIn] = useState("");
  useEffect(() => {
    const tick = () => {
      const remaining = ALERT_INTERVAL_MS - (Date.now() - lastGeneratedAt);
      if (remaining <= 0) {
        setNextRefreshIn("now");
        return;
      }
      const hours = Math.floor(remaining / (1000 * 60 * 60));
      const mins = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));
      const secs = Math.floor((remaining % (1000 * 60)) / 1000);
      setNextRefreshIn(hours > 0 ? `${hours}h ${mins}m ${secs}s` : `${mins}m ${secs}s`);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [lastGeneratedAt]);

  async function submitFeedback(alertId: string, applied: boolean) {
  await supabase.from("alert_feedback").insert({
    user_id: user?.id,
    alert_id: alertId,
    applied,
  });
}

  /* ============================================================
   * RENDER — Alert Card (reused for unread and read sections)
   * ============================================================ */
  const renderAlertCard = (a: any, dimmed = false) => {
    const Icon = iconMap[a.type as AlertType] ?? Info;
    const expanded = expandedIds.has(a.id);
    const DetailIcon = a.icon ? alertIconMap[a.icon] : null;

    return (
      <div
        key={a.id}
        className={`rounded-lg border-l-4 p-4 ${styleMap[a.type as AlertType] ?? "border-l-accent bg-accent/5"} transition-all ${dimmed ? "opacity-60" : ""}`}
      >
        <div className="flex gap-3">
          <Icon className={`h-5 w-5 mt-0.5 shrink-0 ${iconColorMap[a.type as AlertType] ?? "text-accent"}`} />
          <div className="flex-1 min-w-0">
            {/* Title row */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 flex-wrap">
                <h4 className="font-semibold text-sm">{a.title}</h4>
                {!dimmed && <span className="h-2 w-2 rounded-full bg-destructive shrink-0" />}
                {a.timing && (
                  <Badge variant="outline" className="text-[10px]">{a.timing}</Badge>
                )}
                {DetailIcon && <DetailIcon className="h-3.5 w-3.5 text-muted-foreground" />}
              </div>
              <button onClick={() => toggleExpand(a.id)} className="text-muted-foreground hover:text-foreground ml-2 shrink-0">
                {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </button>
            </div>

            {/* Message */}
            <p className={`text-sm text-muted-foreground mt-1 ${!expanded ? "line-clamp-2" : ""}`}>
              {a.message}
            </p>

            {/* Expanded detail */}
            {expanded && a.detail && (
              <p className="text-xs text-muted-foreground/70 mt-2 italic border-l-2 border-border pl-2">
                {a.detail}
              </p>
            )}

            {/* Delivery badges */}
            {expanded && (a.deliveredViaPush || a.deliveredViaSMS) && (
              <div className="flex gap-2 mt-2">
                {a.deliveredViaPush && (
                  <span className="text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                    📲 Push delivered
                  </span>
                )}
                {a.deliveredViaSMS && (
                  <span className="text-[10px] bg-success/10 text-success px-2 py-0.5 rounded-full">
                    📱 SMS sent
                  </span>
                )}
              </div>
            )}

            {/* Footer */}
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              {a.tags?.map((tag: IndustryTag) => (
                <span key={tag} className={`text-[10px] px-2 py-0.5 rounded-full border font-medium ${tagColorMap[tag] ?? tagColorMap.general}`}>
                  #{tag}
                </span>
              ))}
              <span className="flex-1" />
              <p className="text-xs text-muted-foreground">{a.time}</p>
              {!dimmed && markRead && (
                <button onClick={() => markRead(a.id)} className="text-xs text-primary hover:underline flex items-center gap-1">
                  <Check className="h-3 w-3" /> Mark read
                </button>
               <div className="flex gap-2 mt-2">
             <button
              onClick={() => submitFeedback(a.id, true)}
              className="text-xs bg-success/10 px-2 py-1 rounded"
             >
               👍 Applied
             </button>
             <button
             onClick={() => submitFeedback(a.id, false)}
              className="text-xs bg-destructive/10 px-2 py-1 rounded"
           >
              👎 Ignored
           </button>
            </div>
              )}
              {dismiss && (
                <button onClick={() => dismiss(a.id)} className="text-xs text-destructive hover:underline flex items-center gap-1">
                  <Trash2 className="h-3 w-3" /> Dismiss
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  /* ============================================================
   * JSX
   * ============================================================ */
  return (
    <div className="p-4 lg:p-8 max-w-6xl mx-auto">

      {/* ---- Header ---- */}
      <div className="flex items-center justify-between mb-6 gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-bold">Proactive Alerts</h1>
          {unreadAlerts.length > 0 && (
            <span className="bg-destructive text-destructive-foreground text-xs px-2 py-0.5 rounded-full font-semibold">
              {unreadAlerts.length} new
            </span>
          )}
        </div>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={handleManualRefresh}
            disabled={refreshing}
          >
            <RefreshCw className={`h-4 w-4 mr-1 ${refreshing ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <Button size="sm" variant="outline" onClick={() => setShowTicketForm(!showTicketForm)}>
            <MessageSquarePlus className="h-4 w-4 mr-1" /> Support Ticket
          </Button>
        </div>
      </div>

      {/* ---- Next scheduled refresh ---- */}
      <p className="text-xs text-muted-foreground mb-4">
        ⏱ Next scheduled alert cycle in <strong>{nextRefreshIn}</strong> &nbsp;•&nbsp;
        Alerts refresh every 72 hours with real-time weather data
      </p>

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
          <Input placeholder="Subject" value={ticket.subject} onChange={(e) => setTicket({ ...ticket, subject: e.target.value })} />
          <Select value={ticket.category} onValueChange={(v) => setTicket({ ...ticket, category: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="general">General</SelectItem>
              <SelectItem value="weather">Weather Issue</SelectItem>
              <SelectItem value="crop">Crop Problem</SelectItem>
              <SelectItem value="vegetables">Vegetable Issue</SelectItem>
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
              {ticketLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Send className="h-4 w-4 mr-1" /> Submit</>}
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setShowTicketForm(false)}>Cancel</Button>
          </div>
        </div>
      )}

      {/* ---- Real-time Disaster Alerts (Supabase realtime) ---- */}
      {dbAlerts.length > 0 && (
        <section className="mb-6">
          <h2 className="font-semibold text-sm text-destructive mb-3 flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-destructive animate-pulse" />
            LIVE DISASTER ALERTS
          </h2>
          <div className="space-y-3">
            {dbAlerts.map((alert) => (
              <div key={alert.id} className="rounded-lg border-l-4 border-l-destructive bg-destructive/5 p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <AlertOctagon className="h-4 w-4 text-destructive" />
                      <h4 className="font-semibold text-sm">{alert.title}</h4>
                      <Badge variant="outline" className="text-[10px]">{alert.severity}</Badge>
                      <span className="text-[10px] bg-destructive/10 text-destructive px-2 py-0.5 rounded-full font-medium">LIVE</span>
                    </div>
                    <p className="text-sm text-muted-foreground">{alert.description}</p>
                    {alert.affected_regions?.length > 0 && (
                      <p className="text-xs text-muted-foreground mt-1">Regions: {alert.affected_regions.join(", ")}</p>
                    )}
                    <p className="text-xs text-muted-foreground mt-1">{new Date(alert.created_at).toLocaleString()}</p>
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

          {/* Unread / New */}
          {unreadAlerts.length > 0 && (
            <section>
              <h2 className="font-semibold text-sm text-muted-foreground mb-3">NEW</h2>
              <div className="space-y-3">
                {unreadAlerts.map(a => renderAlertCard(a, false))}
              </div>
            </section>
          )}

          {/* Read / Earlier */}
          {readAlerts.length > 0 && (
            <section>
              <h2 className="font-semibold text-sm text-muted-foreground mb-3">EARLIER</h2>
              <div className="space-y-3">
                {readAlerts.map(a => renderAlertCard(a, true))}
              </div>
            </section>
          )}

          {/* Empty state */}
          {allAlerts.length === 0 && dbAlerts.length === 0 && (
            <div className="text-center py-12">
              <Bell className="h-12 w-12 mx-auto text-muted-foreground/30" />
              <p className="text-muted-foreground mt-3">No alerts for your area right now</p>
              <p className="text-xs text-muted-foreground mt-1">
                Alerts auto-generate from live weather data every 72 hours
              </p>
            </div>
          )}
        </div>

        {/* ---- Sidebar Info ---- */}
        <div className="space-y-4">
          <div className="bg-muted rounded-xl p-4">
            <h3 className="font-semibold text-sm mb-2">How Alerts Work</h3>
            <ul className="text-xs text-muted-foreground space-y-1.5">
              <li>• Real-time weather data is analysed every 15 minutes</li>
              <li>• Full alert cycle regenerates every 72 hours with fresh messages</li>
              <li>• Covers: crops, vegetables, livestock, aquaculture, rain, disasters</li>
              <li>• Danger/warning alerts are also pushed to your phone via SMS</li>
              <li>• Web push notifications fire for live disaster alerts</li>
              <li>• Timing windows: Next 24h, 1–3 Days, 3–5 Days, 4–7 Days</li>
              <li>• Filter by industry using the tag buttons above</li>
            </ul>
          </div>
          <div className="bg-muted rounded-xl p-4">
            <h3 className="font-semibold text-sm mb-2">Delivery Channels</h3>
            <ul className="text-xs text-muted-foreground space-y-1.5">
              <li>📊 <strong>Dashboard</strong> — all alerts shown here in real-time</li>
              <li>📲 <strong>Web Push</strong> — browser notifications for danger events</li>
              <li>📱 <strong>SMS</strong> — critical alerts sent to your registered number</li>
              <li>🔴 <strong>Live</strong> — disaster alerts stream</li>
            </ul>
          </div>
          <div className="bg-card border border-border rounded-xl p-4 text-center">
            <p className="text-xs text-muted-foreground">
              Last generated: {lastGeneratedAt > 0 ? new Date(lastGeneratedAt).toLocaleString() : "Pending first weather data"}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
