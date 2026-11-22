/** Only dated, same-day weather evidence may drive new decisions or notifications. */
export function weatherIsCurrent(days: readonly { isoDate?: string }[], now = Date.now()) {
  const time = Date.parse(days[0]?.isoDate || "");
  return Number.isFinite(time) && Math.abs(time - now) <= 24 * 60 * 60 * 1000;
}

export function requireCurrentWeather(days: readonly { isoDate?: string }[], now = Date.now()) {
  if (!weatherIsCurrent(days, now)) throw new Error("Current weather is unavailable. Retry after the provider recovers.");
}