const FRESH_MS = 15 * 60 * 1000;
const STALE_MS = 6 * 60 * 60 * 1000;

export function createWeatherProvider(fetcher: typeof fetch = fetch, now = Date.now) {
  const cache = new Map<string, { fetchedAt: string; realtime: unknown; forecast: unknown }>();
  const pending = new Map<string, Promise<unknown>>();
  let retryAt = 0;

  function fallback(key: string, reason: string) {
    const saved = cache.get(key);
    const usable = saved && now() - Date.parse(saved.fetchedAt) <= STALE_MS;
    return {
      provider: "Tomorrow.io", status: usable ? "cached" : "unavailable",
      ...(usable ? saved : { fetchedAt: null, realtime: null, forecast: null }),
      message: reason, retryAt: new Date(Math.max(now() + 60000, retryAt)).toISOString(),
    };
  }

  async function load(lat: number, lon: number, apiKey: string) {
    const key = `${lat.toFixed(3)},${lon.toFixed(3)}`;
    const saved = cache.get(key);
    if (saved && now() - Date.parse(saved.fetchedAt) < FRESH_MS) {
      return { provider: "Tomorrow.io", status: "cached", ...saved };
    }
    if (retryAt > now()) return fallback(key, "Weather provider is rate limited. Please retry later.");
    const existing = pending.get(key);
    if (existing) return existing;
    const work = (async () => {
      async function request(path: string) {
        const url = new URL(`https://api.tomorrow.io/v4/weather/${path}`);
        url.searchParams.set("location", `${lat},${lon}`);
        url.searchParams.set("units", "metric");
        url.searchParams.set("apikey", apiKey);
        if (path === "forecast") url.searchParams.set("timesteps", "1d");
        try {
          const response = await fetcher(url, { signal: AbortSignal.timeout(15000) });
          if (response.status === 429) {
            const header = response.headers.get("Retry-After");
            const seconds = header === null ? NaN : Number(header);
            const delay = Number.isFinite(seconds) ? seconds * 1000 : Date.parse(header || "") - now();
            retryAt = Math.max(retryAt, now() + Math.min(3600000, Math.max(60000, Number.isFinite(delay) ? delay : 60000)));
          }
          if (!response.ok) return null;
          return await response.json();
        } catch {
          return null;
        }
      }
      const [realtime, forecast] = await Promise.all([request("realtime"), request("forecast")]);
      const validRealtime = typeof realtime?.data?.values?.temperature === "number" &&
        Number.isFinite(realtime.data.values.temperature) && Number.isFinite(Date.parse(realtime?.data?.time));
      const validForecast = Array.isArray(forecast?.timelines?.daily) && forecast.timelines.daily.some(
        (day: { time?: string; values?: { temperatureMax?: number; temperatureMin?: number } }) =>
          Number.isFinite(Date.parse(day.time || "")) && Number.isFinite(day.values?.temperatureMax) && Number.isFinite(day.values?.temperatureMin),
      );
      if (!validRealtime && !validForecast) return fallback(key, retryAt > now()
        ? "Weather provider is rate limited. Please retry later." : "Weather data is temporarily unavailable.");
      const result = { fetchedAt: new Date(now()).toISOString(), realtime: validRealtime ? realtime : null, forecast: validForecast ? forecast : null };
      if (cache.size >= 100 && !cache.has(key)) cache.delete(cache.keys().next().value ?? "");
      cache.set(key, result);
      return { provider: "Tomorrow.io", status: validRealtime && validForecast ? "live" : "partial", ...result,
        ...(!validForecast ? { message: "Daily forecast is unavailable; showing current conditions only." } : {}) };
    })();
    pending.set(key, work);
    try { return await work; } finally { pending.delete(key); }
  }
  return { load };
}