import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { WeatherDay, weeklyForecast as mockForecast } from "@/data/mock-data";

const CACHE_KEY = "agroclimate_weather_cache";
const CACHE_DURATION = 15 * 60 * 1000; // 15 minutes for freshness

interface CachedWeather {
  data: WeatherDay[];
  timestamp: number;
  lat: number;
  lon: number;
}

// Tomorrow.io weather code to emoji mapping
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

function mapTomorrowToWeatherDay(daily: any, index: number): WeatherDay {
  const date = new Date(daily.time);
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const vals = daily.values || {};
  const code = vals.weatherCodeMax || vals.weatherCodeMin || 1000;

  return {
    day: index === 0 ? "Today" : days[date.getDay()],
    date: `${months[date.getMonth()]} ${date.getDate()}`,
    icon: weatherCodeMap[code] || "☀️",
    tempHigh: Math.round(vals.temperatureMax ?? vals.temperature ?? 30),
    tempLow: Math.round(vals.temperatureMin ?? (vals.temperature ?? 25) - 5),
    rainProb: Math.round(vals.precipitationProbabilityMax ?? vals.precipitationProbabilityAvg ?? 0),
    description: weatherCodeDesc[code] || "Clear",
    humidity: Math.round(vals.humidityMax ?? vals.humidityAvg ?? 60),
    wind: Math.round(vals.windSpeedMax ?? vals.windSpeedAvg ?? 5),
  };
}

function mapRealtimeToWeatherDay(realtime: any): WeatherDay {
  const vals = realtime?.data?.values || {};
  const code = vals.weatherCode || 1000;
  const now = new Date();
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  return {
    day: "Today",
    date: `${months[now.getMonth()]} ${now.getDate()}`,
    icon: weatherCodeMap[code] || "☀️",
    tempHigh: Math.round(vals.temperature ?? 30),
    tempLow: Math.round((vals.temperature ?? 25) - 4),
    rainProb: Math.round(vals.precipitationProbability ?? 0),
    description: weatherCodeDesc[code] || "Clear",
    humidity: Math.round(vals.humidity ?? 60),
    wind: Math.round(vals.windSpeed ?? 5),
  };
}

export function useWeather(lat?: number, lon?: number) {
  const [forecast, setForecast] = useState<WeatherDay[]>(mockForecast);
  const [loading, setLoading] = useState(false);
  const [isLive, setIsLive] = useState(false);

  useEffect(() => {
    if (lat === undefined || lon === undefined) return;

    // Try cache first
    const cached = localStorage.getItem(CACHE_KEY);
    if (cached) {
      try {
        const parsed: CachedWeather = JSON.parse(cached);
        const sameArea = Math.abs(parsed.lat - lat) < 0.1 && Math.abs(parsed.lon - lon) < 0.1;
        if (sameArea && Date.now() - parsed.timestamp < CACHE_DURATION) {
          setForecast(parsed.data);
          setIsLive(true);
          return;
        }
      } catch { /* ignore bad cache */ }
    }

    const fetchWeather = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase.functions.invoke("weather", {
          body: { lat, lon },
        });

        if (error || data?.error) throw new Error(data?.error || "Fetch failed");

        // Parse Tomorrow.io response
        const dailyTimelines = data.forecast?.timelines?.daily || [];
        const forecastDays = dailyTimelines.slice(0, 7).map(mapTomorrowToWeatherDay);

        // Replace first day with realtime data for accuracy
        if (data.realtime?.data?.values) {
          const realtimeDay = mapRealtimeToWeatherDay(data.realtime);
          if (forecastDays.length > 0) {
            // Keep forecast high/low but use realtime current temp
            realtimeDay.tempLow = forecastDays[0].tempLow;
            forecastDays[0] = realtimeDay;
          } else {
            forecastDays.unshift(realtimeDay);
          }
        }

        if (forecastDays.length > 0) {
          setForecast(forecastDays);
          setIsLive(true);
          localStorage.setItem(CACHE_KEY, JSON.stringify({ data: forecastDays, timestamp: Date.now(), lat, lon }));
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
