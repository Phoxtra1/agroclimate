export interface PortSearchFeature {
  id: string;
  osmType: string;
  osmId: number;
  name: string;
  lat: number;
  lon: number;
  tags: Record<string, string>;
  source: "OpenStreetMap";
  mappedAt: string;
}

export interface PortSearchBounds {
  south: number;
  west: number;
  north: number;
  east: number;
}

const OVERPASS_ENDPOINTS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
];

export async function searchMappedPorts(
  bounds: PortSearchBounds,
  signal?: AbortSignal,
): Promise<PortSearchFeature[]> {
  const values = [bounds.south, bounds.west, bounds.north, bounds.east];
  if (values.some((value) => !Number.isFinite(value))
    || bounds.south < -90 || bounds.north > 90
    || bounds.west < -180 || bounds.east > 180
    || bounds.south >= bounds.north || bounds.west >= bounds.east) {
    throw new Error("The visible map bounds are invalid.");
  }

  const bbox = `(${bounds.south},${bounds.west},${bounds.north},${bounds.east})`;
  const query = `[out:json][timeout:18];(
    nwr["harbour"]${bbox};
    nwr["landuse"="port"]${bbox};
    nwr["industrial"="port"]${bbox};
    nwr["seamark:type"="harbour"]${bbox};
  );out center tags;`;
  let lastError: Error | null = null;

  for (const endpoint of OVERPASS_ENDPOINTS) {
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8", Accept: "application/json" },
        body: new URLSearchParams({ data: query }),
        signal,
      });
      if (!response.ok) {
        lastError = new Error(`OpenStreetMap Overpass returned HTTP ${response.status}.`);
        if (response.status === 429 || response.status >= 500) continue;
        throw lastError;
      }
      const payload = await response.json();
      const byId = new Map<string, PortSearchFeature>();
      for (const item of payload.elements ?? []) {
        const lat = typeof item.lat === "number" ? item.lat : item.center?.lat;
        const lon = typeof item.lon === "number" ? item.lon : item.center?.lon;
        if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
        const tags = (item.tags ?? {}) as Record<string, string>;
        const name = tags.name || tags["name:en"] || tags.operator || "";
        if (!name.trim()) continue;
        const key = `${item.type}/${item.id}`;
        byId.set(key, {
          id: key,
          osmType: String(item.type),
          osmId: Number(item.id),
          name,
          lat,
          lon,
          tags,
          source: "OpenStreetMap",
          mappedAt: new Date().toISOString(),
        });
      }
      return [...byId.values()];
    } catch (error) {
      if (signal?.aborted) return [];
      lastError = error instanceof Error ? error : new Error("Port lookup failed.");
    }
  }
  throw lastError ?? new Error("No Overpass service was available.");
}
