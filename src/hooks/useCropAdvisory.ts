import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { WeatherDay } from "@/data/mock-data";
import { GeoPosition } from "@/hooks/useGeolocation";

export interface CropAdvisory {
  recommendedCrops: { name: string; category?: string; reason: string; icon: string }[];
  weeklyActions: string[];
  risks: { risk: string; mitigation: string }[];
  irrigationAdvice?: { needed: boolean; reason: string; method: string };
  livestockAdvice?: { animal: string; advice: string }[];
  fishFarmingAdvice?: string;
  tip: string;
}

const ADVISORY_CACHE_PREFIX = "agroclimate_advisory_cache";
const ADVISORY_CACHE_DURATION = 6 * 60 * 60 * 1000;

interface CachedAdvisory {
  data: CropAdvisory;
  timestamp: number;
}

function cacheKey(userId: string, locationName: string, position?: GeoPosition) {
  const location = [
    position?.community,
    position?.district,
    position?.region,
    locationName,
  ].filter(Boolean).join("|").toLowerCase().trim();
  return `${ADVISORY_CACHE_PREFIX}:${encodeURIComponent(userId)}:${encodeURIComponent(location)}`;
}

function readCachedAdvisory(key: string): CropAdvisory | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const cached = JSON.parse(raw) as CachedAdvisory;
    if (
      !cached ||
      typeof cached.timestamp !== "number" ||
      !cached.data ||
      Date.now() - cached.timestamp < 0 ||
      Date.now() - cached.timestamp >= ADVISORY_CACHE_DURATION
    ) {
      localStorage.removeItem(key);
      return null;
    }
    return cached.data;
  } catch {
    // A malformed or unavailable browser cache must never prevent the advisory UI loading.
    try { localStorage.removeItem(key); } catch { /* storage may be unavailable */ }
    return null;
  }
}

export function useCropAdvisory() {
  const [advisory, setAdvisory] = useState<CropAdvisory | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchAdvisory = async (weather: WeatherDay, locationName: string, position?: GeoPosition) => {
    setLoading(true);
    try {
      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (authError || !authData.user) {
        throw new Error("Sign in to retrieve a personal crop advisory.");
      }

      const key = cacheKey(authData.user.id, locationName, position);
      const cachedAdvisory = readCachedAdvisory(key);
      if (cachedAdvisory) setAdvisory(cachedAdvisory);

      const { data, error } = await supabase.functions.invoke("crop-advisory", {
        body: {
          weatherData: weather,
          locationName,
          location: position ? {
            community: position.community,
            district: position.district,
            region: position.region,
          } : undefined,
        },
      });

      if (error || data?.error) throw new Error(data?.error || "Fetch failed");

      if (data?.advisory) {
        setAdvisory(data.advisory);
        try {
          localStorage.setItem(key, JSON.stringify({ data: data.advisory, timestamp: Date.now() }));
        } catch (storageError) {
          console.warn("Crop advisory cache unavailable:", storageError);
        }
      }
    } catch (err) {
      console.warn("Crop advisory unavailable:", err);
    } finally {
      setLoading(false);
    }
  };

  return { advisory, loading, fetchAdvisory };
}
