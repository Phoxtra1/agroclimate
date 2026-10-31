export type GeoPoint = {
  lat: number;
  lon: number;
};

export type SearchResult = {
  placeId: string;
  name: string;
  displayName: string;
  lat: number;
  lon: number;
  type: string;
  category?: string;
};

export type RouteStep = {
  instruction: string;
  distanceMeters: number;
  durationSeconds: number;
  name: string;
  maneuverType: string;
  maneuverModifier?: string;
  location: [number, number]; // [lon, lat]
};

export type RouteData = {
  distanceKm: number;
  durationMinutes: number;
  geometry: [number, number][]; // [lat, lon]
  steps: RouteStep[];
  startAddress: string;
  endAddress: string;
};

export type TravelMode = "driving" | "freight" | "tractor" | "walking";

/**
 * Searches places worldwide using OpenStreetMap Nominatim / Photon
 */
export async function searchPlaces(query: string, signal?: AbortSignal): Promise<SearchResult[]> {
  const trimmed = query.trim();
  if (!trimmed || trimmed.length < 2) return [];

  // Check if query is latitude, longitude
  const coordMatch = trimmed.match(/^(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)$/);
  if (coordMatch) {
    const lat = Number(coordMatch[1]);
    const lon = Number(coordMatch[2]);
    if (lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180) {
      return [
        {
          placeId: `coords-${lat}-${lon}`,
          name: `${lat.toFixed(5)}, ${lon.toFixed(5)}`,
          displayName: `Exact coordinates: ${lat.toFixed(5)}, ${lon.toFixed(5)}`,
          lat,
          lon,
          type: "coordinate",
        },
      ];
    }
  }

  try {
    const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&q=${encodeURIComponent(
      trimmed
    )}&limit=7&addressdetails=1`;
    const response = await fetch(url, {
      signal,
      headers: {
        Accept: "application/json",
      },
    });

    if (!response.ok) return [];

    const data = await response.json();
    return (data || []).map((item: any) => ({
      placeId: String(item.place_id || Math.random()),
      name: item.name || item.display_name.split(",")[0],
      displayName: item.display_name,
      lat: Number(item.lat),
      lon: Number(item.lon),
      type: item.type || "location",
      category: item.category,
    }));
  } catch (err: unknown) {
    if (signal?.aborted) return [];
    console.warn("Place search failed:", err);
    return [];
  }
}

/**
 * Reverse geocodes a coordinate to a human readable address
 */
export async function reverseGeocode(point: GeoPoint, signal?: AbortSignal): Promise<string> {
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${point.lat}&lon=${point.lon}`;
    const response = await fetch(url, {
      signal,
      headers: { Accept: "application/json" },
    });
    if (!response.ok) return `${point.lat.toFixed(4)}, ${point.lon.toFixed(4)}`;

    const data = await response.json();
    const address = data.address || {};
    const short =
      data.name ||
      [address.farm, address.village, address.town, address.city, address.country]
        .filter(Boolean)
        .slice(0, 2)
        .join(", ");

    return short || data.display_name || `${point.lat.toFixed(4)}, ${point.lon.toFixed(4)}`;
  } catch {
    return `${point.lat.toFixed(4)}, ${point.lon.toFixed(4)}`;
  }
}

/**
 * Calculates real-time driving or freight route using OSRM
 */
export async function calculateRoute(
  start: GeoPoint,
  end: GeoPoint,
  mode: TravelMode = "driving",
  signal?: AbortSignal
): Promise<RouteData> {
  const profile = mode === "walking" ? "foot" : "driving";
  const url = `https://router.project-osrm.org/route/v1/${profile}/${start.lon},${start.lat};${end.lon},${end.lat}?overview=full&geometries=geojson&steps=true`;

  const response = await fetch(url, { signal });
  if (!response.ok) {
    throw new Error(`Routing engine returned status ${response.status}. Route cannot be computed.`);
  }

  const data = await response.json();
  if (!data.routes || !data.routes.length) {
    throw new Error("No navigable path found between selected coordinates.");
  }

  const primaryRoute = data.routes[0];
  const coordinates: [number, number][] = (primaryRoute.geometry?.coordinates || []).map(
    (coord: [number, number]) => [coord[1], coord[0]] // convert [lon, lat] to [lat, lon]
  );

  const rawSteps = primaryRoute.legs?.[0]?.steps || [];
  const steps: RouteStep[] = rawSteps.map((s: any) => ({
    instruction: formatStepInstruction(s),
    distanceMeters: s.distance || 0,
    durationSeconds: s.duration || 0,
    name: s.name || "Unnamed transit way",
    maneuverType: s.maneuver?.type || "straight",
    maneuverModifier: s.maneuver?.modifier,
    location: s.maneuver?.location || [0, 0],
  }));

  const startAddress = await reverseGeocode(start, signal);
  const endAddress = await reverseGeocode(end, signal);

  // Speed adjustments for tractor / heavy freight
  let durationMinutes = primaryRoute.duration / 60;
  if (mode === "tractor") {
    durationMinutes *= 2.2; // Agricultural tractors travel ~25-35 km/h
  } else if (mode === "freight") {
    durationMinutes *= 1.25; // Heavy commodity haulage trucks
  }

  return {
    distanceKm: Number((primaryRoute.distance / 1000).toFixed(1)),
    durationMinutes: Math.round(durationMinutes),
    geometry: coordinates,
    steps,
    startAddress,
    endAddress,
  };
}

function formatStepInstruction(step: any): string {
  const type = step.maneuver?.type;
  const modifier = step.maneuver?.modifier;
  const name = step.name ? ` onto ${step.name}` : "";

  if (type === "depart") return `Depart from starting point${name}`;
  if (type === "arrive") return `Arrive at destination`;
  if (type === "turn") {
    return `Turn ${modifier || "ahead"}${name}`;
  }
  if (type === "new name") return `Continue${name}`;
  if (type === "fork") return `Keep ${modifier || "right"} at the fork${name}`;
  if (type === "roundabout") return `Take exit at the roundabout${name}`;
  if (modifier) return `Head ${modifier}${name}`;
  return `Continue straight${name}`;
}
