import { useState, useCallback, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface WeatherDataPoint {
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
  soilMoisture?: number;
}

/** Cache key for localStorage */
const LS_WEATHER_CACHE = "agri_weather_cache";
const LS_WEATHER_TIMESTAMP = "agri_weather_ts";

/** Refresh interval: 15 minutes */
const REFRESH_MS = 10 * 60 * 1000;

/** Cache validity: 1 hour (fallback if API fails) */
const CACHE_MAX_AGE_MS = 60 * 60 * 1000;

function loadCache(): WeatherDataPoint[] | null {
  try {
    const ts = localStorage.getItem(LS_WEATHER_TIMESTAMP);
    const data = localStorage.getItem(LS_WEATHER_CACHE);
    if (ts && data && Date.now() - parseInt(ts, 10) < CACHE_MAX_AGE_MS) {
      return JSON.parse(data);
    }
  } catch { /* ignore */ }
  return null;
}

function saveCache(forecast: WeatherDataPoint[]) {
  try {
    localStorage.setItem(LS_WEATHER_CACHE, JSON.stringify(forecast));
    localStorage.setItem(LS_WEATHER_TIMESTAMP, String(Date.now()));
  } catch { /* ignore */ }
}

export function useWeather(lat?: number, lon?: number) {
  const [forecast, setForecast] = useState<WeatherDataPoint[]>(() => loadCache() ?? []);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchForecast = useCallback(async () => {
    if (!lat || !lon) return;

    setLoading(true);
    setError(null);

    try {
      const { data, error: fnError } = await supabase.functions.invoke(
        "weather-proxy",
        { body: { lat, lon } }
      );

      if (fnError) throw new Error(fnError.message);
      if (!data?.forecast?.length) throw new Error("No forecast data returned");

      const weatherData: WeatherDataPoint[] = data.forecast;
      setForecast(weatherData);
      saveCache(weatherData);
    } catch (err: any) {
      console.error("Weather fetch failed:", err);
      setError(err.message ?? "Failed to fetch weather");

      // Fall back to cache if available
      const cached = loadCache();
      if (cached && cached.length > 0) {
        setForecast(cached);
      }
    } finally {
      setLoading(false);
    }
  }, [lat, lon]);

  // Fetch on mount and every 15 minutes
  useEffect(() => {
    fetchForecast();
    intervalRef.current = setInterval(fetchForecast, REFRESH_MS);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [fetchForecast]);

  const refresh = useCallback(() => {
    fetchForecast();
  }, [fetchForecast]);

  return { forecast, loading, error, refresh };
}
