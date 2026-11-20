import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { parseSatelliteWeather, weatherEvidenceIsFresh, type SatelliteWeatherEvidence } from "@/services/satellite/weatherRisk";

const cache = new Map<string, SatelliteWeatherEvidence>();
export function useSatelliteWeather(lat: number, lon: number) {
  const [evidence, setEvidence] = useState<SatelliteWeatherEvidence | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  const [now, setNow] = useState(Date.now());
  const refresh = useCallback(() => { cache.delete(`${lat},${lon}`); setRevision(value => value + 1); }, [lat, lon]);
  useEffect(() => {
    let active = true;
    let request = 0;
    const key = `${lat},${lon}`;
    setEvidence(cache.get(key) ?? null);
    setError("");
    const load = async () => {
      const id = ++request;
      setLoading(true);
      try {
        const { data, error: failure } = await supabase.functions.invoke("weather", { body: { lat, lon } });
        if (failure || data?.error) throw new Error(data?.error || "Weather is unavailable for this location.");
        const result = parseSatelliteWeather(data);
        if (!active || id !== request) return;
        if (cache.size >= 50) cache.clear();
        cache.set(key, result);
        setEvidence(result);
        setError("");
        setNow(Date.now());
      } catch (failure) {
        if (active && id === request) setError(failure instanceof Error ? failure.message : "Weather unavailable");
      } finally {
        if (active && id === request) setLoading(false);
      }
    };
    const cached = cache.get(key);
    if (!cached || Date.now() - Date.parse(cached.fetchedAt) >= 10 * 60 * 1000) void load();
    const interval = window.setInterval(() => { setNow(Date.now()); if (document.visibilityState === "visible") void load(); }, 10 * 60 * 1000);
    const clock = window.setInterval(() => setNow(Date.now()), 60000);
    const wake = () => { setNow(Date.now()); if (document.visibilityState === "visible") void load(); };
    window.addEventListener("online", wake);
    document.addEventListener("visibilitychange", wake);
    return () => { active = false; window.clearInterval(interval); window.clearInterval(clock); window.removeEventListener("online", wake); document.removeEventListener("visibilitychange", wake); };
  }, [lat, lon, revision]);
  return { evidence, loading, error, refresh, now, fresh: evidence ? weatherEvidenceIsFresh(evidence, now) : false };
}