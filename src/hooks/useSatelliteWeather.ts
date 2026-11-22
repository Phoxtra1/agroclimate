import { useCallback, useEffect, useState } from "react";
import { requestWeather } from "@/lib/weatherRequest";
import { parseSatelliteWeather, weatherEvidenceIsFresh, type SatelliteWeatherEvidence } from "@/services/satellite/weatherRisk";

const cache = new Map<string, SatelliteWeatherEvidence>();
export function useSatelliteWeather(lat: number, lon: number) {
  const [evidence, setEvidence] = useState<SatelliteWeatherEvidence | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  const [now, setNow] = useState(Date.now());
  const refresh = useCallback(() => { setRevision(value => value + 1); }, []);
  useEffect(() => {
    let active = true;
    let request = 0;
    let inFlight = false;
    let nextFetchAt = 0;
    const key = `${lat},${lon}`;
    setEvidence(cache.get(key) ?? null);
    setError("");
    const load = async () => {
      if (inFlight || Date.now() < nextFetchAt) return;
      inFlight = true;
      const id = ++request;
      setLoading(true);
      try {
        const { data, error: failure } = await requestWeather(lat, lon);
        if (failure || data?.error) throw new Error(data?.error || "Weather is unavailable for this location.");
        nextFetchAt = Math.max(Date.now() + 10 * 60 * 1000, Date.parse(data?.retryAt || "") || 0);
        if (data?.status === "unavailable") throw new Error(data.message || "Weather is unavailable for this location.");
        const result = parseSatelliteWeather(data);
        if (!active || id !== request) return;
        if (cache.size >= 50) cache.clear();
        cache.set(key, result);
        setEvidence(result);
        setError(data?.message || "");
        setNow(Date.now());
      } catch (failure) {
        nextFetchAt = Math.max(nextFetchAt, Date.now() + 60000);
        if (active && id === request) setError(failure instanceof Error ? failure.message : "Weather unavailable");
      } finally {
        inFlight = false;
        if (active && id === request) setLoading(false);
      }
    };
    const cached = cache.get(key);
    if (revision > 0 || !cached || Date.now() - Date.parse(cached.fetchedAt) >= 10 * 60 * 1000) void load();
    const interval = window.setInterval(() => { setNow(Date.now()); if (document.visibilityState === "visible") void load(); }, 10 * 60 * 1000);
    const clock = window.setInterval(() => setNow(Date.now()), 60000);
    const wake = () => { setNow(Date.now()); if (document.visibilityState === "visible") void load(); };
    window.addEventListener("online", wake);
    document.addEventListener("visibilitychange", wake);
    return () => { active = false; window.clearInterval(interval); window.clearInterval(clock); window.removeEventListener("online", wake); document.removeEventListener("visibilitychange", wake); };
  }, [lat, lon, revision]);
  return { evidence, loading, error, refresh, now, fresh: evidence ? weatherEvidenceIsFresh(evidence, now) : false };
}