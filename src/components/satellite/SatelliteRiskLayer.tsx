import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CircleMarker, Popup, useMap, useMapEvents } from "react-leaflet";
import { ChevronDown, ChevronUp, CloudRain, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSatelliteWeather } from "@/hooks/useSatelliteWeather";
import { assessSatelliteWeatherRisk, highestWeatherRisk, type SatelliteWeatherEvidence, type WeatherRiskLevel } from "@/services/satellite/weatherRisk";
import { assessLandClimate, type LandClimateAssessment } from "@/services/satellite/landSuitability";

const riskClass: Record<WeatherRiskLevel, string> = { low: "text-primary", moderate: "text-warning", high: "text-destructive", unavailable: "text-muted-foreground" };
const riskColor: Record<WeatherRiskLevel, string> = { low: "hsl(var(--primary))", moderate: "hsl(var(--warning))", high: "hsl(var(--destructive))", unavailable: "hsl(var(--muted-foreground))" };
const climateCache = new Map<string, LandClimateAssessment>();

export function SatelliteRiskLayer({ onEvidence }: { onEvidence: (evidence: SatelliteWeatherEvidence | null) => void }) {
  const map = useMap();
  const [point, setPoint] = useState(() => ({ lat: map.getCenter().lat, lon: map.getCenter().lng }));
  const [collapsed, setCollapsed] = useState(false);
  const [climate, setClimate] = useState<LandClimateAssessment | null>(null);
  const [climateError, setClimateError] = useState("");
  const timer = useRef<ReturnType<typeof setTimeout>>();
  const settle = useCallback(() => {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      const center = map.getCenter();
      setPoint({ lat: Number(center.lat.toFixed(3)), lon: Number(center.lng.toFixed(3)) });
    }, 1000);
  }, [map]);
  useMapEvents({ moveend: settle, zoomend: settle });
  useEffect(() => () => clearTimeout(timer.current), []);
  const weather = useSatelliteWeather(point.lat, point.lon);
  const risks = useMemo(() => assessSatelliteWeatherRisk(weather.evidence, weather.now), [weather.evidence, weather.now]);
  const level = highestWeatherRisk(risks);
  useEffect(() => { onEvidence(weather.fresh ? weather.evidence : null); }, [weather.evidence, weather.fresh, onEvidence]);
  useEffect(() => {
    const controller = new AbortController();
    const key = `${point.lat.toFixed(2)},${point.lon.toFixed(2)}`;
    setClimate(climateCache.get(key) ?? null);
    setClimateError("");
    if (!climateCache.has(key)) {
      void assessLandClimate(point, controller.signal).then(result => {
        if (controller.signal.aborted) return;
        if (climateCache.size >= 30) climateCache.clear();
        climateCache.set(key, result);
        setClimate(result);
      }).catch(() => { if (!controller.signal.aborted) setClimateError("Long-term climate data unavailable"); });
    }
    return () => controller.abort();
  }, [point.lat, point.lon]);

  return <>
    <CircleMarker center={[point.lat, point.lon]} radius={14} pathOptions={{ color: riskColor[level], fillColor: riskColor[level], fillOpacity: 0.25, weight: 3 }}>
      <Popup><strong>Weather risk · {level}</strong><p>{point.lat.toFixed(3)}, {point.lon.toFixed(3)}</p>{risks.map(risk => <p key={risk.key}>{risk.label}: {risk.level}<br />{risk.evidence}</p>)}<p>Point forecast screening, not a parcel hazard map.</p></Popup>
    </CircleMarker>
    <div className="satellite-risk-panel absolute bottom-8 left-2 z-[1000] max-h-[min(65vh,440px)] w-[min(300px,calc(100%-72px))] overflow-y-auto rounded-md border border-border bg-background text-foreground shadow-lg"
      onPointerDown={event => event.stopPropagation()} onDoubleClick={event => event.stopPropagation()} onWheel={event => event.stopPropagation()}>
      <div className="flex items-center gap-2 p-3">
        <CloudRain className="h-4 w-4 shrink-0 text-primary" />
        <div className="min-w-0 flex-1"><div className="text-xs font-semibold">Weather & environmental risk</div><div className={`text-xs capitalize ${riskClass[level]}`}>{weather.loading ? "Updating…" : `${level} weather exposure`}</div></div>
        <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" aria-label="Refresh risk data" title="Refresh risk data" disabled={weather.loading} onClick={weather.refresh}><RefreshCw className="h-3.5 w-3.5" /></Button>
        <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" aria-label={collapsed ? "Expand risk details" : "Collapse risk details"} onClick={() => setCollapsed(value => !value)}>{collapsed ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}</Button>
      </div>
      {!collapsed && <div className="space-y-2 border-t border-border p-3 text-xs">
        <p className="text-muted-foreground">Map centre · {point.lat.toFixed(3)}, {point.lon.toFixed(3)}</p>
        {weather.error && <p role="status" className="text-destructive">{weather.error}</p>}
        {weather.evidence && !weather.fresh && <p className="text-warning">Saved weather is stale; current risk levels withheld.</p>}
        {risks.map(risk => <div key={risk.key} className="border-b border-border pb-2"><div className="flex justify-between gap-2 font-medium"><span>{risk.label}</span><span className={`capitalize ${riskClass[risk.level]}`}>{risk.level}</span></div><p className="mt-1 text-muted-foreground">{risk.evidence}</p></div>)}
        <div><p className="font-medium">Long-term climate · NASA POWER</p><p className="mt-1 text-muted-foreground">{climate ? `${climate.annualMeanTemperatureC ?? "Unavailable"} °C mean · ${climate.estimatedAnnualRainfallMm ?? "Unavailable"} mm annual rainfall` : climateError || "Loading climate normals…"}</p><p className="mt-1 text-muted-foreground">Climate normals are not live conditions. Local soil, river and drainage measurements are not attached.</p></div>
        <p className="text-muted-foreground">Advisory thresholds · limited confidence · provider grid, not field-scale measurements</p>
        {weather.evidence && <p className="text-muted-foreground">{weather.evidence.provider} · fetched {new Date(weather.evidence.fetchedAt).toLocaleString()}<br />Observed {weather.evidence.observedAt ? new Date(weather.evidence.observedAt).toLocaleString() : "unavailable"}</p>}
      </div>}
    </div>
  </>;
}