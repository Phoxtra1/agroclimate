import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { WeatherDay } from "@/data/mock-data";

const CACHE_KEY = "agroclimate_weather_cache";
const CACHE_DURATION = 15 * 60 * 1000;

interface CachedWeather {
  data: WeatherDay[];
  timestamp: number;
  observedAt?: string | null;
  lat: number;
  lon: number;
}

const weatherCodeMap: Record<number, string> = {
  1000: "☀️", 1100: "⛅", 1101: "⛅", 1102: "☁️",
  1001: "☁️", 2000: "🌫️", 2100: "🌫️",
  4000: "🌧️", 4001: "🌧️", 4200: "🌧️", 4201: "🌧️",
  5000: "❄️", 5001: "❄️", 5100: "❄️", 5101: "❄️",
  6000: "🌧️", 6001: "🌧️", 6200: "🌧️", 6201: "🌧️",
  7000: "❄️", 7101: "❄️", 7102: "❄️",
  8000: "⛈️",
};

const weatherCodeDesc: Record<number, string> = {
  1000: "Clear, Sunny", 1100: "Mostly Clear", 1101: "Partly Cloudy", 1102: "Mostly Cloudy",
  1001: "Cloudy", 2000: "Fog", 2100: "Light Fog",
  4000: "Drizzle", 4001: "Rain", 4200: "Light Rain", 4201: "Heavy Rain",
  5000: "Snow", 5001: "Flurries", 5100: "Light Snow", 5101: "Heavy Snow",
  6000: "Freezing Drizzle", 6001: "Freezing Rain", 6200: "Light Freezing Rain", 6201: "Heavy Freezing Rain",
  7000: "Ice Pellets", 7101: "Heavy Ice Pellets", 7102: "Light Ice Pellets",
  8000: "Thunderstorm",
};

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);

export function isValidWeatherCoordinates(lat: unknown, lon: unknown): lat is number {
  return isFiniteNumber(lat) && isFiniteNumber(lon) &&
    lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180;
}

function readLocationCache(lat: number, lon: number): CachedWeather | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachedWeather;
    const sameArea = isValidWeatherCoordinates(parsed.lat, parsed.lon) &&
      Math.abs(parsed.lat - lat) < 0.1 && Math.abs(parsed.lon - lon) < 0.1;
    const validData = Array.isArray(parsed.data) && parsed.data.length > 0 &&
      parsed.data.every((day) => isFiniteNumber(day?.tempHigh) && isFiniteNumber(day?.tempLow));
    if (!sameArea || !validData || !isFiniteNumber(parsed.timestamp) || parsed.timestamp <= 0) return null;
    return parsed;
  } catch {
    return null;
  }
}

// This is a weather-derived estimate, not a soil/weather-station measurement.
export function getDeterministicAgroMetrics(
  tempHigh: number,
  humidity: number,
  windSpeedMps: number,
  rainProbability: number,
  rawRainMm?: number,
) {
  const rainMm = isFiniteNumber(rawRainMm)
    ? Math.round(rawRainMm * 10) / 10
    : (rainProbability > 40 ? Math.round((rainProbability / 10) * 1.5 * 10) / 10 : 0);

  const evapotranspiration = Math.round(
    Math.max(1.5, Math.min(8.5, (tempHigh * 0.15) + (windSpeedMps * 0.05) - (humidity * 0.03) + 2.0)) * 100,
  ) / 100;
  const soilMoisture = Math.round(Math.max(10, Math.min(95, 45 + (rainProbability * 0.4) - (tempHigh * 0.5))));
  const soilTemperature = Math.round(tempHigh - 2 + (humidity > 70 ? -1 : 1));
  return { rainMm, evapotranspiration, soilMoisture, soilTemperature };
}

export function isUsableDailyForecast(daily: any): boolean {
  const values = daily?.values || {};
  const hasHigh = isFiniteNumber(values.temperatureMax) || isFiniteNumber(values.temperature);
  const hasLow = isFiniteNumber(values.temperatureMin) || isFiniteNumber(values.temperature);
  return typeof daily?.time === "string" && Number.isFinite(Date.parse(daily.time)) && hasHigh && hasLow;
}

export function mapTomorrowToWeatherDay(daily: any, index: number): WeatherDay {
  if (!isUsableDailyForecast(daily)) throw new Error("Tomorrow.io returned an incomplete daily forecast.");
  const date = new Date(daily.time);
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const values = daily.values || {};
  const code = isFiniteNumber(values.weatherCodeMax) ? values.weatherCodeMax : 0;

  const tempHigh = Math.round(values.temperatureMax ?? values.temperature);
  const tempLow = Math.round(values.temperatureMin ?? values.temperature);
  const humidity = Math.round(isFiniteNumber(values.humidityMax) ? values.humidityMax : isFiniteNumber(values.humidityAvg) ? values.humidityAvg : 60);
  const windSpeedMps = isFiniteNumber(values.windSpeedMax) ? values.windSpeedMax : isFiniteNumber(values.windSpeedAvg) ? values.windSpeedAvg : 0;
  const windKmh = Math.round(windSpeedMps * 3.6);
  const rainProb = Math.round(isFiniteNumber(values.precipitationProbabilityMax) ? values.precipitationProbabilityMax : isFiniteNumber(values.precipitationProbabilityAvg) ? values.precipitationProbabilityAvg : 0);
  const rawRain = isFiniteNumber(values.rainAccumulationSum) ? values.rainAccumulationSum : undefined;
  const agro = getDeterministicAgroMetrics(tempHigh, humidity, windSpeedMps, rainProb, rawRain);

  const providerEt = isFiniteNumber(values.evapotranspiration) ? values.evapotranspiration : undefined;
  const providerSoilMoisture = isFiniteNumber(values.soilMoistureVolumetric0To10)
    ? values.soilMoistureVolumetric0To10 : undefined;
  const providerSoilTemperature = isFiniteNumber(values.soilTemperature0To10)
    ? values.soilTemperature0To10 : undefined;

  return {
    isoDate: daily.time,
    day: index === 0 ? "Today" : days[date.getDay()],
    date: `${months[date.getMonth()]} ${date.getDate()}`,
    icon: weatherCodeMap[code] || "☁️",
    tempHigh,
    tempLow,
    rainProb,
    description: weatherCodeDesc[code] || "Conditions unavailable",
    humidity,
    wind: windKmh,
    weatherCode: code,
    rainMm: rawRain !== undefined ? Math.round(rawRain * 10) / 10 : agro.rainMm,
    rainSource: rawRain !== undefined ? "provider" : "estimated",
    evapotranspiration: providerEt !== undefined ? Math.round(providerEt * 100) / 100 : agro.evapotranspiration,
    evapotranspirationSource: providerEt !== undefined ? "provider" : "estimated",
    soilMoisture: providerSoilMoisture !== undefined ? Math.round(providerSoilMoisture * 100) : agro.soilMoisture,
    soilTemperature: providerSoilTemperature !== undefined ? Math.round(providerSoilTemperature) : agro.soilTemperature,
    soilMoistureSource: providerSoilMoisture !== undefined ? "provider" : "estimated",
    soilTemperatureSource: providerSoilTemperature !== undefined ? "provider" : "estimated",
  };
}

export function mapRealtimeToWeatherDay(realtime: any): WeatherDay | null {
  const values = realtime?.data?.values || {};
  if (!isFiniteNumber(values.temperature)) return null;
  const code = isFiniteNumber(values.weatherCode) ? values.weatherCode : 0;
  const now = new Date();
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const tempHigh = Math.round(values.temperature);
  const tempLow = Math.round(values.temperature - 4);
  const humidity = Math.round(isFiniteNumber(values.humidity) ? values.humidity : 60);
  const windSpeedMps = isFiniteNumber(values.windSpeed) ? values.windSpeed : 0;
  const windKmh = Math.round(windSpeedMps * 3.6);
  const rainProbability = Math.round(isFiniteNumber(values.precipitationProbability) ? values.precipitationProbability : 0);
  const rawRain = isFiniteNumber(values.rainAccumulation) ? values.rainAccumulation : undefined;
  const agro = getDeterministicAgroMetrics(tempHigh, humidity, windSpeedMps, rainProbability, rawRain);

  return {
    isoDate: typeof realtime?.data?.time === "string" ? realtime.data.time : now.toISOString(),
    day: "Today",
    date: `${months[now.getMonth()]} ${now.getDate()}`,
    icon: weatherCodeMap[code] || "☁️",
    tempHigh,
    tempLow,
    rainProb: rainProbability,
    description: weatherCodeDesc[code] || "Conditions unavailable",
    humidity,
    wind: windKmh,
    weatherCode: code,
    rainMm: rawRain !== undefined ? Math.round(rawRain * 10) / 10 : agro.rainMm,
    rainSource: rawRain !== undefined ? "provider" : "estimated",
    evapotranspiration: agro.evapotranspiration,
    evapotranspirationSource: "estimated",
    soilMoisture: agro.soilMoisture,
    soilTemperature: agro.soilTemperature,
    soilMoistureSource: "estimated",
    soilTemperatureSource: "estimated",
  };
}

export function useWeather(lat?: number, lon?: number) {
  const [forecast, setForecast] = useState<WeatherDay[]>(() => {
    if (!isValidWeatherCoordinates(lat, lon)) return [];
    return readLocationCache(lat, lon)?.data || [];
  });
  const [loading, setLoading] = useState(false);
  const [isLive, setIsLive] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [observedAt, setObservedAt] = useState<Date | null>(null);
  const [source, setSource] = useState<"live" | "cache" | "none">("none");
  const [error, setError] = useState("");

  const refresh = useCallback(() => {
    setSource("none");
    setIsLive(false);
    setRefreshTrigger((previous) => previous + 1);
  }, []);

  useEffect(() => {
    if (!isValidWeatherCoordinates(lat, lon)) return;
    const latitude = lat;
    const longitude = lon;
    let active = true;
    let latestRequest = 0;

    const cached = readLocationCache(latitude, longitude);
    let fallbackCache = cached;
    let nextFetchAt = 0;
    let inFlight = false;
    setLoading(false);
    if (cached) {
      setForecast(cached.data);
      setIsLive(false);
      setLastUpdated(new Date(cached.timestamp));
      setObservedAt(cached.observedAt ? new Date(cached.observedAt) : null);
      setSource("cache");
    } else {
      setForecast([]);
      setIsLive(false);
      setLastUpdated(null);
      setObservedAt(null);
      setSource("none");
    }

    const fetchWeather = async () => {
      if (inFlight || Date.now() < nextFetchAt) return;
      inFlight = true;
      const requestId = ++latestRequest;
      setLoading(true);
      try {
        const { data, error } = await supabase.functions.invoke("weather", {
          body: { lat: latitude, lon: longitude },
        });
        if (error) throw new Error(error.message || "Weather provider request failed");
        if (data?.error) throw new Error(data.error);
        nextFetchAt = Math.max(Date.now() + CACHE_DURATION, Date.parse(data?.retryAt || "") || 0);
        if (data?.status === "unavailable") throw new Error(data.message || "Weather temporarily unavailable.");

        const dailyTimelines = Array.isArray(data?.forecast?.timelines?.daily)
          ? data.forecast.timelines.daily
          : [];
        const forecastDays = dailyTimelines
          .filter(isUsableDailyForecast)
          .slice(0, 7)
          .map(mapTomorrowToWeatherDay);

        const realtimeDay = mapRealtimeToWeatherDay(data?.realtime);
        if (realtimeDay) {
          const existingToday = forecastDays[0];
          if (existingToday) {
            realtimeDay.tempLow = existingToday.tempLow;
            realtimeDay.tempHigh = Math.max(existingToday.tempHigh, realtimeDay.tempHigh);
            forecastDays[0] = realtimeDay;
          } else {
            forecastDays.unshift(realtimeDay);
          }
        }
        if (forecastDays.length === 0) throw new Error("Weather provider returned no usable weather data.");

        if (!active || requestId !== latestRequest) return;
        const timestamp = Date.parse(data?.fetchedAt || "") || Date.now();
        const observed = data?.realtime?.data?.time ?? null;
        setForecast(forecastDays);
        setIsLive(data?.status !== "cached");
        setError(data?.message || "");
        setLastUpdated(new Date(timestamp));
        setObservedAt(typeof observed === "string" ? new Date(observed) : null);
        setSource(data?.status === "cached" ? "cache" : "live");
        fallbackCache = { data: forecastDays, timestamp, observedAt: observed, lat: latitude, lon: longitude };
        try {
          localStorage.setItem(CACHE_KEY, JSON.stringify({
            data: forecastDays, timestamp, observedAt: observed, lat: latitude, lon: longitude,
          } satisfies CachedWeather));
        } catch { /* cache is optional; live data remains usable */ }
      } catch (error) {
        if (!active || requestId !== latestRequest) return;
        console.warn("AgroForecast provider request failed", error);
        setError(error instanceof Error ? error.message : "Weather temporarily unavailable.");
        nextFetchAt = Math.max(nextFetchAt, Date.now() + 60000);
        setForecast(fallbackCache?.data || []);
        setIsLive(false);
        setLastUpdated(fallbackCache ? new Date(fallbackCache.timestamp) : null);
        setObservedAt(fallbackCache?.observedAt ? new Date(fallbackCache.observedAt) : null);
        setSource(fallbackCache ? "cache" : "none");
      } finally {
        inFlight = false;
        if (active && requestId === latestRequest) setLoading(false);
      }
    };

    const cacheIsFresh = cached && Date.now() - cached.timestamp < CACHE_DURATION;
    if (!cacheIsFresh || refreshTrigger > 0) void fetchWeather();

    const interval = window.setInterval(() => { void fetchWeather(); }, 10 * 60 * 1000);
    const onWake = () => { if (document.visibilityState === "visible") void fetchWeather(); };
    window.addEventListener("focus", onWake);
    window.addEventListener("online", onWake);
    document.addEventListener("visibilitychange", onWake);

    return () => {
      active = false;
      latestRequest += 1;
      window.clearInterval(interval);
      window.removeEventListener("focus", onWake);
      window.removeEventListener("online", onWake);
      document.removeEventListener("visibilitychange", onWake);
    };
  }, [lat, lon, refreshTrigger]);

  return { forecast, loading, isLive, lastUpdated, observedAt, source, refresh, error };
}
