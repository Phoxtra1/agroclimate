import { useState, useEffect, useCallback } from "react";
import { reverseGeocodeLocation } from "@/lib/location";

export interface GeoPosition {
  lat: number;
  lon: number;
  locationName: string;
  community: string;
  district: string;
  region: string;
  country: string;
  source: "gps" | "cached" | "default";
}

const DEFAULT_POSITION: GeoPosition = {
  lat: 5.6037,
  lon: -0.187,
  locationName: "Accra, Greater Accra",
  community: "Accra",
  district: "Accra Metropolitan",
  region: "Greater Accra",
  country: "Ghana",
  source: "default",
};

const GEO_CACHE_KEY = "agroclimate_geo_cache";
const MAX_CACHE_DISTANCE = 0.003;

function readGeoCache(): GeoPosition | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(GEO_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (
      typeof parsed?.lat !== "number" || !Number.isFinite(parsed.lat) || parsed.lat < -90 || parsed.lat > 90 ||
      typeof parsed?.lon !== "number" || !Number.isFinite(parsed.lon) || parsed.lon < -180 || parsed.lon > 180
    ) return null;
    return { ...DEFAULT_POSITION, ...parsed, source: "cached" };
  } catch {
    return null;
  }
}

const isSamePlace = (a: GeoPosition, lat: number, lon: number) =>
  Math.abs(a.lat - lat) < MAX_CACHE_DISTANCE && Math.abs(a.lon - lon) < MAX_CACHE_DISTANCE;

export function useGeolocation() {
  const [position, setPosition] = useState<GeoPosition>(() => readGeoCache() || DEFAULT_POSITION);
  const [hasResolved, setHasResolved] = useState(false);
  const [loading, setLoading] = useState(true);
  const [retryTrigger, setRetryTrigger] = useState(0);

  useEffect(() => {
    let active = true;
    if (hasResolved) {
      setLoading(false);
      return () => { active = false; };
    }
    if (!navigator.geolocation) {
      setHasResolved(true);
      setLoading(false);
      return () => { active = false; };
    }

    navigator.geolocation.getCurrentPosition(
      async (result) => {
        if (!active) return;
        if (result.coords.accuracy && result.coords.accuracy > 1500) {
          setHasResolved(true);
          setLoading(false);
          return;
        }

        const latitude = result.coords.latitude;
        const longitude = result.coords.longitude;
        const cached = readGeoCache();
        if (cached && isSamePlace(cached, latitude, longitude) && cached.locationName) {
          setPosition({ ...cached, source: "cached" });
          setHasResolved(true);
          setLoading(false);
          return;
        }

        const geo: GeoPosition = {
          lat: latitude,
          lon: longitude,
          locationName: "Your GPS location",
          community: "",
          district: "",
          region: "",
          country: "",
          source: "gps",
        };

        try {
          const resolved = await reverseGeocodeLocation(geo.lat, geo.lon);
          if (!active) return;
          geo.community = resolved.community;
          geo.district = resolved.district;
          geo.region = resolved.region;
          geo.country = resolved.country;
          geo.locationName = resolved.locationName;
        } catch {
          // Keep the coordinates and explicit GPS provenance if reverse geocoding fails.
        }

        if (!active) return;
        setPosition(geo);
        setHasResolved(true);
        try { localStorage.setItem(GEO_CACHE_KEY, JSON.stringify(geo)); } catch { /* cache is optional */ }
        setLoading(false);
      },
      () => {
        if (!active) return;
        setHasResolved(true);
        setLoading(false);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 120000 },
    );

    return () => { active = false; };
  }, [hasResolved, retryTrigger]);

  const retry = useCallback(() => {
    setLoading(true);
    setHasResolved(false);
    setRetryTrigger((previous) => previous + 1);
  }, []);

  return { position, loading, retry };
}
