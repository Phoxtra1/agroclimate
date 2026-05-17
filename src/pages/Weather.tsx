import { useState, useEffect, useMemo } from "react";
import {
  Droplets,
  Thermometer,
  Wind,
  MapPin,
  Sprout,
  RefreshCw,
  Cloud,
  CloudRain,
  CloudLightning,
  Sun,
  CloudSun,
  CloudDrizzle,
  Snowflake,
  CloudFog,
  Gauge,
  Leaf,
  TrendingUp,
  TrendingDown,
  CheckCircle,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useGeolocation } from "@/hooks/useGeolocation";
import { useWeather } from "@/hooks/useWeather";
import { WeatherDay } from "@/data/mock-data";

// ────────────────────────────────────────────────────────────
// TYPES
// ────────────────────────────────────────────────────────────
interface CropWaterAdvisory {
  crop: string;
  icon: string;
  /** Crop coefficient (Kc) */
  kc: number;
  /** Crop ET = ET₀ × Kc (mm/day) */
  cropET: number;
  /** Effective rainfall contributing to soil (mm) */
  effectiveRain: number;
  /** Net irrigation need = cropET − effectiveRain (mm/day, min 0) */
  irrigationNeed: number;
  /** Soil moisture status */
  soilStatus: "saturated" | "adequate" | "low" | "critical";
  /** Human-readable recommendation */
  recommendation: string;
}

interface IrrigationSummary {
  avgET: number;
  effectiveRain: number;
  avgSoilMoisture: number;
  avgSoilTemp: number;
  avgHumidity: number;
  overallNeed: "none" | "low" | "moderate" | "critical";
  criticalCrops: number;
  totalCrops: number;
}

// ────────────────────────────────────────────────────────────
// WEATHER CODE → CONDITION LABEL & ICON HINTS
// ────────────────────────────────────────────────────────────
const WEATHER_CODES: Record<number, { label: string; iconHint: string }> = {
  0: { label: "Unknown", iconHint: "cloud" },
  1000: { label: "Clear", iconHint: "sun" },
  1001: { label: "Cloudy", iconHint: "cloud" },
  1100: { label: "Mostly Clear", iconHint: "cloud-sun" },
  1101: { label: "Partly Cloudy", iconHint: "cloud-sun" },
  1102: { label: "Mostly Cloudy", iconHint: "cloud" },
  2000: { label: "Fog", iconHint: "fog" },
  2100: { label: "Light Fog", iconHint: "fog" },
  3000: { label: "Light Wind", iconHint: "wind" },
  3001: { label: "Wind", iconHint: "wind" },
  3002: { label: "Strong Wind", iconHint: "wind" },
  4000: { label: "Drizzle", iconHint: "drizzle" },
  4001: { label: "Rain", iconHint: "rain" },
  4200: { label: "Light Rain", iconHint: "drizzle" },
  4201: { label: "Heavy Rain", iconHint: "rain" },
  5000: { label: "Snow", iconHint: "snow" },
  5001: { label: "Flurries", iconHint: "snow" },
  5100: { label: "Light Snow", iconHint: "snow" },
  5101: { label: "Heavy Snow", iconHint: "snow" },
  6000: { label: "Freezing Drizzle", iconHint: "drizzle" },
  6001: { label: "Freezing Rain", iconHint: "rain" },
  6200: { label: "Light Freezing Rain", iconHint: "drizzle" },
  6201: { label: "Heavy Freezing Rain", iconHint: "rain" },
  7000: { label: "Ice Pellets", iconHint: "snow" },
  7101: { label: "Heavy Ice Pellets", iconHint: "snow" },
  7102: { label: "Light Ice Pellets", iconHint: "snow" },
  8000: { label: "Thunderstorm", iconHint: "thunder" },
};

function getCondition(code: number) {
  return WEATHER_CODES[code] || WEATHER_CODES[0];
}

// ────────────────────────────────────────────────────────────
// CROP DATABASE WITH WATER REQUIREMENTS
// ────────────────────────────────────────────────────────────
const CROPS = [
  { name: "Maize",   icon: "🌽", category: "Cereals",    kc: 1.15, wiltPoint: 15, fieldCapacity: 35, season: [3,4,5,6,7] },
  { name: "Tomato",  icon: "🍅", category: "Vegetables", kc: 1.05, wiltPoint: 18, fieldCapacity: 38, season: [1,2,10,11,12] },
  { name: "Cassava", icon: "🥔", category: "Roots",      kc: 0.80, wiltPoint: 12, fieldCapacity: 30, season: [3,4,5,6] },
  { name: "Onion",   icon: "🧅", category: "Vegetables", kc: 0.95, wiltPoint: 20, fieldCapacity: 40, season: [10,11,12,1,2] },
  { name: "Rice",    icon: "🌾", category: "Cereals",    kc: 1.20, wiltPoint: 25, fieldCapacity: 50, season: [4,5,6,7] },
  { name: "Yam",     icon: "🍠", category: "Roots",      kc: 0.85, wiltPoint: 14, fieldCapacity: 32, season: [3,4,5] },
  { name: "Pepper",  icon: "🌶️", category: "Vegetables", kc: 1.00, wiltPoint: 17, fieldCapacity: 36, season: [1,2,3,10,11,12] },
  { name: "Cabbage", icon: "🥬", category: "Vegetables", kc: 0.95, wiltPoint: 18, fieldCapacity: 38, season: [10,11,12,1,2] },
];

// ────────────────────────────────────────────────────────────
// IRRIGATION INTELLIGATION ENGINE (FAO Penman-Monteith concepts)
// ────────────────────────────────────────────────────────────
function computeIrrigationAdvisories(
  forecast: WeatherDay[],
  month: number
): { advisories: CropWaterAdvisory[]; summary: IrrigationSummary } {
  const shortTerm = forecast.slice(0, 3);
  const avgET = shortTerm.length
    ? shortTerm.reduce((s, d) => s + (d.evapotranspiration ?? 4.5), 0) / shortTerm.length
    : 4.5;
  const avgRainMm = shortTerm.length
    ? shortTerm.reduce((s, d) => s + (d.rainMm ?? 0), 0) / shortTerm.length
    : 0;
  const avgSoilMoisture = shortTerm.length
    ? shortTerm.reduce((s, d) => s + (d.soilMoisture ?? 30), 0) / shortTerm.length
    : 30;
  const avgSoilTemp = shortTerm.length
    ? shortTerm.reduce((s, d) => s + (d.soilTemperature ?? 28), 0) / shortTerm.length
    : 28;
  const avgHumidity = shortTerm.length
    ? shortTerm.reduce((s, d) => s + d.humidity, 0) / shortTerm.length
    : 65;

  const effectiveRain = avgRainMm * 0.8;
  const currentCrops = CROPS.filter((c) => c.season.includes(month));

  const advisories: CropWaterAdvisory[] = currentCrops.map((crop) => {
    const cropET = avgET * crop.kc;
    const irrigationNeed = Math.max(0, cropET - effectiveRain);

    let soilStatus: CropWaterAdvisory["soilStatus"] = "adequate";
    if (avgSoilMoisture >= crop.fieldCapacity) soilStatus = "saturated";
    else if (avgSoilMoisture <= crop.wiltPoint) soilStatus = "critical";
    else if (avgSoilMoisture <= crop.wiltPoint + 5) soilStatus = "low";

    let recommendation: string;
    if (soilStatus === "critical") {
      recommendation = `Urgent: Soil moisture critically low (${Math.round(avgSoilMoisture)}%). Apply ${irrigationNeed.toFixed(1)} mm/day immediately. Drip irrigation preferred.`;
    } else if (soilStatus === "low") {
      recommendation = `Apply ${irrigationNeed.toFixed(1)} mm/day. Soil moisture declining — irrigate in early morning to reduce evaporation.`;
    } else if (soilStatus === "saturated") {
      recommendation = `No irrigation needed. Soil is near saturation (${Math.round(avgSoilMoisture)}%). Ensure drainage to prevent waterlogging.`;
    } else if (irrigationNeed > 2) {
      recommendation = `Moderate irrigation needed: ${irrigationNeed.toFixed(1)} mm/day. Rain is insufficient to meet crop water demand.`;
    } else if (irrigationNeed > 0) {
      recommendation = `Light supplemental irrigation: ${irrigationNeed.toFixed(1)} mm/day. Rainfall covers most water needs.`;
    } else {
      recommendation = `Rainfall sufficient. No irrigation required for the next 3 days.`;
    }

    return {
      crop: crop.name,
      icon: crop.icon,
      kc: crop.kc,
      cropET: Math.round(cropET * 100) / 100,
      effectiveRain: Math.round(effectiveRain * 100) / 100,
      irrigationNeed: Math.round(irrigationNeed * 100) / 100,
      soilStatus,
      recommendation,
    };
  });

  const totalIrrigationNeed = advisories.reduce((s, a) => s + a.irrigationNeed, 0);
  const criticalCrops = advisories.filter((a) => a.soilStatus === "critical").length;
  const lowCrops = advisories.filter((a) => a.soilStatus === "low").length;

  const summary: IrrigationSummary = {
    avgET,
    effectiveRain,
    avgSoilMoisture,
    avgSoilTemp,
    avgHumidity,
    overallNeed: totalIrrigationNeed > 0 ? (criticalCrops > 0 ? "critical" : lowCrops > 0 ? "moderate" : "low") : "none",
    criticalCrops,
    totalCrops: advisories.length,
  };

  return { advisories, summary };
}

// ────────────────────────────────────────────────────────────
// SEASONAL AGRO DATA (West Africa baseline)
// ────────────────────────────────────────────────────────────
function getCurrentSeason(month: number) {
  if (month >= 3 && month <= 7) return { name: "Major Rainy Season", type: "rainy" as const };
  if (month >= 8 && month <= 10) return { name: "Minor Dry / Short Rainy", type: "rainy" as const };
  return { name: "Harmattan / Dry Season", type: "dry" as const };
}

function getSeasonalRecommendations(month: number): string[] {
  const season = getCurrentSeason(month);
  if (season.type === "rainy") {
    return [
      "Plant maize, yam, and cassava now for optimal yields",
      "Prepare drainage channels to prevent waterlogging",
      "Apply fertiliser early — rain aids nutrient absorption",
      "Monitor for fungal diseases in high humidity",
      "Harvest early-planted crops before heavy storms",
    ];
  }
  return [
    "Focus on irrigated crops: tomato, onion, cabbage, pepper",
    "Mulch around crops to conserve soil moisture",
    "Store harvested grains in dry, ventilated areas",
    "Prepare land for the upcoming rainy season",
    "Consider drip irrigation for water-efficient farming",
  ];
}

// ────────────────────────────────────────────────────────────
// WEATHER ICON COMPONENT
// ────────────────────────────────────────────────────────────
function WeatherIcon({ code, className }: { code: number; className?: string }) {
  const cn = className || "h-8 w-8";
  const hint = getCondition(code).iconHint;
  if (hint === "sun") return <Sun className={`${cn} text-amber-500`} />;
  if (hint === "cloud-sun") return <CloudSun className={`${cn} text-amber-400`} />;
  if (hint === "drizzle") return <CloudDrizzle className={`${cn} text-blue-400`} />;
  if (hint === "rain") return <CloudRain className={`${cn} text-blue-500`} />;
  if (hint === "thunder") return <CloudLightning className={`${cn} text-yellow-500`} />;
  if (hint === "snow") return <Snowflake className={`${cn} text-blue-200`} />;
  if (hint === "fog") return <CloudFog className={`${cn} text-gray-300`} />;
  if (hint === "wind") return <Wind className={`${cn} text-slate-400`} />;
  return <Cloud className={`${cn} text-gray-400`} />;
}

// ────────────────────────────────────────────────────────────
// SUB-COMPONENTS
// ────────────────────────────────────────────────────────────
function TodayWeather({ weather }: { weather: WeatherDay }) {
  if (!weather) return null;
  return (
    <div className="bg-gradient-to-br from-blue-600 to-blue-800 text-white rounded-2xl p-6 shadow-lg">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm opacity-80">Today's Agro Forecast</p>
          <p className="text-5xl font-bold mt-1">{weather.tempHigh}°C</p>
          <p className="text-sm opacity-80 mt-1">{weather.description}</p>
        </div>
        <WeatherIcon code={weather.weatherCode ?? 1000} className="h-16 w-16" />
      </div>
      <div className="grid grid-cols-4 gap-3 mt-6 pt-4 border-t border-white/20 text-center text-sm">
        <div>
          <Droplets className="h-4 w-4 mx-auto opacity-70" />
          <p className="font-semibold mt-1">{weather.rainProb}%</p>
          <p className="text-xs opacity-70">Rain Prob.</p>
        </div>
        <div>
          <Wind className="h-4 w-4 mx-auto opacity-70" />
          <p className="font-semibold mt-1">{weather.wind} km/h</p>
          <p className="text-xs opacity-70">Wind</p>
        </div>
        <div>
          <Thermometer className="h-4 w-4 mx-auto opacity-70" />
          <p className="font-semibold mt-1">{weather.tempLow}°C</p>
          <p className="text-xs opacity-70">Low Air</p>
        </div>
        <div>
          <Leaf className="h-4 w-4 mx-auto opacity-70" />
          <p className="font-semibold mt-1">{weather.evapotranspiration ?? 4.5}</p>
          <p className="text-xs opacity-70">ET₀ mm</p>
        </div>
      </div>
    </div>
  );
}

function ForecastRow({ day }: { day: WeatherDay }) {
  return (
    <div className="flex items-center justify-between py-2.5 border-b border-border/50 last:border-0">
      <div className="flex items-center gap-3 w-20">
        <WeatherIcon code={day.weatherCode ?? 1000} className="h-5 w-5" />
        <span className="text-sm font-medium">{day.day}</span>
      </div>
      <span className="text-xs text-muted-foreground w-20 text-center">{day.description}</span>
      <div className="flex items-center gap-1 text-xs w-14 justify-center">
        <Droplets className="h-3 w-3 text-blue-400" />
        <span>{day.rainProb}%</span>
      </div>
      <div className="flex items-center gap-1 text-xs w-14 justify-center">
        <Gauge className="h-3 w-3 text-amber-500" />
        <span>{day.soilMoisture}%</span>
      </div>
      <div className="text-sm font-medium text-right w-20">
        <span>{day.tempHigh}°</span>
        <span className="text-muted-foreground ml-1">/ {day.tempLow}°</span>
      </div>
    </div>
  );
}

function SoilStatusBadge({ status }: { status: CropWaterAdvisory["soilStatus"] }) {
  const styles = {
    critical: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300",
    low: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
    adequate: "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300",
    saturated: "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300",
  };
  return (
    <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${styles[status]}`}>
      {status}
    </span>
  );
}

// ────────────────────────────────────────────────────────────
// MAIN PAGE COMPONENT
// ────────────────────────────────────────────────────────────
export default function Weather() {
  const { position, loading: geoLoading } = useGeolocation();
  const { forecast, isLive, loading: weatherLoading, lastUpdated, refresh } = useWeather(
    position?.lat,
    position?.lon
  );

  const today = forecast[0];
  const currentMonth = new Date().getMonth() + 1;
  const season = getCurrentSeason(currentMonth);
  const recommendations = getSeasonalRecommendations(currentMonth);

  // Compute live irrigation advisories from forecast data
  const { advisories, summary } = useMemo(
    () => computeIrrigationAdvisories(forecast, currentMonth),
    [forecast, currentMonth]
  );

  const currentCrops = CROPS.filter((c) => c.season.includes(currentMonth));
  const isLoading = geoLoading || weatherLoading;

  return (
    <div className="p-4 lg:p-8 max-w-6xl mx-auto min-h-screen">
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <h1 className="text-xl font-bold">Agro Forecast</h1>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-xs">
            {season.type === "rainy" ? "🌧️" : "☀️"} {season.name}
          </Badge>
          <button
            onClick={refresh}
            className="p-1.5 rounded-lg hover:bg-muted transition-colors"
            title="Refresh weather data"
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {/* Location + status bar */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <MapPin className="h-3.5 w-3.5" />
          <span className="font-medium">{position?.community || position?.locationName || "Accra, Ghana"}</span>
          {position?.district && <span>• {position.district}</span>}
          {position?.region && <span>• {position.region}</span>}
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          {isLive ? (
            <span className="flex items-center gap-1 text-green-600 font-medium">
              <span className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" /> Live
            </span>
          ) : (
            <span className="flex items-center gap-1 text-amber-600 font-medium">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-500" /> Offline/Demo
            </span>
          )}
          {lastUpdated && (
            <span>
              Updated {lastUpdated.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            </span>
          )}
        </div>
      </div>

      {isLoading && !today ? (
        <div className="flex items-center justify-center py-20">
          <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : today ? (
        <div className="grid lg:grid-cols-3 gap-6">
          {/* Main column */}
          <div className="lg:col-span-2 space-y-5">
            <TodayWeather weather={today} />

            {/* Quick stats — agricultural metrics */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="bg-card rounded-xl p-4 text-center shadow-sm border border-border/40">
                <Droplets className="h-5 w-5 mx-auto text-blue-500" />
                <p className="text-lg font-bold mt-2">{today.humidity}%</p>
                <p className="text-xs text-muted-foreground">Humidity</p>
              </div>
              <div className="bg-card rounded-xl p-4 text-center shadow-sm border border-border/40">
                <CloudRain className="h-5 w-5 mx-auto text-blue-400" />
                <p className="text-lg font-bold mt-2">{today.rainMm ?? 0} mm</p>
                <p className="text-xs text-muted-foreground">Rainfall</p>
              </div>
              <div className="bg-card rounded-xl p-4 text-center shadow-sm border border-border/40">
                <Gauge className="h-5 w-5 mx-auto text-amber-600" />
                <p className="text-lg font-bold mt-2">{today.soilMoisture ?? 0}%</p>
                <p className="text-xs text-muted-foreground">Soil Moisture</p>
              </div>
              <div className="bg-card rounded-xl p-4 text-center shadow-sm border border-border/40">
                <Leaf className="h-5 w-5 mx-auto text-green-600" />
                <p className="text-lg font-bold mt-2">{today.evapotranspiration ?? 0}</p>
                <p className="text-xs text-muted-foreground">ET₀ (mm/day)</p>
              </div>
            </div>

            {/* ──────── IRRIGATION INTELLIGENCE PANEL ──────── */}
            <section>
              <h2 className="font-bold mb-3 flex items-center gap-2">
                <Droplets className="h-5 w-5 text-blue-500" />
                Irrigation Intelligence
                <Badge
                  variant="outline"
                  className={`text-[10px] ml-auto ${
                    summary.overallNeed === "critical"
                      ? "border-red-300 text-red-600 bg-red-50 dark:bg-red-950/20"
                      : summary.overallNeed === "moderate"
                      ? "border-amber-300 text-amber-600 bg-amber-50 dark:bg-amber-950/20"
                      : summary.overallNeed === "low"
                      ? "border-yellow-300 text-yellow-600 bg-yellow-50 dark:bg-yellow-950/20"
                      : "border-green-300 text-green-600 bg-green-50 dark:bg-green-950/20"
                  }`}
                >
                  {summary.overallNeed === "none" ? "✓ No Irrigation" : `⚠ ${summary.overallNeed} need`}
                </Badge>
              </h2>

              {/* Summary metrics row */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                <div className="bg-blue-50 dark:bg-blue-950/30 rounded-lg p-3 text-center border border-blue-100 dark:border-blue-900/40">
                  <p className="text-xs text-muted-foreground">Ref. ET₀</p>
                  <p className="text-lg font-bold text-blue-700 dark:text-blue-300">
                    {summary.avgET.toFixed(1)} <span className="text-xs font-normal text-muted-foreground">mm/d</span>
                  </p>
                </div>
                <div className="bg-cyan-50 dark:bg-cyan-950/30 rounded-lg p-3 text-center border border-cyan-100 dark:border-cyan-900/40">
                  <p className="text-xs text-muted-foreground">Eff. Rainfall</p>
                  <p className="text-lg font-bold text-cyan-700 dark:text-cyan-300">
                    {summary.effectiveRain.toFixed(1)} <span className="text-xs font-normal text-muted-foreground">mm/d</span>
                  </p>
                </div>
                <div className="bg-amber-50 dark:bg-amber-950/30 rounded-lg p-3 text-center border border-amber-100 dark:border-amber-900/40">
                  <p className="text-xs text-muted-foreground">Avg Soil Moist.</p>
                  <p className="text-lg font-bold text-amber-700 dark:text-amber-300">
                    {Math.round(summary.avgSoilMoisture)}%
                  </p>
                </div>
                <div className="bg-orange-50 dark:bg-orange-950/30 rounded-lg p-3 text-center border border-orange-100 dark:border-orange-900/40">
                  <p className="text-xs text-muted-foreground">Avg Soil Temp</p>
                  <p className="text-lg font-bold text-orange-700 dark:text-orange-300">
                    {Math.round(summary.avgSoilTemp)}°C
                  </p>
                </div>
              </div>

              {/* Per-crop water advisories */}
              <div className="bg-card rounded-xl shadow-sm border border-border/40 divide-y divide-border/50">
                {advisories.length === 0 ? (
                  <p className="text-xs text-muted-foreground p-4 text-center">
                    No crops in season this month. Check seasonal actions for guidance.
                  </p>
                ) : (
                  advisories.map((adv) => (
                    <div key={adv.crop} className="p-4">
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="flex items-center gap-2">
                          <span className="text-lg">{adv.icon}</span>
                          <span className="text-sm font-semibold">{adv.crop}</span>
                          <span className="text-[10px] text-muted-foreground">Kc={adv.kc}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <SoilStatusBadge status={adv.soilStatus} />
                          {adv.irrigationNeed > 0 ? (
                            <span className="text-xs font-bold text-amber-600 flex items-center gap-1">
                              <TrendingUp className="h-3 w-3" />
                              {adv.irrigationNeed.toFixed(1)} mm/day
                            </span>
                          ) : (
                            <span className="text-xs font-bold text-green-600 flex items-center gap-1">
                              <CheckCircle className="h-3 w-3" />
                              OK
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-4 text-[10px] text-muted-foreground mb-1">
                        <span>CropET: {adv.cropET.toFixed(1)} mm</span>
                        <span>Rain: {adv.effectiveRain.toFixed(1)} mm</span>
                        <span>Deficit: {adv.irrigationNeed.toFixed(1)} mm</span>
                      </div>
                      <p className="text-xs text-muted-foreground">{adv.recommendation}</p>
                    </div>
                  ))
                )}
              </div>
            </section>

            {/* 7-day forecast */}
            <section className="space-y-4">
              <div>
                <h2 className="font-bold mb-1">7-Day Agricultural Forecast</h2>
                <p className="text-xs text-muted-foreground">Daily evapotranspiration and soil moisture projections.</p>
              </div>
              <div className="bg-card rounded-xl p-4 shadow-sm border border-border/40">
                <div className="flex items-center justify-between text-[10px] text-muted-foreground mb-2 px-1">
                  <span className="w-20">Day</span>
                  <span className="w-20 text-center">Cond.</span>
                  <span className="w-14 text-center">Rain Prob</span>
                  <span className="w-14 text-center">Est Soil</span>
                  <span className="w-20 text-right">Air Temp</span>
                </div>
                {forecast.map((day) => (
                  <ForecastRow key={day.date} day={day} />
                ))}
              </div>
            </section>
          </div>

          {/* Sidebar: Agro info */}
          <div className="space-y-5">
            {/* Crops to plant */}
            <div className="bg-card rounded-xl p-4 shadow-sm border border-border/40">
              <h3 className="font-bold text-sm flex items-center gap-2 mb-3">
                <Sprout className="h-4 w-4 text-green-600" /> Plant This Season
              </h3>
              <div className="space-y-2">
                {currentCrops.map((crop) => (
                  <div key={crop.name} className="flex items-center gap-2 text-xs">
                    <span className="text-base">{crop.icon}</span>
                    <div className="flex-1">
                      <span className="font-medium">{crop.name}</span>
                      <span className="text-muted-foreground ml-1.5">({crop.category})</span>
                    </div>
                    {crop.wiltPoint > 15 && <Droplets className="h-3 w-3 text-blue-400" />}
                  </div>
                ))}
                {currentCrops.length === 0 && (
                  <p className="text-xs text-muted-foreground">
                    No ideal planting window this month. Focus on crop maintenance.
                  </p>
                )}
              </div>
            </div>

            {/* Seasonal recommendations */}
            <div className="bg-card rounded-xl p-4 shadow-sm border border-border/40">
              <h3 className="font-bold text-sm mb-3">📋 Seasonal Actions</h3>
              <ul className="space-y-2">
                {recommendations.map((rec, i) => (
                  <li key={i} className="text-xs text-muted-foreground flex items-start gap-2">
                    <span className="text-green-600 mt-0.5">•</span> {rec}
                  </li>
                ))}
              </ul>
            </div>

            {/* Dynamic farmer tip based on live data */}
            <div className="bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded-xl p-4">
              <p className="text-sm font-semibold text-green-800 dark:text-green-200">💡 Live Farmer Tip</p>
              <p className="text-sm text-green-700 dark:text-green-300 mt-1">
                {summary.overallNeed === "critical"
                  ? `${summary.criticalCrops} crop(s) at critical soil moisture. Irrigate immediately — ET₀ is ${summary.avgET.toFixed(1)} mm/day with only ${summary.effectiveRain.toFixed(1)} mm effective rain.`
                  : summary.overallNeed === "moderate"
                  ? `Soil moisture is declining. Apply supplemental irrigation to water-sensitive crops. Current ET₀: ${summary.avgET.toFixed(1)} mm/day.`
                  : summary.avgSoilMoisture > 45
                  ? `Soil is well-hydrated (${Math.round(summary.avgSoilMoisture)}%). Ensure good drainage. Focus on pest monitoring rather than watering.`
                  : `Conditions are balanced. Rain is meeting most crop needs. Monitor soil moisture daily for changes.`}
              </p>
            </div>

            {/* ET explanation card */}
            <div className="bg-card rounded-xl p-4 shadow-sm border border-border/40">
              <h3 className="font-bold text-sm mb-2 flex items-center gap-2">
                <TrendingDown className="h-4 w-4 text-blue-500" /> How It Works
              </h3>
              <ul className="space-y-1.5 text-[11px] text-muted-foreground">
                <li><strong>ET₀</strong> = Reference evapotranspiration (water lost to air)</li>
                <li><strong>Kc</strong> = Crop coefficient (water need multiplier per crop)</li>
                <li><strong>Crop ET</strong> = ET₀ × Kc (actual crop water demand)</li>
                <li><strong>Irrigation Need</strong> = Crop ET − Effective Rain</li>
                <li><strong>Soil Moisture</strong> = Live volumetric reading (top 10 cm)</li>
              </ul>
            </div>
          </div>
        </div>
      ) : (
        <div className="text-center py-20 text-muted-foreground">
          <Cloud className="h-12 w-12 mx-auto mb-3 opacity-50" />
          <p>Unable to load weather data. Please try again.</p>
          <button onClick={refresh} className="mt-3 text-sm underline">
            Retry
          </button>
        </div>
      )}
    </div>
  );
}
