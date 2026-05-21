import { useState, useEffect, useCallback } from "react";
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

// Deterministically derive agricultural metrics from air parameters when Tomorrow.io does not supply them
function getDeterministicAgroMetrics(tempHigh: number, tempLow: number, humidity: number, wind: number, rainProb: number, rawRainMm?: number) {
  const rainMm = rawRainMm !== undefined 
    ? Math.round(rawRainMm * 10) / 10 
    : (rainProb > 40 ? Math.round((rainProb / 10) * 1.5 * 10) / 10 : 0);

  // Evapotranspiration ET0: Penman-Monteith simplified approximation based on temperature differential, wind, and humidity
  const evapotranspiration = Math.round(Math.max(1.5, Math.min(8.5, (tempHigh * 0.15) + (wind * 0.05) - (humidity * 0.03) + 2.0)) * 100) / 100;

  // Volumetric Soil Moisture: rain increases soil moisture, high temperature and wind decrease it
  const soilMoisture = Math.round(Math.max(10, Math.min(95, 45 + (rainProb * 0.4) - (tempHigh * 0.5))));

  // Soil Temperature: tracks close to air temperature but buffered by humidity/wetness
  const soilTemperature = Math.round(tempHigh - 2 + (humidity > 70 ? -1 : 1));

  return { rainMm, evapotranspiration, soilMoisture, soilTemperature };
}

// Map mock forecast to include deterministic agricultural metrics and dynamic current dates
const enrichMockForecast = (list: WeatherDay[]): WeatherDay[] => {
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const now = new Date();

  return list.map((item, index) => {
    const targetDate = new Date(now.getTime() + index * 24 * 60 * 60 * 1000);
    const tempHigh = item.tempHigh;
    const tempLow = item.tempLow;
    const humidity = item.humidity;
    const wind = item.wind;
    const rainProb = item.rainProb;

    const weatherCode = item.weatherCode ?? (item.icon === "🌧️" ? 4001 : item.icon === "⛅" ? 1101 : 1000);
    const agro = getDeterministicAgroMetrics(tempHigh, tempLow, humidity, wind, rainProb, item.rainMm);

    return {
      ...item,
      day: index === 0 ? "Today" : days[targetDate.getDay()],
      date: `${months[targetDate.getMonth()]} ${targetDate.getDate()}`,
      weatherCode,
      rainMm: item.rainMm ?? agro.rainMm,
      evapotranspiration: item.evapotranspiration ?? agro.evapotranspiration,
      soilMoisture: item.soilMoisture ?? agro.soilMoisture,
      soilTemperature: item.soilTemperature ?? agro.soilTemperature,
    };
  });
};

function mapTomorrowToWeatherDay(daily: any, index: number): WeatherDay {
  const date = new Date(daily.time);
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const vals = daily.values || {};
  const code = vals.weatherCodeMax || vals.weatherCodeMin || 1000;

  const tempHigh = Math.round(vals.temperatureMax ?? vals.temperature ?? 30);
  const tempLow = Math.round(vals.temperatureMin ?? (vals.temperature ?? 25) - 5);
  const humidity = Math.round(vals.humidityMax ?? vals.humidityAvg ?? 60);
  const wind = Math.round(vals.windSpeedMax ?? vals.windSpeedAvg ?? 5);
  const rainProb = Math.round(vals.precipitationProbabilityMax ?? vals.precipitationProbabilityAvg ?? 0);

  const agro = getDeterministicAgroMetrics(tempHigh, tempLow, humidity, wind, rainProb, vals.rainAccumulationSum);

  return {
    day: index === 0 ? "Today" : days[date.getDay()],
    date: `${months[date.getMonth()]} ${date.getDate()}`,
    icon: weatherCodeMap[code] || "☀️",
    tempHigh,
    tempLow,
    rainProb,
    description: weatherCodeDesc[code] || "Clear",
    humidity,
    wind,
    weatherCode: code,
    rainMm: vals.rainAccumulationSum !== undefined ? Math.round(vals.rainAccumulationSum * 10) / 10 : agro.rainMm,
    evapotranspiration: vals.evapotranspiration !== undefined ? Math.round(vals.evapotranspiration * 100) / 100 : agro.evapotranspiration,
    soilMoisture: vals.soilMoistureVolumetric0To10 !== undefined ? Math.round(vals.soilMoistureVolumetric0To10 * 100) : agro.soilMoisture,
    soilTemperature: vals.soilTemperature0To10 !== undefined ? Math.round(vals.soilTemperature0To10) : agro.soilTemperature,
  };
}

function mapRealtimeToWeatherDay(realtime: any): WeatherDay {
  const vals = realtime?.data?.values || {};
  const code = vals.weatherCode || 1000;
  const now = new Date();
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  const tempHigh = Math.round(vals.temperature ?? 30);
  const tempLow = Math.round((vals.temperature ?? 25) - 4);
  const humidity = Math.round(vals.humidity ?? 60);
  const wind = Math.round(vals.windSpeed ?? 5);
  const rainProb = Math.round(vals.precipitationProbability ?? 0);

  const agro = getDeterministicAgroMetrics(tempHigh, tempLow, humidity, wind, rainProb, vals.rainAccumulation);

  return {
    day: "Today",
    date: `${months[now.getMonth()]} ${now.getDate()}`,
    icon: weatherCodeMap[code] || "☀️",
    tempHigh,
    tempLow,
    rainProb,
    description: weatherCodeDesc[code] || "Clear",
    humidity,
    wind,
    weatherCode: code,
    rainMm: vals.rainAccumulation !== undefined ? Math.round(vals.rainAccumulation * 10) / 10 : agro.rainMm,
    evapotranspiration: agro.evapotranspiration,
    soilMoisture: agro.soilMoisture,
    soilTemperature: agro.soilTemperature,
  };
}

export function useWeather(lat?: number, lon?: number) {
  const [forecast, setForecast] = useState<WeatherDay[]>(() => enrichMockForecast(mockForecast));
  const [loading, setLoading] = useState(false);
  const [isLive, setIsLive] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const refresh = useCallback(() => {
    localStorage.removeItem(CACHE_KEY);
    setRefreshTrigger(prev => prev + 1);
  }, []);

  useEffect(() => {
    if (lat === undefined || lon === undefined) return;

    // Try cache first
    const cached = localStorage.getItem(CACHE_KEY);
    if (cached && refreshTrigger === 0) {
      try {
        const parsed: CachedWeather = JSON.parse(cached);
        const sameArea = Math.abs(parsed.lat - lat) < 0.1 && Math.abs(parsed.lon - lon) < 0.1;
        if (sameArea && Date.now() - parsed.timestamp < CACHE_DURATION) {
          setForecast(parsed.data);
          setIsLive(true);
          setLastUpdated(new Date(parsed.timestamp));
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
          const timestamp = Date.now();
          setLastUpdated(new Date(timestamp));
          localStorage.setItem(CACHE_KEY, JSON.stringify({ data: forecastDays, timestamp, lat, lon }));
        }
      } catch (err) {
        console.warn("Weather API unavailable, using cached/mock data:", err);
        // Ensure mock forecast is enriched and set as active fallback
        setForecast(enrichMockForecast(mockForecast));
        setIsLive(false);
        setLastUpdated(new Date());
      } finally {
        setLoading(false);
      }
    };

    fetchWeather();
  }, [lat, lon, refreshTrigger]);

  return { forecast, loading, isLive, lastUpdated, refresh };
}
