import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { WeatherDay, weeklyForecast as mockForecast } from "@/data/mock-data";

const CACHE_KEY = "agroclimate_weather_cache";
const CACHE_DURATION = 30 * 60 * 1000; // 30 minutes

interface CachedWeather {
  data: WeatherDay[];
  timestamp: number;
}

function mapOwmToWeatherDay(item: any, index: number): WeatherDay {
  const date = new Date(item.dt * 1000);
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const iconMap: Record<string, string> = {
    "01": "☀️", "02": "⛅", "03": "☁️", "04": "☁️",
    "09": "🌧️", "10": "🌧️", "11": "⛈️", "13": "❄️", "50": "🌫️",
  };
  const owmIcon = item.weather?.[0]?.icon?.slice(0, 2) || "01";

  return {
    day: index === 0 ? "Today" : days[date.getDay()],
    date: `${months[date.getMonth()]} ${date.getDate()}`,
    icon: iconMap[owmIcon] || "☀️",
    tempHigh: Math.round(item.main?.temp_max ?? item.main?.temp ?? 30),
    tempLow: Math.round(item.main?.temp_min ?? (item.main?.temp ?? 25) - 5),
    rainProb: Math.round((item.pop ?? 0) * 100),
    description: item.weather?.[0]?.description ?? "Clear",
    humidity: item.main?.humidity ?? 60,
    wind: Math.round(item.wind?.speed ?? 5),
  };
}

export function useWeather(lat = 6.69, lon = -1.62) {
  const [forecast, setForecast] = useState<WeatherDay[]>(mockForecast);
  const [loading, setLoading] = useState(false);
  const [isLive, setIsLive] = useState(false);

  useEffect(() => {
    // Try cache first
    const cached = localStorage.getItem(CACHE_KEY);
    if (cached) {
      const parsed: CachedWeather = JSON.parse(cached);
      if (Date.now() - parsed.timestamp < CACHE_DURATION) {
        setForecast(parsed.data);
        setIsLive(true);
        return;
      }
    }

    const fetchWeather = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase.functions.invoke("weather", {
          body: { lat, lon },
        });

        if (error || data?.error) throw new Error(data?.error || "Fetch failed");

        const forecastList = data.forecast?.list || [];
        // Group by day and pick one per day
        const dailyMap = new Map<string, any>();
        forecastList.forEach((item: any) => {
          const dateKey = new Date(item.dt * 1000).toDateString();
          if (!dailyMap.has(dateKey)) dailyMap.set(dateKey, item);
        });

        const days = Array.from(dailyMap.values()).slice(0, 7).map(mapOwmToWeatherDay);

        if (days.length > 0) {
          setForecast(days);
          setIsLive(true);
          localStorage.setItem(CACHE_KEY, JSON.stringify({ data: days, timestamp: Date.now() }));
        }
      } catch (err) {
        console.warn("Weather API unavailable, using cached/mock data:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchWeather();
  }, [lat, lon]);

  return { forecast, loading, isLive };
}
