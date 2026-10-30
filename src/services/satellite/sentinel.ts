export const EARTH_SEARCH_URL = "https://earth-search.aws.element84.com/v1";
export const TITILER_URL = "https://titiler.xyz";
export const SENTINEL_COLLECTION = "sentinel-2-c1-l2a";

export type SpectralIndex = "ndvi" | "ndmi" | "ndwi";

export type GeoPoint = {
  lat: number;
  lon: number;
};

export type SentinelScene = {
  id: string;
  itemUrl: string;
  acquiredAt: string;
  cloudCover: number | null;
  platform: string;
  geometry: GeoJSON.Geometry;
};

type StacItem = {
  id: string;
  collection?: string;
  properties?: Record<string, unknown>;
  geometry?: GeoJSON.Geometry;
  links?: Array<{ rel?: string; href?: string }>;
};

type StacSearchResponse = {
  features?: StacItem[];
};

export type SceneSearchOptions = {
  point: GeoPoint;
  daysBack: number;
  maxCloudCover: number;
  signal?: AbortSignal;
};

const INDEX_CONFIG: Record<SpectralIndex, { assets: string[]; expression: string }> = {
  ndvi: { assets: ["nir", "red"], expression: "(b1-b2)/(b1+b2)" },
  ndmi: { assets: ["nir", "swir16"], expression: "(b1-b2)/(b1+b2)" },
  ndwi: { assets: ["green", "nir"], expression: "(b1-b2)/(b1+b2)" },
};

function dateOnly(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export async function searchSentinelScenes({
  point,
  daysBack,
  maxCloudCover,
  signal,
}: SceneSearchOptions): Promise<SentinelScene[]> {
  const end = new Date();
  const start = new Date(end.getTime() - daysBack * 24 * 60 * 60 * 1000);
  const response = await fetch(`${EARTH_SEARCH_URL}/search`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/geo+json, application/json" },
    signal,
    body: JSON.stringify({
      collections: [SENTINEL_COLLECTION],
      intersects: { type: "Point", coordinates: [point.lon, point.lat] },
      datetime: `${dateOnly(start)}T00:00:00Z/${dateOnly(end)}T23:59:59Z`,
      limit: 30,
      query: { "eo:cloud_cover": { lte: maxCloudCover } },
    }),
  });

  if (!response.ok) {
    throw new Error(`Sentinel-2 catalogue returned ${response.status}. Try again or use the NASA context layer.`);
  }

  const data = (await response.json()) as StacSearchResponse;
  return (data.features ?? [])
    .filter((item) => item.geometry && item.id)
    .map((item) => {
      const properties = item.properties ?? {};
      const self = item.links?.find((link) => link.rel === "self")?.href;
      const itemUrl = self ?? `${EARTH_SEARCH_URL}/collections/${SENTINEL_COLLECTION}/items/${encodeURIComponent(item.id)}`;
      const rawCloud = properties["eo:cloud_cover"];
      const cloudCover = typeof rawCloud === "number" ? rawCloud : null;
      return {
        id: item.id,
        itemUrl,
        acquiredAt: String(properties.datetime ?? properties.start_datetime ?? ""),
        cloudCover,
        platform: String(properties.platform ?? "Sentinel-2"),
        geometry: item.geometry!,
      };
    })
    .sort((a, b) => {
      const cloudDelta = (a.cloudCover ?? 100) - (b.cloudCover ?? 100);
      if (Math.abs(cloudDelta) > 8) return cloudDelta;
      return Date.parse(b.acquiredAt) - Date.parse(a.acquiredAt);
    });
}

export function buildTileJsonUrl(
  itemUrl: string,
  layer: "true-color" | "false-color" | SpectralIndex,
): string {
  const item = new URL(itemUrl);
  if (item.origin !== new URL(EARTH_SEARCH_URL).origin) {
    throw new Error("The selected scene is not from the trusted Earth Search catalogue.");
  }

  const endpoint = new URL(`${TITILER_URL}/stac/WebMercatorQuad/tilejson.json`);
  endpoint.searchParams.set("url", itemUrl);

  if (layer === "true-color") {
    endpoint.searchParams.append("assets", "visual");
    endpoint.searchParams.append("rescale", "0,255");
    endpoint.searchParams.append("rescale", "0,255");
    endpoint.searchParams.append("rescale", "0,255");
  } else if (layer === "false-color") {
    for (const asset of ["nir", "red", "green"]) endpoint.searchParams.append("assets", asset);
    endpoint.searchParams.set("unscale", "true");
    for (let i = 0; i < 3; i += 1) endpoint.searchParams.append("rescale", "0,0.35");
  } else {
    const index = INDEX_CONFIG[layer];
    for (const asset of index.assets) endpoint.searchParams.append("assets", asset);
    endpoint.searchParams.set("expression", index.expression);
    endpoint.searchParams.set("unscale", "true");
    endpoint.searchParams.set("rescale", "-1,1");
    endpoint.searchParams.set("colormap_name", "rdylgn");
  }

  endpoint.searchParams.set("minzoom", "7");
  endpoint.searchParams.set("maxzoom", "18");
  return endpoint.toString();
}

export async function getSentinelTileTemplate(
  itemUrl: string,
  layer: "true-color" | "false-color" | SpectralIndex,
  signal?: AbortSignal,
): Promise<string> {
  const response = await fetch(buildTileJsonUrl(itemUrl, layer), { signal });
  if (!response.ok) {
    throw new Error(`Sentinel imagery renderer returned ${response.status}. The open tile service may be busy.`);
  }
  const tileJson = (await response.json()) as { tiles?: string[] };
  if (!tileJson.tiles?.[0]) throw new Error("The imagery renderer did not return a tile URL.");
  return tileJson.tiles[0];
}

export type FieldIndexStatistics = {
  min: number | null;
  mean: number | null;
  max: number | null;
  count: number | null;
};

function findStatistic(payload: unknown, key: string): number | null {
  const pending: unknown[] = [payload];
  const visited = new Set<object>();

  while (pending.length) {
    const current = pending.shift();
    if (!current || typeof current !== "object" || visited.has(current)) continue;
    visited.add(current);
    const record = current as Record<string, unknown>;
    const value = record[key];
    if (typeof value === "number" && Number.isFinite(value)) return value;
    for (const child of Object.values(record)) {
      if (child && typeof child === "object") pending.push(child);
    }
  }

  return null;
}

export async function getFieldIndexStatistics(
  itemUrl: string,
  geometry: GeoJSON.Polygon,
  index: SpectralIndex,
  signal?: AbortSignal,
): Promise<FieldIndexStatistics> {
  const item = new URL(itemUrl);
  if (item.origin !== new URL(EARTH_SEARCH_URL).origin) {
    throw new Error("The selected scene is not from the trusted Earth Search catalogue.");
  }

  const config = INDEX_CONFIG[index];
  const endpoint = new URL(`${TITILER_URL}/stac/statistics`);
  endpoint.searchParams.set("url", itemUrl);
  for (const asset of config.assets) endpoint.searchParams.append("assets", asset);
  endpoint.searchParams.set("expression", config.expression);
  endpoint.searchParams.set("unscale", "true");
  endpoint.searchParams.set("max_size", "2048");

  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/geo+json", Accept: "application/json" },
    body: JSON.stringify({ type: "Feature", properties: {}, geometry }),
    signal,
  });
  if (!response.ok) {
    throw new Error(`Could not calculate field ${index.toUpperCase()} statistics (${response.status}).`);
  }

  const payload: unknown = await response.json();
  return {
    min: findStatistic(payload, "min"),
    mean: findStatistic(payload, "mean"),
    max: findStatistic(payload, "max"),
    count: findStatistic(payload, "count"),
  };
}

export async function getIndexAtPoint(
  itemUrl: string,
  point: GeoPoint,
  index: SpectralIndex,
  signal?: AbortSignal,
): Promise<number | null> {
  const item = new URL(itemUrl);
  if (item.origin !== new URL(EARTH_SEARCH_URL).origin) {
    throw new Error("The selected scene is not from the trusted Earth Search catalogue.");
  }

  const config = INDEX_CONFIG[index];
  const endpoint = new URL(`${TITILER_URL}/stac/point/${point.lon},${point.lat}`);
  endpoint.searchParams.set("url", itemUrl);
  for (const asset of config.assets) endpoint.searchParams.append("assets", asset);
  endpoint.searchParams.set("expression", config.expression);
  endpoint.searchParams.set("unscale", "true");

  const response = await fetch(endpoint, { signal });
  if (!response.ok) throw new Error(`Could not sample ${index.toUpperCase()} at this point (${response.status}).`);
  const payload = (await response.json()) as { values?: unknown; data?: unknown };
  const values = payload.values ?? payload.data;
  if (Array.isArray(values) && typeof values[0] === "number" && Number.isFinite(values[0])) return values[0];
  if (typeof values === "number" && Number.isFinite(values)) return values;
  if (values && typeof values === "object") {
    const first = Object.values(values as Record<string, unknown>)[0];
    if (typeof first === "number" && Number.isFinite(first)) return first;
  }
  return null;
}

export function calculatePolygonAreaHectares(points: GeoPoint[]): number {
  if (points.length < 3) return 0;
  const radius = 6_371_008.8;
  let area = 0;
  for (let index = 0; index < points.length; index += 1) {
    const current = points[index];
    const next = points[(index + 1) % points.length];
    const lat1 = (current.lat * Math.PI) / 180;
    const lat2 = (next.lat * Math.PI) / 180;
    const deltaLon = ((next.lon - current.lon) * Math.PI) / 180;
    area += deltaLon * (2 + Math.sin(lat1) + Math.sin(lat2));
  }
  return (Math.abs((area * radius * radius) / 2) / 10_000);
}

export function describeNdvi(value: number | null): string {
  if (value === null) return "No valid pixels were available inside this boundary.";
  if (value >= 0.65) return "High vegetation greenness signal";
  if (value >= 0.4) return "Moderate vegetation greenness signal";
  if (value >= 0.2) return "Low vegetation greenness signal";
  return "Sparse vegetation or mostly non-vegetated surface";
}

export function describeNdmi(value: number | null): string {
  if (value === null) return "No valid pixels were available inside this boundary.";
  if (value >= 0.3) return "Relatively high canopy-moisture signal";
  if (value >= 0.1) return "Intermediate canopy-moisture signal";
  if (value >= 0) return "Relatively low canopy-moisture signal";
  return "Very low or negative canopy-moisture signal";
}
