import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { GeoJSON, MapContainer, Marker, Polygon, Popup, TileLayer, useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";
import { Activity, AlertCircle, CalendarDays, Cloud, Droplets, Layers, LocateFixed, Loader2, MapPin, Ruler, Satellite as SatelliteIcon, Search, Sprout, Waves, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import {
  calculatePolygonAreaHectares,
  describeNdmi,
  describeNdvi,
  getFieldIndexStatistics,
  getIndexAtPoint,
  getSentinelTileTemplate,
  searchSentinelScenes,
  type FieldIndexStatistics,
  type GeoPoint,
  type SentinelScene,
  type SpectralIndex,
} from "@/services/satellite/sentinel";
import "leaflet/dist/leaflet.css";

type Place = GeoPoint & { label: string };
type SatelliteField = Database["public"]["Tables"]["satellite_fields"]["Row"];
type SatelliteAlert = Database["public"]["Tables"]["satellite_field_alerts"]["Row"];
type ImageryLayer = "true-color" | "false-color" | SpectralIndex | "nasa-true" | "nasa-false" | "nasa-ndvi";

const layerOptions: { id: ImageryLayer; label: string; group: string }[] = [
  { id: "true-color", label: "Sentinel natural colour", group: "Sentinel-2 · 10 m" },
  { id: "false-color", label: "Sentinel vegetation false colour", group: "Sentinel-2 · 10 m" },
  { id: "ndvi", label: "NDVI · vegetation greenness", group: "Sentinel-2 · 10 m" },
  { id: "ndmi", label: "NDMI · canopy moisture signal", group: "Sentinel-2 · 20 m" },
  { id: "ndwi", label: "NDWI · surface water signal", group: "Sentinel-2 · 10 m" },
  { id: "nasa-true", label: "NASA natural colour (fallback)", group: "MODIS · broad scale" },
  { id: "nasa-false", label: "NASA false colour (fallback)", group: "MODIS · broad scale" },
  { id: "nasa-ndvi", label: "NASA NDVI (fallback)", group: "MODIS · 8-day composite" },
];

const marker = L.divIcon({
  className: "satellite-marker",
  html: '<div style="width:18px;height:18px;border:3px solid white;border-radius:50%;background:#16a34a;box-shadow:0 1px 8px #0008"></div>',
  iconSize: [18, 18],
  iconAnchor: [9, 9],
});
const fmtDate = (date: Date) => [date.getFullYear(), String(date.getMonth() + 1).padStart(2, "0"), String(date.getDate()).padStart(2, "0")].join("-");
const formatSceneDate = (value: string) => value ? new Date(value).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }) : "Date unavailable";
const nasaLayers: Record<string, string> = {
  "nasa-true": "MODIS_Terra_CorrectedReflectance_TrueColor",
  "nasa-false": "MODIS_Terra_CorrectedReflectance_Bands721",
  "nasa-ndvi": "MODIS_Terra_NDVI_8Day",
};

function Recenter({ place }: { place: Place }) {
  const map = useMap();
  useEffect(() => { map.flyTo([place.lat, place.lon], Math.max(8, map.getZoom()), { duration: 0.7 }); }, [map, place.lat, place.lon]);
  return null;
}

function MapInteraction({
  drawing,
  onMapClick,
  onSample,
}: {
  drawing: boolean;
  onMapClick: (point: GeoPoint) => void;
  onSample: (point: GeoPoint) => void;
}) {
  useMapEvents({
    click(event) {
      const point = { lat: event.latlng.lat, lon: event.latlng.lng };
      if (drawing) onMapClick(point);
      else onSample(point);
    },
  });
  return null;
}

function Stat({ label, value, help }: { label: string; value: string; help?: string }) {
  return <div className="rounded-lg bg-muted/50 p-3"><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 text-lg font-semibold tabular-nums">{value}</p>{help && <p className="mt-1 text-[11px] text-muted-foreground">{help}</p>}</div>;
}

export default function Satellite() {
  const [place, setPlace] = useState<Place>({ lat: 7.9465, lon: -1.0232, label: "Ghana" });
  const [query, setQuery] = useState("");
  const [layer, setLayer] = useState<ImageryLayer>("true-color");
  const [daysBack, setDaysBack] = useState("30");
  const [maxCloud, setMaxCloud] = useState("40");
  const [scenes, setScenes] = useState<SentinelScene[]>([]);
  const [sceneId, setSceneId] = useState("");
  const [tileTemplate, setTileTemplate] = useState("");
  const [sceneLoading, setSceneLoading] = useState(false);
  const [tileLoading, setTileLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState("");
  const [mapMessage, setMapMessage] = useState("");
  const [drawing, setDrawing] = useState(false);
  const [fieldPoints, setFieldPoints] = useState<GeoPoint[]>([]);
  const [fieldStats, setFieldStats] = useState<Partial<Record<SpectralIndex, FieldIndexStatistics>>>({});
  const [analysisLoading, setAnalysisLoading] = useState(false);
  const [sample, setSample] = useState<{ point: GeoPoint; values: Partial<Record<SpectralIndex, number | null>> } | null>(null);
  const [sampleLoading, setSampleLoading] = useState(false);
  const [analysisError, setAnalysisError] = useState("");
  const { user } = useAuth();
  const [fieldName, setFieldName] = useState("");
  const [savedFields, setSavedFields] = useState<SatelliteField[]>([]);
  const [savedAlerts, setSavedAlerts] = useState<SatelliteAlert[]>([]);
  const [savingField, setSavingField] = useState(false);

  const selectedScene = useMemo(() => scenes.find((scene) => scene.id === sceneId) ?? null, [scenes, sceneId]);
  const isNasa = layer.startsWith("nasa-");
  const maxDate = fmtDate(new Date(Date.now() - 86400000));
  const fieldArea = useMemo(() => calculatePolygonAreaHectares(fieldPoints), [fieldPoints]);
  const scenePoint = useMemo(() => ({ lat: place.lat, lon: place.lon }), [place.lat, place.lon]);
  const selectedLabel = layerOptions.find((option) => option.id === layer)?.label ?? "Satellite imagery";
  const nasaUrl = isNasa
    ? `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/${nasaLayers[layer]}/default/${maxDate}/GoogleMapsCompatible_Level9/{z}/{y}/{x}.jpg`
    : "";

  const resolvePlace = useCallback(async (point: GeoPoint, label = "Selected coordinates") => {
    setPlace({ ...point, label });
    setMapMessage("");
    setFieldPoints([]);
    setFieldStats({});
    setSample(null);
    try {
      const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${point.lat}&lon=${point.lon}`);
      if (response.ok) {
        const data = await response.json();
        const address = data.address ?? {};
        const name = data.name || [address.suburb, address.town, address.city, address.county, address.state, address.country].filter(Boolean).slice(0, 3).join(", ");
        if (name) setPlace({ ...point, label: name });
      }
    } catch {
      setMapMessage("Place-name lookup failed; the selected coordinates are still usable.");
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    setSceneLoading(true);
    setError("");
    setScenes([]);
    setSceneId("");
    setTileTemplate("");
    searchSentinelScenes({
      point: scenePoint,
      daysBack: Number(daysBack),
      maxCloudCover: Number(maxCloud),
      signal: controller.signal,
    }).then((results) => {
      setScenes(results);
      setSceneId(results[0]?.id ?? "");
      if (!results.length) setMapMessage("No Sentinel-2 scene matched this point, date window and cloud filter. Try a longer date range or a higher cloud threshold; NASA layers remain available for regional context.");
    }).catch((reason: unknown) => {
      if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : "Sentinel scene search failed.");
    }).finally(() => {
      if (!controller.signal.aborted) setSceneLoading(false);
    });
    return () => controller.abort();
  }, [scenePoint, daysBack, maxCloud]);

  useEffect(() => {
    if (!selectedScene || isNasa) {
      setTileTemplate("");
      return;
    }
    const controller = new AbortController();
    setTileLoading(true);
    setError("");
    getSentinelTileTemplate(selectedScene.itemUrl, layer as "true-color" | "false-color" | SpectralIndex, controller.signal)
      .then(setTileTemplate)
      .catch((reason: unknown) => {
        if (!controller.signal.aborted) {
          setTileTemplate("");
          setError(reason instanceof Error ? reason.message : "Could not load Sentinel imagery.");
        }
      })
      .finally(() => { if (!controller.signal.aborted) setTileLoading(false); });
    return () => controller.abort();
  }, [selectedScene, layer, isNasa]);

  const search = async (event: FormEvent) => {
    event.preventDefault();
    const value = query.trim();
    if (!value) return;
    setError("");
    const coordinates = value.match(/^(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)$/);
    if (coordinates) {
      const lat = Number(coordinates[1]);
      const lon = Number(coordinates[2]);
      if (lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180) {
        await resolvePlace({ lat, lon }, "Coordinate search");
        setQuery("");
        return;
      }
    }
    setBusy(true);
    try {
      const response = await fetch(`https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&q=${encodeURIComponent(value)}`);
      if (!response.ok) throw new Error("Location search is temporarily unavailable.");
      const results = await response.json();
      if (!results.length) throw new Error("No matching place found. Try a town, district, region or coordinates.");
      await resolvePlace({ lat: Number(results[0].lat), lon: Number(results[0].lon) }, results[0].display_name);
      setQuery("");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Location search failed.");
    } finally {
      setBusy(false);
    }
  };

  const locate = () => {
    if (!navigator.geolocation) { setError("Geolocation is not supported by this browser."); return; }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => { void resolvePlace({ lat: position.coords.latitude, lon: position.coords.longitude }, "Your location"); setLocating(false); },
      () => { setError("Could not access your location. Check browser permission or search for a place."); setLocating(false); },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 },
    );
  };

  const runFieldAnalysis = async () => {
    if (!selectedScene || fieldPoints.length < 3) return;
    setAnalysisLoading(true);
    setAnalysisError("");
    const geometry: GeoJSON.Polygon = {
      type: "Polygon",
      coordinates: [[...fieldPoints.map((point) => [point.lon, point.lat]), [fieldPoints[0].lon, fieldPoints[0].lat]]],
    };
    try {
      const [ndvi, ndmi, ndwi] = await Promise.all([
        getFieldIndexStatistics(selectedScene.itemUrl, geometry, "ndvi"),
        getFieldIndexStatistics(selectedScene.itemUrl, geometry, "ndmi"),
        getFieldIndexStatistics(selectedScene.itemUrl, geometry, "ndwi"),
      ]);
      setFieldStats({ ndvi, ndmi, ndwi });
    } catch (reason) {
      setAnalysisError(reason instanceof Error ? reason.message : "Field analysis could not be completed.");
    } finally {
      setAnalysisLoading(false);
    }
  };

  const inspectPoint = async (point: GeoPoint) => {
    if (!selectedScene || isNasa || drawing) return;
    setSampleLoading(true);
    setSample({ point, values: {} });
    try {
      const indices: SpectralIndex[] = ["ndvi", "ndmi", "ndwi"];
      const entries = await Promise.all(indices.map(async (index) => [index, await getIndexAtPoint(selectedScene.itemUrl, point, index)] as const));
      setSample({ point, values: Object.fromEntries(entries) });
    } catch (reason) {
      setAnalysisError(reason instanceof Error ? reason.message : "Pixel sampling failed.");
    } finally {
      setSampleLoading(false);
    }
  };

  const addFieldPoint = (point: GeoPoint) => {
    setFieldPoints((previous) => [...previous, point]);
    setFieldStats({});
    setAnalysisError("");
  };


  const refreshSavedFields = useCallback(async () => {
    if (!user) return;
    const { data, error: fieldsError } = await supabase
      .from("satellite_fields")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    if (fieldsError) {
      console.error("Could not load monitored fields:", fieldsError.message);
      return;
    }
    const fields = data ?? [];
    setSavedFields(fields);
    if (fields.length) {
      const { data: alerts } = await supabase
        .from("satellite_field_alerts")
        .select("*")
        .in("field_id", fields.map((field) => field.id))
        .order("created_at", { ascending: false })
        .limit(20);
      setSavedAlerts(alerts ?? []);
    } else {
      setSavedAlerts([]);
    }
  }, [user]);

  useEffect(() => {
    void refreshSavedFields();
  }, [refreshSavedFields]);

  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(`satellite-field-alerts-${user.id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "satellite_field_alerts" }, (payload) => {
        const alert = payload.new as SatelliteAlert;
        setSavedAlerts((previous) => [alert, ...previous.filter((item) => item.id !== alert.id)].slice(0, 20));
        toast(alert.title || "Satellite crop alert", { description: alert.message || "A change was detected in one of your monitored fields." });
        void refreshSavedFields();
      })
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [user, refreshSavedFields]);

  const saveFieldForMonitoring = async () => {
    if (!user || fieldPoints.length < 3) return;
    const name = fieldName.trim();
    if (name.length < 2) {
      toast.error("Enter a field name before saving.");
      return;
    }
    setSavingField(true);
    const geometry: GeoJSON.Polygon = {
      type: "Polygon",
      coordinates: [[...fieldPoints.map((point) => [point.lon, point.lat]), [fieldPoints[0].lon, fieldPoints[0].lat]]],
    };
    const { error: saveError } = await supabase.from("satellite_fields").insert({
      user_id: user.id,
      name,
      field_geojson: geometry as unknown as Database["public"]["Tables"]["satellite_fields"]["Insert"]["field_geojson"],
      area_hectares: fieldArea,
      monitoring_enabled: true,
      max_cloud_cover: Number(maxCloud),
      ndvi_drop_threshold: 0.15,
    });
    if (saveError) {
      toast.error(`Could not save monitored field: ${saveError.message}`);
    } else {
      toast.success(`${name} saved for satellite monitoring`);
      setFieldName("");
      setFieldPoints([]);
      setDrawing(false);
      await refreshSavedFields();
    }
    setSavingField(false);
  };

  const loadSavedBoundary = (field: SatelliteField) => {
    const geometry = field.field_geojson as unknown as GeoJSON.Polygon;
    const coordinates = geometry.coordinates?.[0];
    if (!Array.isArray(coordinates)) return;
    setFieldPoints(coordinates.slice(0, -1).map((position) => ({ lat: position[1], lon: position[0] })));
    setPlace((previous) => ({ ...previous, label: field.name }));
    setFieldStats({});
    setAnalysisError("");
  };

  const toggleFieldMonitoring = async (field: SatelliteField) => {
    const next = !field.monitoring_enabled;
    const { error: updateError } = await supabase
      .from("satellite_fields")
      .update({ monitoring_enabled: next })
      .eq("id", field.id)
      .eq("user_id", user?.id);
    if (updateError) toast.error(updateError.message);
    else {
      toast.success(next ? "Field monitoring enabled" : "Field monitoring paused");
      await refreshSavedFields();
    }
  };

  const updateAlertStatus = async (alert: SatelliteAlert, status: "acknowledged" | "resolved") => {
    const { error: updateError } = await supabase
      .from("satellite_field_alerts")
      .update({ status })
      .eq("id", alert.id);
    if (updateError) toast.error(updateError.message);
    else setSavedAlerts((previous) => previous.map((item) => item.id === alert.id ? { ...item, status } : item));
  };

  const ndviMean = fieldStats.ndvi?.mean ?? null;
  const ndmiMean = fieldStats.ndmi?.mean ?? null;

  return <div className="space-y-5 pb-8">
    <header className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-3">
        <div className="rounded-xl bg-emerald-100 p-2 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"><SatelliteIcon className="h-6 w-6" /></div>
        <div><h1 className="text-2xl font-bold">Satellite</h1><p className="text-sm text-muted-foreground">Sentinel-2 crop observation and field-level spectral analysis</p></div>
      </div>
      <div className="flex flex-wrap gap-2"><Badge variant="outline">Free / open data</Badge><Badge variant="secondary">Sentinel-2 · 10–20 m</Badge></div>
    </header>

    <form onSubmit={search} className="flex flex-col gap-2 sm:flex-row">
      <div className="relative flex-1"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search farm, town, district, region or coordinates…" className="h-11 pl-9" aria-label="Search location" /></div>
      <Button disabled={busy || !query.trim()} className="h-11 gap-2">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />} Search</Button>
      <Button type="button" variant="outline" onClick={locate} disabled={locating} className="h-11 gap-2">{locating ? <Loader2 className="h-4 w-4 animate-spin" /> : <LocateFixed className="h-4 w-4" />} My location</Button>
    </form>

    {error && <div role="alert" className="flex gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive"><AlertCircle className="h-4 w-4 shrink-0" />{error}</div>}

    <section className="overflow-hidden rounded-2xl border bg-card shadow-sm">
      <div className="flex flex-col justify-between gap-3 border-b p-3 xl:flex-row xl:items-center">
        <div className="min-w-0"><div className="flex items-center gap-2 text-sm font-semibold"><MapPin className="h-4 w-4 text-emerald-600" /><span className="truncate">{place.label}</span></div><p className="pl-6 text-xs text-muted-foreground">{place.lat.toFixed(5)}, {place.lon.toFixed(5)} · {selectedScene ? formatSceneDate(selectedScene.acquiredAt) : "Searching available imagery"}</p></div>
        <div className="flex flex-wrap gap-2">
          <label className="flex h-9 items-center gap-2 rounded-md border px-2 text-xs"><Layers className="h-3.5 w-3.5" /><select aria-label="Imagery layer" value={layer} onChange={(event) => setLayer(event.target.value as ImageryLayer)} className="max-w-[220px] bg-transparent outline-none">{layerOptions.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}</select></label>
          <label className="flex h-9 items-center gap-2 rounded-md border px-2 text-xs"><CalendarDays className="h-3.5 w-3.5" /><select aria-label="Scene date range" value={daysBack} onChange={(event) => setDaysBack(event.target.value)} className="bg-transparent outline-none"><option value="15">Last 15 days</option><option value="30">Last 30 days</option><option value="60">Last 60 days</option><option value="90">Last 90 days</option><option value="180">Last 180 days</option></select></label>
          <label className="flex h-9 items-center gap-2 rounded-md border px-2 text-xs"><Cloud className="h-3.5 w-3.5" /><select aria-label="Maximum cloud cover" value={maxCloud} onChange={(event) => setMaxCloud(event.target.value)} className="bg-transparent outline-none"><option value="10">Cloud ≤10%</option><option value="20">Cloud ≤20%</option><option value="40">Cloud ≤40%</option><option value="60">Cloud ≤60%</option><option value="80">Cloud ≤80%</option><option value="100">Any cloud cover</option></select></label>
        </div>
      </div>
      <div className="grid gap-0 lg:grid-cols-[minmax(0,1fr)_280px]">
        <div className="relative h-[440px] w-full bg-slate-900 sm:h-[560px]">
          <MapContainer center={[place.lat, place.lon]} zoom={8} scrollWheelZoom className="h-full w-full">
            {isNasa ? <TileLayer key={nasaUrl} url={nasaUrl} maxZoom={9} attribution='Imagery: <a href="https://earthdata.nasa.gov/">NASA GIBS / Earthdata</a>' eventHandlers={{ tileerror: () => setMapMessage("Some NASA tiles failed to load. Try another fallback layer.") }} /> : tileTemplate ? <TileLayer key={tileTemplate} url={tileTemplate} maxZoom={18} attribution='Sentinel-2 data: <a href="https://registry.opendata.aws/sentinel-2/">AWS Open Data</a> · Rendering: <a href="https://titiler.xyz/">TiTiler</a>' eventHandlers={{ tileerror: () => setMapMessage("Some Sentinel-2 tiles failed to load. Try another scene or NASA context layer.") }} /> : null}
            <Recenter place={place} />
            <MapInteraction drawing={drawing} onMapClick={addFieldPoint} onSample={(point) => void inspectPoint(point)} />
            <Marker position={[place.lat, place.lon]} icon={marker}><Popup>{place.label}<br />{place.lat.toFixed(5)}, {place.lon.toFixed(5)}</Popup></Marker>
            {selectedScene?.geometry && <GeoJSON key={selectedScene.id} data={selectedScene.geometry as GeoJSON.GeoJsonObject} style={{ color: "#38bdf8", weight: 1, fillOpacity: 0.04 }} />}
            {savedFields.filter((field) => field.monitoring_enabled).map((field) => <GeoJSON key={field.id} data={field.field_geojson as unknown as GeoJSON.GeoJsonObject} style={{ color: "#a3e635", weight: 2, fillOpacity: 0.08, dashArray: "5 4" }} />)}
            {fieldPoints.length > 0 && <Polygon positions={fieldPoints.map((point) => [point.lat, point.lon] as [number, number])} pathOptions={{ color: "#f59e0b", weight: 3, fillOpacity: 0.15 }} />}
            {fieldPoints.map((point, index) => <Marker key={index} position={[point.lat, point.lon]}><Popup>Field boundary point {index + 1}</Popup></Marker>)}
          </MapContainer>
          {(sceneLoading || tileLoading) && <div className="absolute left-3 top-3 z-[500] flex items-center gap-2 rounded-lg bg-background/95 px-3 py-2 text-xs shadow"><Loader2 className="h-3.5 w-3.5 animate-spin" />{sceneLoading ? "Searching Sentinel scenes…" : "Preparing imagery tiles…"}</div>}
          {drawing && <div className="absolute bottom-3 left-3 right-3 z-[500] rounded-lg bg-background/95 p-2 text-xs shadow">Field boundary drawing is active. Click at least 3 corners on the map, then select “Analyse field”.</div>}
        </div>
        <aside className="space-y-4 border-t p-3 lg:border-l lg:border-t-0">
          <div><h2 className="flex items-center gap-2 text-sm font-semibold"><Layers className="h-4 w-4" /> Available Sentinel scenes</h2><p className="mt-1 text-xs text-muted-foreground">Cloud-filtered scenes intersecting the selected point</p></div>
          {sceneLoading ? <div className="flex items-center gap-2 py-3 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Searching open catalogue…</div> : scenes.length ? <div className="space-y-2">{scenes.slice(0, 8).map((scene) => <button key={scene.id} type="button" onClick={() => { setSceneId(scene.id); setFieldStats({}); setSample(null); }} className={`w-full rounded-lg border p-2 text-left text-xs transition hover:border-primary ${scene.id === sceneId ? "border-primary bg-primary/5" : ""}`}><div className="flex items-center justify-between gap-2"><span className="font-semibold">{formatSceneDate(scene.acquiredAt)}</span><Badge variant="outline">{scene.cloudCover === null ? "Cloud n/a" : `${scene.cloudCover.toFixed(0)}% cloud`}</Badge></div><p className="mt-1 truncate text-muted-foreground">{scene.id}</p></button>)}</div> : <p className="rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground">No scenes matched. Widen the date range or cloud threshold. Use NASA layers for broader context.</p>}
          <div className="rounded-lg bg-muted/40 p-3"><p className="text-xs font-semibold">{selectedLabel}</p><p className="mt-1 text-xs text-muted-foreground">{isNasa ? "NASA MODIS is useful for regional trends, not individual field assessment." : "Sentinel-2 Level-2A surface reflectance. Visible/NIR bands are 10 m; SWIR moisture band is 20 m."}</p></div>
          <div className="space-y-2">
            <Button type="button" variant={drawing ? "default" : "outline"} className="w-full gap-2" onClick={() => { setDrawing(!drawing); setFieldPoints([]); setFieldStats({}); setAnalysisError(""); }}><Ruler className="h-4 w-4" />{drawing ? "Stop drawing boundary" : "Draw field boundary"}</Button>
            {fieldPoints.length > 0 && <div className="flex items-center justify-between text-xs"><span>{fieldPoints.length} boundary points · {fieldArea.toFixed(2)} ha</span><button type="button" onClick={() => { setFieldPoints((points) => points.slice(0, -1)); setFieldStats({}); }} className="text-muted-foreground hover:text-foreground">Undo point</button></div>}
            <Button type="button" className="w-full gap-2" onClick={() => { setDrawing(false); void runFieldAnalysis(); }} disabled={!selectedScene || isNasa || fieldPoints.length < 3 || analysisLoading}>{analysisLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Activity className="h-4 w-4" />} Analyse field</Button>
            {fieldPoints.length > 0 && <Button type="button" variant="ghost" className="w-full gap-2" onClick={() => { setFieldPoints([]); setFieldStats({}); }}><X className="h-4 w-4" /> Clear boundary</Button>}
          </div>
          {analysisError && <p role="alert" className="text-xs text-destructive">{analysisError}</p>}
        </aside>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 border-t bg-muted/30 p-3"><div><p className="text-sm font-medium">{selectedLabel}</p><p className="text-xs text-muted-foreground">{selectedScene ? `${selectedScene.platform} · ${selectedScene.cloudCover === null ? "Cloud cover unavailable" : `${selectedScene.cloudCover.toFixed(1)}% scene cloud`}` : "Waiting for scene discovery"}</p></div><p className="text-xs text-muted-foreground">{isNasa ? "NASA GIBS context imagery" : selectedScene ? `Scene: ${selectedScene.id}` : "Sentinel-2 archive"}</p></div>
    </section>

    {mapMessage && <p className="text-xs text-muted-foreground">{mapMessage}</p>}


    <section className="space-y-4 rounded-2xl border bg-card p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div><h2 className="flex items-center gap-2 font-semibold"><Activity className="h-5 w-5 text-emerald-600" /> Automatic crop-stress monitoring</h2><p className="mt-1 text-xs text-muted-foreground">Save a field boundary once. AgroClimate checks new clear Sentinel-2 observations and alerts you when vegetation declines materially against that field’s own history.</p></div>
        <Badge variant="outline">Scheduled monitoring</Badge>
      </div>
      {fieldPoints.length >= 3 && <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
        <Input value={fieldName} onChange={(event) => setFieldName(event.target.value)} placeholder="Name this field (e.g. North maize plot)" aria-label="Field name" />
        <Button type="button" onClick={() => void saveFieldForMonitoring()} disabled={savingField || fieldName.trim().length < 2}>{savingField ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sprout className="mr-2 h-4 w-4" />}Save & monitor this field</Button>
      </div>}
      {savedFields.length === 0 ? <p className="rounded-lg bg-muted/40 p-3 text-sm text-muted-foreground">No monitored fields yet. Draw at least three boundary points on the map, enter a field name and save it to start building its satellite history.</p> : <div className="space-y-2">
        <div className="flex items-center justify-between"><h3 className="text-sm font-semibold">Your monitored fields</h3><span className="text-xs text-muted-foreground">{savedFields.filter((field) => field.monitoring_enabled).length} active</span></div>
        {savedFields.map((field) => <div key={field.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3">
          <div className="min-w-0"><p className="truncate text-sm font-medium">{field.name}</p><p className="text-xs text-muted-foreground">{Number(field.area_hectares || 0).toFixed(2)} ha · {field.monitoring_enabled ? "Monitoring active" : "Monitoring paused"} · {field.last_scene_at ? `Checked ${new Date(field.last_scene_at).toLocaleDateString()}` : "Building baseline"}</p></div>
          <div className="flex gap-2"><Button type="button" size="sm" variant="outline" onClick={() => loadSavedBoundary(field)}>Show boundary</Button><Button type="button" size="sm" variant={field.monitoring_enabled ? "secondary" : "default"} onClick={() => void toggleFieldMonitoring(field)}>{field.monitoring_enabled ? "Pause" : "Resume"}</Button></div>
        </div>)}
      </div>}
      <div className="space-y-2">
        <h3 className="text-sm font-semibold">Satellite change alerts</h3>
        {savedAlerts.length === 0 ? <p className="text-xs text-muted-foreground">No vegetation anomalies detected yet. New fields need at least three valid historical observations before the system can establish a baseline and issue a change alert.</p> : savedAlerts.map((alert) => <div key={alert.id} className="rounded-lg border p-3">
          <div className="flex flex-wrap items-center justify-between gap-2"><p className="text-sm font-semibold">{alert.title}</p><Badge variant={alert.severity === "high" ? "destructive" : "secondary"}>{alert.severity}</Badge></div>
          <p className="mt-1 text-xs text-muted-foreground">{alert.message}</p>
          <div className="mt-2 flex flex-wrap items-center justify-between gap-2"><span className="text-[11px] text-muted-foreground">Evidence score (heuristic): {alert.confidence}% · {new Date(alert.captured_at).toLocaleDateString()} · Status: {alert.status}</span><div className="flex gap-2">{alert.status === "open" && <Button type="button" size="sm" variant="outline" onClick={() => void updateAlertStatus(alert, "acknowledged")}>Acknowledge</Button>}{alert.status !== "resolved" && <Button type="button" size="sm" variant="ghost" onClick={() => void updateAlertStatus(alert, "resolved")}>Resolve</Button>}</div></div>
        </div>)}
      </div>
      <p className="text-[11px] text-muted-foreground">Alerts indicate unusual spectral change, not a confirmed disease diagnosis. Cloud percentage is scene-level, and the current monitor does not yet apply pixel-level cloud/shadow masking. Verify in the field before applying treatments.</p>
    </section>

    {fieldStats.ndvi && <section className="space-y-3 rounded-2xl border bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-2"><div><h2 className="flex items-center gap-2 font-semibold"><Sprout className="h-5 w-5 text-emerald-600" /> Field spectral summary</h2><p className="text-xs text-muted-foreground">Computed from valid Sentinel-2 pixels within your drawn polygon</p></div><Badge variant="outline">{fieldArea.toFixed(2)} hectares (approx.)</Badge></div>
      <div className="grid gap-3 sm:grid-cols-3">
        <Stat label="Mean NDVI" value={ndviMean === null ? "—" : ndviMean.toFixed(3)} help={describeNdvi(ndviMean)} />
        <Stat label="Mean NDMI" value={ndmiMean === null ? "—" : ndmiMean.toFixed(3)} help={describeNdmi(ndmiMean)} />
        <Stat label="Mean NDWI" value={fieldStats.ndwi?.mean == null ? "—" : fieldStats.ndwi.mean.toFixed(3)} help="Relative open-water / surface-water signal" />
      </div>
      <p className="text-xs text-muted-foreground">These are spectral indicators, not crop diagnoses. NDVI is affected by crop type, growth stage, soil background and cloud/shadow contamination. NDMI is a canopy-moisture proxy, not a direct soil-moisture measurement. NDWI is not a substitute for field water-level observations.</p>
    </section>}

    {sample && <section className="rounded-xl border bg-card p-4"><div className="flex items-center justify-between"><h2 className="font-semibold">Pixel inspection</h2>{sampleLoading && <Loader2 className="h-4 w-4 animate-spin" />}</div><p className="text-xs text-muted-foreground">{sample.point.lat.toFixed(5)}, {sample.point.lon.toFixed(5)} · Selected Sentinel scene</p><div className="mt-3 grid grid-cols-3 gap-2"><Stat label="NDVI" value={sample.values.ndvi == null ? "—" : sample.values.ndvi.toFixed(3)} /><Stat label="NDMI" value={sample.values.ndmi == null ? "—" : sample.values.ndmi.toFixed(3)} /><Stat label="NDWI" value={sample.values.ndwi == null ? "—" : sample.values.ndwi.toFixed(3)} /></div></section>}

    <div className="grid gap-3 md:grid-cols-2">
      <div className="rounded-xl border bg-card p-4"><h2 className="mb-2 flex items-center gap-2 font-semibold"><Activity className="h-4 w-4 text-emerald-600" /> What the indices mean</h2><ul className="space-y-2 text-sm text-muted-foreground"><li><strong className="text-foreground">NDVI:</strong> vegetation greenness and canopy density signal; useful for comparing areas and tracking change.</li><li><strong className="text-foreground">NDMI:</strong> canopy water-content sensitivity using NIR and SWIR; it is not soil moisture.</li><li><strong className="text-foreground">NDWI:</strong> highlights open-water / surface-water features; interpretation depends on the selected formula.</li></ul></div>
      <div className="rounded-xl border bg-card p-4"><h2 className="mb-2 flex items-center gap-2 font-semibold"><Droplets className="h-4 w-4 text-sky-600" /> Data quality and limitations</h2><p className="text-sm text-muted-foreground">Sentinel-2 scenes are archived observations, not live imagery. The catalogue cloud percentage describes the whole scene, not necessarily your field. Clouds, haze, shadows, mixed pixels, terrain and acquisition dates can affect results. Compare multiple clear observations and ground-truth before making irrigation, fertilizer or crop-protection decisions.</p><p className="mt-2 flex items-center gap-1 text-xs text-muted-foreground"><Waves className="h-3.5 w-3.5" /> Sentinel-2 visible/NIR bands: 10 m; SWIR: 20 m. MODIS fallback is much coarser.</p></div>
    </div>
    <p className="text-center text-[11px] text-muted-foreground">Sentinel-2 data: AWS Open Data / Element 84 Earth Search · Raster tiles and statistics: public TiTiler endpoint · Regional fallback: NASA GIBS · Map: Leaflet · Geocoding: OpenStreetMap Nominatim. Public endpoints are free to access but may impose fair-use limits or temporary availability restrictions.</p>
  </div>;
}
