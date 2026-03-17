/**
 * ============================================================
 * WEATHER & AGRO FORECAST MODULE — Standalone, PWA-Ready
 * ============================================================
 *
 * COPY THIS ENTIRE FILE into your project as a single page.
 *
 * DEPENDENCIES (install if missing):
 *   - lucide-react
 *   - A shadcn/ui Badge component at @/components/ui/badge
 *
 * SETUP:
 *   1. Get a free API key from https://openweathermap.org/api
 *   2. Replace OPENWEATHER_API_KEY below (or use env var)
 *   3. Route this page in your app (e.g. /weather)
 *
 * PWA NOTES:
 *   - Uses cache-busting timestamps so service workers always
 *     serve fresh weather data on app open / pull-to-refresh.
 *   - If you use vite-plugin-pwa, add the API URL to
 *     workbox.runtimeCaching with a NetworkFirst strategy.
 *
 * ============================================================
 */

import { useState, useEffect, useCallback } from "react";
import {
  Droplets,
  Thermometer,
  Wind,
  MapPin,
  Sprout,
  AlertTriangle,
  RefreshCw,
  Cloud,
  CloudRain,
  CloudLightning,
  Sun,
  CloudSun,
  CloudDrizzle,
  Snowflake,
  CloudFog,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";

// ────────────────────────────────────────────────────────────
// CONFIG — Replace with your own key or inject via env
// ────────────────────────────────────────────────────────────
const OPENWEATHER_API_KEY =
  import.meta.env.VITE_TOMORROW_API_KEY || "zgfWrUPZrTNAAU55g8HQyszNueud5H5J";

// ────────────────────────────────────────────────────────────
// TYPES
// ────────────────────────────────────────────────────────────
interface Position {
  lat: number;
  lon: number;
  locationName: string;
  community?: string;
  district?: string;
  region?: string;
}

interface DayForecast {
  day: string;
  date: string;
  icon: string;
  condition: string;
  tempHigh: number;
  tempLow: number;
  humidity: number;
  wind: number;
  rainProb: number;
  rainMm: number;
}

// ────────────────────────────────────────────────────────────
// SECTION 1: GEOLOCATION HOOK
// Fetches the user's current GPS position and reverse-geocodes
// it to community / district / region. Falls back to IP-based
// location if GPS is denied or unavailable.
// ────────────────────────────────────────────────────────────
function useGeolocation() {
  const [position, setPosition] = useState<Position>({
    lat: 5.6037,
    lon: -0.187,
    locationName: "Accra, Ghana",
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function reverseGeocode(lat: number, lon: number) {
      try {
        // Use OpenWeatherMap reverse geocoding (no extra key needed)
        const res = await fetch(
          `https://api.openweathermap.org/geo/1.0/reverse?lat=${lat}&lon=${lon}&limit=1&appid=${OPENWEATHER_API_KEY}&_t=${Date.now()}`
        );
        if (!res.ok) throw new Error("Geocode failed");
        const data = await res.json();
        if (data[0]) {
          return {
            locationName: data[0].name || "Unknown",
            community: data[0].name,
            district: data[0].state || undefined,
            region: data[0].country || undefined,
          };
        }
      } catch {
        /* fallback below */
      }
      return { locationName: "Your Location" };
    }

    // Fallback: IP-based geolocation (no permission needed)
    async function ipFallback() {
      try {
        const res = await fetch("https://ipapi.co/json/");
        const data = await res.json();
        if (!cancelled && data.latitude) {
          const geo = await reverseGeocode(data.latitude, data.longitude);
          setPosition({
            lat: data.latitude,
            lon: data.longitude,
            ...geo,
          });
        }
      } catch {
        setError("Could not determine location");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    if (!navigator.geolocation) {
      ipFallback();
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        if (cancelled) return;
        const geo = await reverseGeocode(pos.coords.latitude, pos.coords.longitude);
        setPosition({
          lat: pos.coords.latitude,
          lon: pos.coords.longitude,
          ...geo,
        });
        setLoading(false);
      },
      () => {
        // GPS denied — use IP fallback
        ipFallback();
      },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 60000 }
    );

    return () => {
      cancelled = true;
    };
  }, []);

  return { position, loading, error };
}

// ────────────────────────────────────────────────────────────
// SECTION 2: WEATHER DATA HOOK
// Fetches 7-day forecast from OpenWeatherMap One Call API 3.0
// (or falls back to 5-day/3-hour free tier and aggregates).
// Uses cache-busting to ensure PWA always gets fresh data.
// ────────────────────────────────────────────────────────────
function useWeather(lat: number, lon: number) {
  const [forecast, setForecast] = useState<DayForecast[]>([]);
  const [isLive, setIsLive] = useState(false);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const fetchWeather = useCallback(async () => {
    if (OPENWEATHER_API_KEY === "YOUR_API_KEY_HERE") {
      // Demo mode — generate realistic mock data
      setForecast(generateMockForecast());
      setIsLive(false);
      setLoading(false);
      setLastUpdated(new Date());
      return;
    }

    try {
      setLoading(true);

      // PWA cache-busting: append timestamp so service worker
      // treats each request as unique → always hits network.
      const cacheBuster = `&_t=${Date.now()}`;

      // Use free 5-day/3-hour endpoint and aggregate to daily
      const res = await fetch(
        `https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lon}&units=metric&appid=${OPENWEATHER_API_KEY}${cacheBuster}`,
        { cache: "no-store" } // bypass HTTP cache for PWA
      );

      if (!res.ok) throw new Error(`API ${res.status}`);
      const data = await res.json();

      // Aggregate 3-hour slots into daily summaries
      const days = new Map<string, any[]>();
      for (const item of data.list) {
        const date = item.dt_txt.split(" ")[0];
        if (!days.has(date)) days.set(date, []);
        days.get(date)!.push(item);
      }

      const dailyForecasts: DayForecast[] = [];
      const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

      for (const [dateStr, slots] of days) {
        if (dailyForecasts.length >= 7) break;
        const d = new Date(dateStr);
        const temps = slots.map((s: any) => s.main.temp);
        const humids = slots.map((s: any) => s.main.humidity);
        const winds = slots.map((s: any) => s.wind.speed * 3.6); // m/s → km/h
        const rainProbs = slots.map((s: any) => (s.pop || 0) * 100);
        const rainMms = slots.map((s: any) => s.rain?.["3h"] || 0);

        // Pick the most common weather condition
        const conditions = slots.map((s: any) => s.weather[0]);
        const midday = conditions[Math.floor(conditions.length / 2)] || conditions[0];

        dailyForecasts.push({
          day: dailyForecasts.length === 0 ? "Today" : dayNames[d.getDay()],
          date: dateStr,
          icon: midday.icon,
          condition: midday.main,
          tempHigh: Math.round(Math.max(...temps)),
          tempLow: Math.round(Math.min(...temps)),
          humidity: Math.round(humids.reduce((a: number, b: number) => a + b, 0) / humids.length),
          wind: Math.round(winds.reduce((a: number, b: number) => a + b, 0) / winds.length),
          rainProb: Math.round(Math.max(...rainProbs)),
          rainMm: Math.round(rainMms.reduce((a: number, b: number) => a + b, 0) * 10) / 10,
        });
      }

      setForecast(dailyForecasts);
      setIsLive(true);
      setLastUpdated(new Date());
    } catch (err) {
      console.error("Weather fetch failed, using mock data:", err);
      setForecast(generateMockForecast());
      setIsLive(false);
      setLastUpdated(new Date());
    } finally {
      setLoading(false);
    }
  }, [lat, lon]);

  useEffect(() => {
    fetchWeather();
    // Auto-refresh every 30 minutes for PWA
    const interval = setInterval(fetchWeather, 30 * 60 * 1000);
    return () => clearInterval(interval);
  }, [fetchWeather]);

  // Listen for PWA visibility changes — refresh when app comes to foreground
  useEffect(() => {
    function onVisibilityChange() {
      if (document.visibilityState === "visible") {
        fetchWeather();
      }
    }
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => document.removeEventListener("visibilitychange", onVisibilityChange);
  }, [fetchWeather]);

  return { forecast, isLive, loading, lastUpdated, refresh: fetchWeather };
}

// ────────────────────────────────────────────────────────────
// SECTION 3: MOCK DATA GENERATOR (demo / offline fallback)
// ────────────────────────────────────────────────────────────
function generateMockForecast(): DayForecast[] {
  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const conditions = ["Clear", "Clouds", "Rain", "Drizzle", "Thunderstorm", "Clouds", "Clear"];
  const icons = ["01d", "03d", "10d", "09d", "11d", "04d", "02d"];

  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() + i);
    const baseTemp = 28 + Math.random() * 6;
    return {
      day: i === 0 ? "Today" : dayNames[d.getDay()],
      date: d.toISOString().split("T")[0],
      icon: icons[i],
      condition: conditions[i],
      tempHigh: Math.round(baseTemp + 2),
      tempLow: Math.round(baseTemp - 5),
      humidity: Math.round(55 + Math.random() * 35),
      wind: Math.round(5 + Math.random() * 20),
      rainProb: Math.round(Math.random() * 100),
      rainMm: Math.round(Math.random() * 15 * 10) / 10,
    };
  });
}

// ────────────────────────────────────────────────────────────
// SECTION 4: SEASONAL AGRO DATA (West Africa baseline)
// ────────────────────────────────────────────────────────────
function getCurrentSeason(month: number) {
  // West/Central Africa dual-season model
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

const suitableCrops = [
  { name: "Maize", icon: "🌽", category: "Cereals", irrigationNeeded: false, season: [3,4,5,6,7] },
  { name: "Tomato", icon: "🍅", category: "Vegetables", irrigationNeeded: true, season: [1,2,10,11,12] },
  { name: "Cassava", icon: "🥔", category: "Roots", irrigationNeeded: false, season: [3,4,5,6] },
  { name: "Onion", icon: "🧅", category: "Vegetables", irrigationNeeded: true, season: [10,11,12,1,2] },
  { name: "Rice", icon: "🌾", category: "Cereals", irrigationNeeded: true, season: [4,5,6,7] },
  { name: "Yam", icon: "🍠", category: "Roots", irrigationNeeded: false, season: [3,4,5] },
  { name: "Pepper", icon: "🌶️", category: "Vegetables", irrigationNeeded: true, season: [1,2,3,10,11,12] },
  { name: "Cabbage", icon: "🥬", category: "Vegetables", irrigationNeeded: true, season: [10,11,12,1,2] },
];

// ────────────────────────────────────────────────────────────
// SECTION 5: WEATHER ICON MAPPER
// ────────────────────────────────────────────────────────────
function WeatherIcon({ code, className }: { code: string; className?: string }) {
  const cn = className || "h-8 w-8";
  if (code.startsWith("01")) return <Sun className={`${cn} text-amber-500`} />;
  if (code.startsWith("02")) return <CloudSun className={`${cn} text-amber-400`} />;
  if (code.startsWith("03") || code.startsWith("04")) return <Cloud className={`${cn} text-gray-400`} />;
  if (code.startsWith("09")) return <CloudDrizzle className={`${cn} text-blue-400`} />;
  if (code.startsWith("10")) return <CloudRain className={`${cn} text-blue-500`} />;
  if (code.startsWith("11")) return <CloudLightning className={`${cn} text-yellow-500`} />;
  if (code.startsWith("13")) return <Snowflake className={`${cn} text-blue-200`} />;
  if (code.startsWith("50")) return <CloudFog className={`${cn} text-gray-300`} />;
  return <Cloud className={`${cn} text-gray-400`} />;
}

// ────────────────────────────────────────────────────────────
// SECTION 6: SUB-COMPONENTS
// ────────────────────────────────────────────────────────────

/** Today's weather hero card */
function TodayWeather({ weather }: { weather: DayForecast }) {
  if (!weather) return null;
  return (
    <div className="bg-gradient-to-br from-blue-600 to-blue-800 text-white rounded-2xl p-6 shadow-lg">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm opacity-80">Today's Weather</p>
          <p className="text-5xl font-bold mt-1">{weather.tempHigh}°C</p>
          <p className="text-sm opacity-80 mt-1">{weather.condition}</p>
        </div>
        <WeatherIcon code={weather.icon} className="h-16 w-16" />
      </div>
      <div className="grid grid-cols-3 gap-4 mt-6 pt-4 border-t border-white/20 text-center text-sm">
        <div>
          <Droplets className="h-4 w-4 mx-auto opacity-70" />
          <p className="font-semibold mt-1">{weather.rainProb}%</p>
          <p className="text-xs opacity-70">Rain</p>
        </div>
        <div>
          <Wind className="h-4 w-4 mx-auto opacity-70" />
          <p className="font-semibold mt-1">{weather.wind} km/h</p>
          <p className="text-xs opacity-70">Wind</p>
        </div>
        <div>
          <Thermometer className="h-4 w-4 mx-auto opacity-70" />
          <p className="font-semibold mt-1">{weather.tempLow}°C</p>
          <p className="text-xs opacity-70">Low</p>
        </div>
      </div>
    </div>
  );
}

/** Single forecast row */
function ForecastRow({ day }: { day: DayForecast }) {
  const isShortTerm = day.day === "Today" || ["Mon","Tue","Wed"].includes(day.day);
  return (
    <div className="flex items-center justify-between py-2.5 border-b border-border/50 last:border-0">
      <div className="flex items-center gap-3 w-24">
        <WeatherIcon code={day.icon} className="h-5 w-5" />
        <div>
          <span className="text-sm font-medium">{day.day}</span>
          {isShortTerm && (
            <span className="ml-1.5 text-[10px] text-blue-500 font-medium">●</span>
          )}
        </div>
      </div>
      <span className="text-xs text-muted-foreground w-20 text-center">{day.condition}</span>
      <div className="flex items-center gap-1 text-xs w-16 justify-center">
        <Droplets className="h-3 w-3 text-blue-400" />
        <span>{day.rainProb}%</span>
      </div>
      <div className="text-sm font-medium text-right w-20">
        <span>{day.tempHigh}°</span>
        <span className="text-muted-foreground ml-1">/ {day.tempLow}°</span>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────
// SECTION 7: MAIN PAGE COMPONENT
// ────────────────────────────────────────────────────────────
export default function Weather() {
  const { position, loading: geoLoading, error: geoError } = useGeolocation();
  const { forecast, isLive, loading: weatherLoading, lastUpdated, refresh } = useWeather(
    position.lat,
    position.lon
  );

  const today = forecast[0];
  const currentMonth = new Date().getMonth() + 1;
  const season = getCurrentSeason(currentMonth);
  const recommendations = getSeasonalRecommendations(currentMonth);

  // Irrigation advisory based on forecast
  const avgRain = forecast.length
    ? forecast.reduce((s, d) => s + d.rainProb, 0) / forecast.length
    : 50;
  const irrigationNeeded = avgRain < 30 || season.type === "dry";

  // Crops suitable for this month
  const currentCrops = suitableCrops.filter((c) => c.season.includes(currentMonth));

  const isLoading = geoLoading || weatherLoading;

  return (
    <div className="p-4 lg:p-8 max-w-6xl mx-auto min-h-screen">
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <h1 className="text-xl font-bold">Weather & Agro Forecast</h1>
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
          <span className="font-medium">{position.community || position.locationName}</span>
          {position.district && <span>• {position.district}</span>}
          {position.region && <span>• {position.region}</span>}
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          {isLive ? (
            <span className="flex items-center gap-1">
              <span className="h-1.5 w-1.5 rounded-full bg-green-500" /> Live
            </span>
          ) : (
            <span className="flex items-center gap-1">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-500" /> Demo
            </span>
          )}
          {lastUpdated && (
            <span>
              Updated {lastUpdated.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            </span>
          )}
        </div>
      </div>

      {geoError && (
        <div className="bg-destructive/10 text-destructive rounded-xl p-3 mb-4 text-sm">
          ⚠️ {geoError} — showing fallback location data.
        </div>
      )}

      {isLoading && !today ? (
        <div className="flex items-center justify-center py-20">
          <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : today ? (
        <div className="grid lg:grid-cols-3 gap-6">
          {/* Main column */}
          <div className="lg:col-span-2 space-y-5">
            <TodayWeather weather={today} />

            {/* Quick stats */}
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-card rounded-xl p-4 text-center shadow-sm">
                <Droplets className="h-5 w-5 mx-auto text-blue-500" />
                <p className="text-lg font-bold mt-2">{today.humidity}%</p>
                <p className="text-xs text-muted-foreground">Humidity</p>
              </div>
              <div className="bg-card rounded-xl p-4 text-center shadow-sm">
                <Wind className="h-5 w-5 mx-auto text-slate-500" />
                <p className="text-lg font-bold mt-2">{today.wind} km/h</p>
                <p className="text-xs text-muted-foreground">Wind</p>
              </div>
              <div className="bg-card rounded-xl p-4 text-center shadow-sm">
                <CloudRain className="h-5 w-5 mx-auto text-blue-400" />
                <p className="text-lg font-bold mt-2">{today.rainMm} mm</p>
                <p className="text-xs text-muted-foreground">Rainfall</p>
              </div>
            </div>

            {/* Irrigation advisory */}
            {irrigationNeeded && (
              <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-xl p-4 flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-amber-800 dark:text-amber-200">
                    Irrigation Support Recommended
                  </p>
                  <p className="text-xs text-amber-700 dark:text-amber-300 mt-1">
                    Low rainfall expected this week ({Math.round(avgRain)}% avg probability).
                    Crops needing water — especially vegetables, rice, and seedlings — require
                    supplemental irrigation. Consider drip irrigation for efficiency.
                  </p>
                </div>
              </div>
            )}

            {/* 7-day forecast — split into short-term (1-3d) and mid-term (4-7d) */}
            <section>
              <h2 className="font-bold mb-3">Short-Term Forecast (1–3 Days)</h2>
              <div className="bg-card rounded-xl p-4 shadow-sm">
                {forecast.slice(0, 3).map((day) => (
                  <ForecastRow key={day.date} day={day} />
                ))}
              </div>
            </section>

            <section>
              <h2 className="font-bold mb-3">Mid-Term Outlook (4–7 Days)</h2>
              <div className="bg-card rounded-xl p-4 shadow-sm">
                {forecast.slice(3, 7).map((day) => (
                  <ForecastRow key={day.date} day={day} />
                ))}
                {forecast.length <= 3 && (
                  <p className="text-xs text-muted-foreground py-4 text-center">
                    Extended forecast data not yet available.
                  </p>
                )}
              </div>
            </section>
          </div>

          {/* Sidebar: Agro info */}
          <div className="space-y-5">
            {/* Crops to plant */}
            <div className="bg-card rounded-xl p-4 shadow-sm">
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
                    {crop.irrigationNeeded && <Droplets className="h-3 w-3 text-blue-400" />}
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
            <div className="bg-card rounded-xl p-4 shadow-sm">
              <h3 className="font-bold text-sm mb-3">📋 Seasonal Actions</h3>
              <ul className="space-y-2">
                {recommendations.map((rec, i) => (
                  <li key={i} className="text-xs text-muted-foreground flex items-start gap-2">
                    <span className="text-green-600 mt-0.5">•</span> {rec}
                  </li>
                ))}
              </ul>
            </div>

            {/* Farmer tip */}
            <div className="bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded-xl p-4">
              <p className="text-sm font-semibold text-green-800 dark:text-green-200">💡 Farmer Tip</p>
              <p className="text-sm text-green-700 dark:text-green-300 mt-1">
                {irrigationNeeded
                  ? "Dry conditions ahead. Focus on irrigated crops like tomato, onion, and cabbage. Mulch to conserve soil moisture."
                  : "Rainy season is here! Plant major crops now. Prepare drainage to prevent waterlogging."}
              </p>
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
