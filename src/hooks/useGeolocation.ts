import { useState, useEffect } from "react";

interface GeoPosition {
  lat: number;
  lon: number;
  locationName: string;
}

const DEFAULT_POSITION: GeoPosition = { lat: 5.6037, lon: -0.187, locationName: "Accra, Ghana" };
const GEO_CACHE_KEY = "agroclimate_geo_cache";

export function useGeolocation() {
  const [position, setPosition] = useState<GeoPosition>(() => {
    const cached = localStorage.getItem(GEO_CACHE_KEY);
    return cached ? JSON.parse(cached) : DEFAULT_POSITION;
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!navigator.geolocation) {
      setLoading(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const geo: GeoPosition = {
          lat: pos.coords.latitude,
          lon: pos.coords.longitude,
          locationName: "Your Location",
        };

        // Reverse geocode for location name
        try {
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?lat=${geo.lat}&lon=${geo.lon}&format=json&zoom=10`
          );
          const data = await res.json();
          const city = data.address?.city || data.address?.town || data.address?.village || "";
          const state = data.address?.state || data.address?.region || "";
          geo.locationName = [city, state].filter(Boolean).join(", ") || "Your Location";
        } catch {
          // Keep default name
        }

        setPosition(geo);
        localStorage.setItem(GEO_CACHE_KEY, JSON.stringify(geo));
        setLoading(false);
      },
      () => {
        setLoading(false); // Use default/cached position
      },
      { timeout: 10000, maximumAge: 300000 }
    );
  }, []);

  return { position, loading };
}
