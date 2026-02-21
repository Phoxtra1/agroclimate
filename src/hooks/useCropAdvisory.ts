import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { WeatherDay } from "@/data/mock-data";

export interface CropAdvisory {
  recommendedCrops: { name: string; reason: string; icon: string }[];
  weeklyActions: string[];
  risks: { risk: string; mitigation: string }[];
  tip: string;
}

const ADVISORY_CACHE_KEY = "agroclimate_advisory_cache";
const ADVISORY_CACHE_DURATION = 6 * 60 * 60 * 1000; // 6 hours

export function useCropAdvisory() {
  const [advisory, setAdvisory] = useState<CropAdvisory | null>(() => {
    const cached = localStorage.getItem(ADVISORY_CACHE_KEY);
    if (cached) {
      const parsed = JSON.parse(cached);
      if (Date.now() - parsed.timestamp < ADVISORY_CACHE_DURATION) return parsed.data;
    }
    return null;
  });
  const [loading, setLoading] = useState(false);

  const fetchAdvisory = async (weather: WeatherDay, locationName: string) => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("crop-advisory", {
        body: { weatherData: weather, locationName },
      });

      if (error || data?.error) throw new Error(data?.error || "Fetch failed");

      if (data?.advisory) {
        setAdvisory(data.advisory);
        localStorage.setItem(ADVISORY_CACHE_KEY, JSON.stringify({ data: data.advisory, timestamp: Date.now() }));
      }
    } catch (err) {
      console.warn("Crop advisory unavailable:", err);
    } finally {
      setLoading(false);
    }
  };

  return { advisory, loading, fetchAdvisory };
}
