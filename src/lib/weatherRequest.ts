import { supabase } from "@/integrations/supabase/client";

const pending = new Map<string, ReturnType<typeof supabase.functions.invoke>>();
let retryAt = 0;

/** All screens share in-flight calls and the provider-wide cooldown. */
export async function requestWeather(lat: number, lon: number) {
  if (Date.now() < retryAt) return { data: { status: "unavailable", message: "Weather provider is temporarily unavailable. Please retry later.", retryAt: new Date(retryAt).toISOString() }, error: null };
  const key = `${lat.toFixed(3)},${lon.toFixed(3)}`;
  const existing = pending.get(key);
  if (existing) return existing;
  const work = supabase.functions.invoke("weather", { body: { lat, lon } });
  pending.set(key, work);
  try {
    const result = await work;
    if (result.error) retryAt = Date.now() + 60000;
    const providerRetryAt = Date.parse(result.data?.retryAt || "");
    if (Number.isFinite(providerRetryAt)) retryAt = Math.max(retryAt, providerRetryAt);
    return result;
  } finally { pending.delete(key); }
}