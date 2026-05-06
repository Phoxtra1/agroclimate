import { useEffect, useMemo, useRef, useState } from "react";
import { MapContainer, TileLayer, Marker, Popup, Polyline, Polygon, CircleMarker, Circle, LayersControl, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Anchor, AlertTriangle, MapPin, Navigation, LifeBuoy, Layers, Loader2, Cloud, Route as RouteIcon } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useGeolocation } from "@/hooks/useGeolocation";
import { useWeather } from "@/hooks/useWeather";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { floodRisk } from "@/lib/riskEngine";

// Fix Leaflet default marker icons in Vite
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

// Volta Basin (simplified visual ring)
const VOLTA_BASIN: [number, number][] = [
  [9.5, -1.5], [9.0, -0.4], [7.8, 0.0], [6.5, 0.1], [6.0, -0.2], [6.6, -1.2], [8.2, -1.6], [9.5, -1.5],
];

// Known flood-prone zones around the basin (used to seed heatmap density)
const FLOOD_ZONES: { name: string; coords: [number, number][]; centre: [number, number] }[] = [
  { name: "Lower Volta floodplain", coords: [[6.4, 0.2], [6.0, 0.3], [5.9, -0.1], [6.3, -0.1], [6.4, 0.2]], centre: [6.15, 0.05] },
  { name: "White Volta corridor", coords: [[10.4, -0.9], [9.8, -0.7], [9.6, -1.2], [10.2, -1.3], [10.4, -0.9]], centre: [10.0, -1.0] },
  { name: "Black Volta floodplain", coords: [[9.0, -2.6], [8.4, -2.3], [8.2, -2.9], [8.8, -3.0], [9.0, -2.6]], centre: [8.6, -2.7] },
];

function FlyTo({ lat, lon }: { lat: number; lon: number }) {
  const map = useMap();
  useEffect(() => { map.flyTo([lat, lon], 8, { duration: 1.2 }); }, [lat, lon, map]);
  return null;
}

interface FarmPoint { id: string; lat: number; lon: number; name: string; }

// Lightweight heatmap simulation: cluster of CircleMarkers around hot zones, intensity = day rainProb.
function buildHeatPoints(forecast: { rainProb: number }[], userLat: number, userLon: number) {
  // For each of next 7 days produce points around flood zones + user location with intensity scaled to rainProb.
  const days = forecast.slice(0, 7);
  const dayPoints: { lat: number; lon: number; intensity: number; day: number; rainProb: number }[][] = [];
  days.forEach((d, dayIdx) => {
    const intensity = Math.min(1, (d.rainProb || 0) / 100);
    const points: { lat: number; lon: number; intensity: number; day: number; rainProb: number }[] = [];
    const zones = [...FLOOD_ZONES.map((z) => z.centre), [userLat, userLon] as [number, number]];
    zones.forEach(([lat, lon]) => {
      // 6 jittered points per zone
      for (let i = 0; i < 6; i++) {
        const dLat = (Math.sin(i * 1.7 + dayIdx) * 0.18) * (0.4 + intensity);
        const dLon = (Math.cos(i * 1.3 + dayIdx) * 0.18) * (0.4 + intensity);
        points.push({ lat: lat + dLat, lon: lon + dLon, intensity, day: dayIdx, rainProb: d.rainProb || 0 });
      }
    });
    dayPoints.push(points);
  });
  return dayPoints;
}

function heatColor(intensity: number) {
  // green -> yellow -> orange -> red gradient
  if (intensity < 0.25) return "#16a34a";
  if (intensity < 0.5) return "#facc15";
  if (intensity < 0.75) return "#f97316";
  return "#dc2626";
}

export default function AGNav() {
  const { user } = useAuth();
  const { position } = useGeolocation();
  const { forecast } = useWeather(position.lat, position.lon);
  const [showWeather, setShowWeather] = useState(true);
  const [showRisk, setShowRisk] = useState(true);
  const [showFarms, setShowFarms] = useState(true);
  const [showBoats, setShowBoats] = useState(true);
  const [showHeat, setShowHeat] = useState(true);
  const [heatDay, setHeatDay] = useState(0);
  const [farms, setFarms] = useState<FarmPoint[]>([]);
  const [boatTrail, setBoatTrail] = useState<[number, number][]>([]);
  const [routeFarmId, setRouteFarmId] = useState<string>("");
  const [route, setRoute] = useState<[number, number][]>([]);
  const [routeMeta, setRouteMeta] = useState<{ distance: number; duration: number } | null>(null);
  const [routeBusy, setRouteBusy] = useState(false);
  const [sosBusy, setSosBusy] = useState(false);
  const watchIdRef = useRef<number | null>(null);

  const today = forecast?.[0];
  const fr = floodRisk({ rainProb: today?.rainProb, humidity: today?.humidity, riverLevelPct: 60 });

  useEffect(() => {
    supabase.from("farm_qr_codes").select("id,farm_name,farm_location").limit(100).then(({ data }) => {
      const items = (data || []).flatMap((r: any) => {
        const loc = String(r.farm_location || "");
        const m = loc.match(/(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)/);
        if (!m) return [];
        return [{ id: r.id, name: r.farm_name, lat: parseFloat(m[1]), lon: parseFloat(m[2]) }];
      });
      setFarms(items);
    });
  }, []);

  useEffect(() => {
    if (!showBoats || !navigator.geolocation) return;
    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => setBoatTrail((p) => [...p.slice(-200), [pos.coords.latitude, pos.coords.longitude]]),
      () => {},
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 10000 },
    );
    return () => { if (watchIdRef.current !== null) navigator.geolocation.clearWatch(watchIdRef.current); };
  }, [showBoats]);

  const heatLayers = useMemo(
    () => buildHeatPoints(forecast || [], position.lat || 7.95, position.lon || -1.03),
    [forecast, position.lat, position.lon],
  );

  // Real water route via OSRM public demo endpoint (road graph proxies for rivers/coastal navigation in coverage areas).
  const computeRoute = async () => {
    const farm = farms.find((f) => f.id === routeFarmId);
    if (!farm) { toast.error("Pick a destination farm first"); return; }
    if (!position.lat || !position.lon) { toast.error("Location unavailable"); return; }
    setRouteBusy(true);
    try {
      const url = `https://router.project-osrm.org/route/v1/driving/${position.lon},${position.lat};${farm.lon},${farm.lat}?overview=full&geometries=geojson`;
      const res = await fetch(url);
      const json = await res.json();
      const coords = json?.routes?.[0]?.geometry?.coordinates;
      if (!coords?.length) throw new Error("No route found");
      setRoute(coords.map((c: number[]) => [c[1], c[0]] as [number, number]));
      setRouteMeta({ distance: json.routes[0].distance, duration: json.routes[0].duration });
      toast.success("Route computed");
    } catch (err: any) {
      toast.error(err.message || "Routing failed");
    } finally { setRouteBusy(false); }
  };

  const triggerSOS = async () => {
    if (!user) { toast.error("Sign in to send SOS"); return; }
    setSosBusy(true);
    try {
      navigator.geolocation.getCurrentPosition(async (pos) => {
        const { error } = await supabase.from("disaster_alerts").insert({
          title: "SOS — User in distress",
          alert_type: "sos",
          severity: "critical",
          description: `User ${user.email} requested help at ${pos.coords.latitude.toFixed(5)}, ${pos.coords.longitude.toFixed(5)}`,
          affected_regions: [`${pos.coords.latitude.toFixed(2)},${pos.coords.longitude.toFixed(2)}`],
          created_by: user.id,
          active: true,
        });
        if (error) toast.error(error.message);
        else toast.success("SOS broadcast sent");
        setSosBusy(false);
      }, () => { toast.error("Location unavailable"); setSosBusy(false); });
    } catch { setSosBusy(false); }
  };

  const center: [number, number] = [position.lat || 7.95, position.lon || -1.03];

  return (
    <div className="p-4 lg:p-6 max-w-7xl mx-auto space-y-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><Anchor className="h-6 w-6 text-primary" /> AGNav — Water Transport Navigator</h1>
          <p className="text-sm text-muted-foreground">7-day flood-risk heatmap, water-route navigation and farm intelligence for the Volta basin.</p>
        </div>
        <Badge variant={fr.level === "critical" || fr.level === "high" ? "destructive" : "outline"} className="capitalize">
          <AlertTriangle className="h-3 w-3 mr-1" /> Flood risk today: {fr.level} ({fr.score})
        </Badge>
      </div>

      <Card>
        <CardContent className="p-3">
          <div className="flex flex-wrap items-center gap-4 mb-3">
            <div className="flex items-center gap-2"><Switch checked={showWeather} onCheckedChange={setShowWeather} id="w" /><Label htmlFor="w" className="text-xs flex items-center gap-1"><Cloud className="h-3.5 w-3.5" /> Weather</Label></div>
            <div className="flex items-center gap-2"><Switch checked={showRisk} onCheckedChange={setShowRisk} id="r" /><Label htmlFor="r" className="text-xs flex items-center gap-1"><AlertTriangle className="h-3.5 w-3.5" /> Risk zones</Label></div>
            <div className="flex items-center gap-2"><Switch checked={showHeat} onCheckedChange={setShowHeat} id="h" /><Label htmlFor="h" className="text-xs">Flood heatmap</Label></div>
            <div className="flex items-center gap-2"><Switch checked={showFarms} onCheckedChange={setShowFarms} id="f" /><Label htmlFor="f" className="text-xs flex items-center gap-1"><MapPin className="h-3.5 w-3.5" /> Farms</Label></div>
            <div className="flex items-center gap-2"><Switch checked={showBoats} onCheckedChange={setShowBoats} id="b" /><Label htmlFor="b" className="text-xs flex items-center gap-1"><Navigation className="h-3.5 w-3.5" /> Live track</Label></div>
            {showHeat && (
              <div className="flex items-center gap-2 text-xs">
                <Label className="text-xs">Day</Label>
                <Select value={String(heatDay)} onValueChange={(v) => setHeatDay(Number(v))}>
                  <SelectTrigger className="h-8 w-32"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(forecast || []).slice(0, 7).map((d: any, i: number) => (
                      <SelectItem key={i} value={String(i)}>{d.day || `D+${i}`} · {d.rainProb || 0}%</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="flex items-center gap-2 ml-auto"><Layers className="h-3.5 w-3.5 text-muted-foreground" /><span className="text-xs text-muted-foreground">Toggle base layer top-right</span></div>
          </div>

          {/* Routing controls */}
          <div className="flex flex-wrap items-center gap-2 mb-3">
            <RouteIcon className="h-4 w-4 text-primary" />
            <Label className="text-xs">Route to farm</Label>
            <Select value={routeFarmId} onValueChange={setRouteFarmId}>
              <SelectTrigger className="h-8 w-64"><SelectValue placeholder={farms.length ? "Pick a farm" : "No farms with GPS"} /></SelectTrigger>
              <SelectContent>
                {farms.map((f) => <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button size="sm" onClick={computeRoute} disabled={routeBusy || !routeFarmId}>
              {routeBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Compute route"}
            </Button>
            {routeMeta && (
              <span className="text-xs text-muted-foreground">
                ≈ {(routeMeta.distance / 1000).toFixed(1)} km · {(routeMeta.duration / 60).toFixed(0)} min
              </span>
            )}
            {route.length > 0 && <Button size="sm" variant="ghost" onClick={() => { setRoute([]); setRouteMeta(null); }}>Clear</Button>}
          </div>

          <div className="rounded-lg overflow-hidden border" style={{ height: "62vh", minHeight: 420 }}>
            <MapContainer center={center} zoom={7} scrollWheelZoom style={{ height: "100%", width: "100%" }}>
              <FlyTo lat={center[0]} lon={center[1]} />
              <LayersControl position="topright">
                <LayersControl.BaseLayer checked name="Streets">
                  <TileLayer attribution="&copy; OpenStreetMap" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                </LayersControl.BaseLayer>
                <LayersControl.BaseLayer name="Satellite">
                  <TileLayer attribution="Tiles © Esri" url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}" />
                </LayersControl.BaseLayer>
                <LayersControl.BaseLayer name="AGNav (terrain)">
                  <TileLayer attribution="© OpenTopoMap" url="https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png" />
                </LayersControl.BaseLayer>
              </LayersControl>

              <Polygon positions={VOLTA_BASIN} pathOptions={{ color: "#2563eb", weight: 1, fillOpacity: 0.05 }} />

              {showRisk && FLOOD_ZONES.map((z) => (
                <Polygon key={z.name} positions={z.coords} pathOptions={{ color: "#dc2626", fillColor: "#dc2626", fillOpacity: 0.15 }}>
                  <Popup>{z.name} — flood-prone</Popup>
                </Polygon>
              ))}

              {/* 7-day flood-risk heatmap (selected day) */}
              {showHeat && heatLayers[heatDay]?.map((p, i) => (
                <Circle
                  key={`h-${heatDay}-${i}`}
                  center={[p.lat, p.lon]}
                  radius={8000 + p.intensity * 14000}
                  pathOptions={{ color: heatColor(p.intensity), fillColor: heatColor(p.intensity), fillOpacity: 0.18 + p.intensity * 0.25, weight: 0 }}
                />
              ))}

              {showWeather && today && (
                <CircleMarker center={center} radius={Math.max(8, (today.rainProb || 0) / 5)}
                  pathOptions={{ color: "#0ea5e9", fillColor: "#0ea5e9", fillOpacity: 0.25 }}>
                  <Popup>Rain {today.rainProb}% · {today.tempLow}–{today.tempHigh}°C · {today.description}</Popup>
                </CircleMarker>
              )}

              <Marker position={center}><Popup>You are here · {position.locationName}</Popup></Marker>

              {showFarms && farms.map((f) => (
                <Marker key={f.id} position={[f.lat, f.lon]}><Popup>{f.name}</Popup></Marker>
              ))}

              {showBoats && boatTrail.length > 1 && (
                <Polyline positions={boatTrail} pathOptions={{ color: "#16a34a", weight: 3, dashArray: "4 6" }} />
              )}

              {/* Recommended water route */}
              {route.length > 1 && (
                <Polyline positions={route} pathOptions={{ color: "#2563eb", weight: 5, opacity: 0.85 }} />
              )}
            </MapContainer>
          </div>

          <div className="mt-3 flex items-center gap-2 flex-wrap">
            <Button variant="destructive" disabled={sosBusy} onClick={triggerSOS}>
              {sosBusy ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <LifeBuoy className="h-4 w-4 mr-1" />}
              SOS
            </Button>
            <span className="text-xs text-muted-foreground">{fr.rationale} — {fr.recommendations.join(" · ")}</span>
            <span className="text-[11px] text-muted-foreground ml-auto">Heatmap legend: <span className="inline-block h-2 w-2 rounded-full bg-green-600" /> low → <span className="inline-block h-2 w-2 rounded-full bg-yellow-400" /> mod → <span className="inline-block h-2 w-2 rounded-full bg-orange-500" /> high → <span className="inline-block h-2 w-2 rounded-full bg-red-600" /> critical</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
