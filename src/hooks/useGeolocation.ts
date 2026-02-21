import { useState, useEffect } from "react";

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
          community: "",
          district: "",
          region: "",
          country: "Ghana",
        };

        try {
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?lat=${geo.lat}&lon=${geo.lon}&format=json&zoom=14&addressdetails=1`
          );
          const data = await res.json();
          const addr = data.address || {};

          geo.community = addr.suburb || addr.village || addr.neighbourhood || addr.town || addr.city || "";
          geo.district = addr.county || addr.city_district || addr.state_district || addr.town || "";
          geo.region = addr.state || addr.region || "";
          geo.country = addr.country || "Ghana";

          const parts = [geo.community, geo.district, geo.region].filter(Boolean);
          geo.locationName = parts.length > 0 ? parts.slice(0, 2).join(", ") : "Your Location";
        } catch {
          // Keep default name
        }

        setPosition(geo);
        localStorage.setItem(GEO_CACHE_KEY, JSON.stringify(geo));
        setLoading(false);
      },
      () => {
        setLoading(false);
      },
      { timeout: 10000, maximumAge: 300000 }
    );
  }, []);

  return { position, loading };
}
