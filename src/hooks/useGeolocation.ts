import { useState, useEffect } from "react";
import { reverseGeocodeLocation } from "@/lib/location";

export interface GeoPosition {
  lat: number;
  lon: number;
  locationName: string;
  community: string;
  district: string;
  region: string;
  country: string;
}

const DEFAULT_POSITION: GeoPosition = {
  lat: 5.6037, lon: -0.187,
  locationName: "Accra, Greater Accra",
  community: "Accra",
  district: "Accra Metropolitan",
  region: "Greater Accra",
  country: "Ghana",
};

const GEO_CACHE_KEY = "agroclimate_geo_cache";
const MAX_CACHE_DISTANCE = 0.003;

const isSamePlace = (a: GeoPosition, lat: number, lon: number) =>
  Math.abs(a.lat - lat) < MAX_CACHE_DISTANCE && Math.abs(a.lon - lon) < MAX_CACHE_DISTANCE;

export function useGeolocation() {
  const [position, setPosition] = useState<GeoPosition>(() => {
    try {
      const cached = localStorage.getItem(GEO_CACHE_KEY);
      if (cached) return JSON.parse(cached);
    } catch { /* ignore */ }
    return DEFAULT_POSITION;
  });
  const [hasResolved, setHasResolved] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (hasResolved) { setLoading(false); return; }
    if (!navigator.geolocation) { setLoading(false); return; }

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        if (pos.coords.accuracy && pos.coords.accuracy > 1500) {
          setHasResolved(true);
          setLoading(false);
          return;
        }

        // If we have cached data near this location, keep using it for stability
        const cached = localStorage.getItem(GEO_CACHE_KEY);
        if (cached) {
          try {
            const prev: GeoPosition = JSON.parse(cached);
            if (isSamePlace(prev, pos.coords.latitude, pos.coords.longitude) && prev.locationName) {
              setPosition(prev);
              setHasResolved(true);
              setLoading(false);
              return;
            }
          } catch { /* ignore */ }
        }

        const geo: GeoPosition = {
          lat: pos.coords.latitude,
          lon: pos.coords.longitude,
          locationName: "Your Location",
          community: "",
          district: "",
          region: "",
          country: "Ghana",
        };

        try {
          const resolved = await reverseGeocodeLocation(geo.lat, geo.lon);
          geo.community = resolved.community;
          geo.district = resolved.district;
          geo.region = resolved.region;
          geo.country = resolved.country;
          geo.locationName = resolved.locationName;
        } catch {
          // Keep default name
        }

        setPosition(geo);
        setHasResolved(true);
        localStorage.setItem(GEO_CACHE_KEY, JSON.stringify(geo));
        setLoading(false);
      },
      () => {
        setHasResolved(true);
        setLoading(false);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 120000 }
    );
  }, [hasResolved]);

  return { position, loading };
}
