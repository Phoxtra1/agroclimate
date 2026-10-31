export interface SatelliteLocationTarget {
  query?: string;
  lat?: number;
  lon?: number;
  label?: string;
  zoom?: number;
}

/** Build a validated deep link into AgroClimate's single shared Satellite workspace. */
export function buildSatelliteHref(target: SatelliteLocationTarget = {}): string {
  const params = new URLSearchParams();
  const query = target.query?.trim();
  if (query) params.set("q", query);

  const hasLat = target.lat !== undefined && target.lat !== null;
  const hasLon = target.lon !== undefined && target.lon !== null;
  if (hasLat !== hasLon) {
    throw new Error("Both latitude and longitude are required for a coordinate location.");
  }
  if (hasLat && hasLon) {
    const lat = Number(target.lat);
    const lon = Number(target.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lon) || lat < -90 || lat > 90 || lon < -180 || lon > 180) {
      throw new Error("The supplied Satellite coordinates are invalid.");
    }
    params.set("lat", lat.toFixed(6));
    params.set("lon", lon.toFixed(6));
  }

  const label = target.label?.trim();
  if (label) params.set("label", label);
  if (target.zoom !== undefined && Number.isFinite(target.zoom)) {
    params.set("zoom", String(Math.max(2, Math.min(22, Math.round(target.zoom)))));
  }

  const search = params.toString();
  return search ? `/satellite?${search}` : "/satellite";
}
