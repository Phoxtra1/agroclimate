export interface HandlerGpsFix {
  lat: number;
  lon: number;
}

const MAX_GPS_FUTURE_SKEW_MS = 5 * 60 * 1000;
const MAX_GPS_AGE_MS = 10 * 60 * 1000;

/** Validate optional browser GPS before attaching it to a Farm Handler attendance event. */
export function validateHandlerGpsFix(
  latitude: number,
  longitude: number,
  accuracy: number,
  timestamp: number,
  now = Date.now(),
): HandlerGpsFix | null {
  if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90) return null;
  if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180) return null;
  if (!Number.isFinite(accuracy) || accuracy <= 0) return null;
  if (!Number.isFinite(timestamp) || timestamp > now + MAX_GPS_FUTURE_SKEW_MS || now - timestamp > MAX_GPS_AGE_MS) return null;
  return { lat: latitude, lon: longitude };
}
