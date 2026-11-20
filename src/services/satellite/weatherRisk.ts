export type WeatherRiskLevel = "low" | "moderate" | "high" | "unavailable";
export interface WeatherRiskSignal {
  key: string;
  label: string;
  level: WeatherRiskLevel;
  evidence: string;
}
export interface SatelliteWeatherEvidence {
  provider: string;
  fetchedAt: string;
  observedAt: string | null;
  temperatureC: number | null;
  windKmh: number | null;
  humidityPct: number | null;
  forecast: Array<{ time: string; maxC: number | null; rainMm: number | null; windKmh: number | null }>;
}

const numeric = (value: unknown): number | null => typeof value === "number" && Number.isFinite(value) ? value : null;
const timestamp = (value: unknown): string | null => typeof value === "string" && Number.isFinite(Date.parse(value)) ? value : null;

/** Read raw provider values; never use the dashboard's estimated soil/rain metrics. */
export function parseSatelliteWeather(payload: any): SatelliteWeatherEvidence {
  const values = payload?.realtime?.data?.values;
  const forecast = (Array.isArray(payload?.forecast?.timelines?.daily) ? payload.forecast.timelines.daily : [])
    .filter((day: any) => timestamp(day?.time))
    .slice(0, 7)
    .map((day: any) => ({
      time: day.time as string,
      maxC: numeric(day.values?.temperatureMax),
      rainMm: numeric(day.values?.rainAccumulationSum),
      windKmh: numeric(day.values?.windSpeedMax) === null ? null : day.values.windSpeedMax * 3.6,
    }));
  if (forecast.length === 0) throw new Error("No dated forecast was returned for this location.");
  const fetchedAt = timestamp(payload?.fetchedAt);
  if (!fetchedAt) throw new Error("Weather retrieval time is unavailable.");
  return {
    provider: typeof payload?.provider === "string" ? payload.provider : "Weather provider",
    fetchedAt,
    observedAt: timestamp(payload?.realtime?.data?.time),
    temperatureC: numeric(values?.temperature),
    windKmh: numeric(values?.windSpeed) === null ? null : values.windSpeed * 3.6,
    humidityPct: numeric(values?.humidity),
    forecast,
  };
}

export function weatherEvidenceIsFresh(evidence: SatelliteWeatherEvidence, now = Date.now()) {
  const age = now - Date.parse(evidence.fetchedAt);
  const firstDay = Date.parse(evidence.forecast[0]?.time ?? "");
  return age >= -300000 && age <= 30 * 60 * 1000 && Number.isFinite(firstDay) && Math.abs(firstDay - now) <= 36 * 60 * 60 * 1000;
}

/** Advisory screening thresholds, not calibrated flood/drought probabilities. */
export function assessSatelliteWeatherRisk(evidence: SatelliteWeatherEvidence | null, now = Date.now()): WeatherRiskSignal[] {
  const usable = evidence && weatherEvidenceIsFresh(evidence, now) ? evidence : null;
  const nextDays = usable?.forecast.slice(0, 3) ?? [];
  const maxima = (values: Array<number | null>) => {
    const valid = values.filter((value): value is number => value !== null);
    return valid.length ? Math.max(...valid) : null;
  };
  const temp = maxima(nextDays.map(day => day.maxC));
  const wind = maxima(nextDays.map(day => day.windKmh));
  const rain = maxima(nextDays.map(day => day.rainMm));
  const level = (value: number | null, moderate: number, high: number): WeatherRiskLevel =>
    value === null ? "unavailable" : value >= high ? "high" : value >= moderate ? "moderate" : "low";
  return [
    { key: "heat", label: "Heat exposure", level: level(temp, 32, 36), evidence: temp === null ? "Temperature forecast unavailable" : `Next 3 days: maximum ${temp.toFixed(1)} °C` },
    { key: "wind", label: "Wind exposure", level: level(wind, 25, 40), evidence: wind === null ? "Wind forecast unavailable" : `Next 3 days: maximum ${wind.toFixed(1)} km/h` },
    { key: "rain", label: "Heavy rain potential", level: level(rain, 20, 50), evidence: rain === null ? "Rain accumulation forecast unavailable" : `Next 3 days: maximum daily rainfall ${rain.toFixed(1)} mm` },
    { key: "flood", label: "Flood / landslide", level: "unavailable", evidence: "Local river level, terrain, drainage and soil saturation evidence required" },
  ];
}

export function highestWeatherRisk(signals: WeatherRiskSignal[]): WeatherRiskLevel {
  if (signals.some(signal => signal.level === "high")) return "high";
  if (signals.some(signal => signal.level === "moderate")) return "moderate";
  if (signals.some(signal => signal.level === "low")) return "low";
  return "unavailable";
}