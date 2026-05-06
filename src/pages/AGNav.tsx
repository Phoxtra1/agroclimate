import { useEffect, useMemo, useRef, useState } from "react";
import { MapContainer, TileLayer, Marker, Popup, Polyline, Polygon, CircleMarker, Circle, LayersControl, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Anchor, AlertTriangle, MapPin, Navigation, LifeBuoy, Layers, Loader2, Cloud,
  Route as RouteIcon, Search, Mic, MicOff, Volume2, VolumeX, Crosshair,
} from "lucide-react";
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

const VOLTA_BASIN: [number, number][] = [
  [9.5, -1.5], [9.0, -0.4], [7.8, 0.0], [6.5, 0.1], [6.0, -0.2], [6.6, -1.2], [8.2, -1.6], [9.5, -1.5],
];

const FLOOD_ZONES: { name: string; coords: [number, number][]; centre: [number, number] }[] = [
  { name: "Lower Volta floodplain", coords: [[6.4, 0.2], [6.0, 0.3], [5.9, -0.1], [6.3, -0.1], [6.4, 0.2]], centre: [6.15, 0.05] },
  { name: "White Volta corridor", coords: [[10.4, -0.9], [9.8, -0.7], [9.6, -1.2], [10.2, -1.3], [10.4, -0.9]], centre: [10.0, -1.0] },
  { name: "Black Volta floodplain", coords: [[9.0, -2.6], [8.4, -2.3], [8.2, -2.9], [8.8, -3.0], [9.0, -2.6]], centre: [8.6, -2.7] },
];

function FlyTo({ lat, lon, zoom = 8 }: { lat: number; lon: number; zoom?: number }) {
  const map = useMap();
  useEffect(() => { map.flyTo([lat, lon], zoom, { duration: 1.2 }); }, [lat, lon, zoom, map]);
  return null;
}

interface FarmPoint { id: string; lat: number; lon: number; name: string; }
interface Destination { lat: number; lon: number; label: string; }

function buildHeatPoints(forecast: { rainProb: number }[], userLat: number, userLon: number) {
  const days = forecast.slice(0, 7);
  const dayPoints: { lat: number; lon: number; intensity: number; day: number; rainProb: number }[][] = [];
  days.forEach((d, dayIdx) => {
    const intensity = Math.min(1, (d.rainProb || 0) / 100);
    const points: { lat: number; lon: number; intensity: number; day: number; rainProb: number }[] = [];
    const zones = [...FLOOD_ZONES.map((z) => z.centre), [userLat, userLon] as [number, number]];
    zones.forEach(([lat, lon]) => {
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
  if (intensity < 0.25) return "#16a34a";
  if (intensity < 0.5) return "#facc15";
  if (intensity < 0.75) return "#f97316";
  return "#dc2626";
}

// Try to parse "lat, lon" or "lat lon" coordinate strings before falling back to geocoder.
function parseCoords(text: string): { lat: number; lon: number } | null {
  const m = text.trim().match(/^\s*(-?\d+(?:\.\d+)?)\s*[, ]\s*(-?\d+(?:\.\d+)?)\s*$/);
  if (!m) return null;
  const lat = parseFloat(m[1]); const lon = parseFloat(m[2]);
  if (Math.abs(lat) > 90 || Math.abs(lon) > 180) return null;
  return { lat, lon };
}

// Speak short navigation cues using the Web Speech Synthesis API.
function speak(text: string, enabled: boolean) {
  if (!enabled || typeof window === "undefined" || !window.speechSynthesis) return;
  const u = new SpeechSynthesisUtterance(text);
  u.rate = 1; u.pitch = 1; u.lang = "en-US";
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(u);
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
  const [destination, setDestination] = useState<Destination | null>(null);
  const [searchText, setSearchText] = useState("");
  const [searchBusy, setSearchBusy] = useState(false);
  const [voiceOn, setVoiceOn] = useState(true);
  const [listening, setListening] = useState(false);
  const watchIdRef = useRef<number | null>(null);
  const recognitionRef = useRef<any>(null);

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

  // Free Nominatim geocoding for search by place name. Coordinates skip the round-trip.
  const geocode = async (text: string): Promise<Destination | null> => {
    const c = parseCoords(text);
    if (c) return { ...c, label: `${c.lat.toFixed(5)}, ${c.lon.toFixed(5)}` };
    const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(text)}`;
    const res = await fetch(url, { headers: { "Accept-Language": "en" } });
    const json = await res.json();
    if (!Array.isArray(json) || json.length === 0) return null;
    return { lat: parseFloat(json[0].lat), lon: parseFloat(json[0].lon), label: json[0].display_name };
  };

  const handleSearch = async (textOverride?: string) => {
    const text = (textOverride ?? searchText).trim();
    if (!text) { toast.error("Type a place, address or GPS coordinate"); return; }
    setSearchBusy(true);
    try {
      const dest = await geocode(text);
      if (!dest) { toast.error("No place found"); speak("No matching destination found", voiceOn); return; }
      setDestination(dest);
      setRoute([]); setRouteMeta(null);
      toast.success(`Destination set: ${dest.label}`);
      speak(`Destination set. ${dest.label.split(",")[0]}. Tap navigate to start.`, voiceOn);
    } catch (err: any) {
      toast.error(err.message || "Search failed");
    } finally { setSearchBusy(false); }
  };

  // Voice input via Web Speech Recognition (Chrome/Edge/Safari iOS).
  const toggleVoiceInput = () => {
    const SR: any = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) { toast.error("Voice input not supported in this browser"); return; }
    if (listening) { recognitionRef.current?.stop(); setListening(false); return; }
    const rec = new SR();
    rec.lang = "en-US"; rec.interimResults = false; rec.maxAlternatives = 1;
    rec.onresult = (e: any) => {
      const t = e.results[0][0].transcript;
      setSearchText(t);
      setListening(false);
      handleSearch(t);
    };
    rec.onerror = () => { setListening(false); toast.error("Voice input failed"); };
    rec.onend = () => setListening(false);
    recognitionRef.current = rec;
    rec.start();
    setListening(true);
    speak("Listening for destination", voiceOn);
  };

  const useCurrentAsDestination = () => {
    if (!position.lat || !position.lon) { toast.error("Location unavailable"); return; }
    setSearchText(`${position.lat.toFixed(5)}, ${position.lon.toFixed(5)}`);
  };

  // Compute route. Picks destination from search box first, then dropdown farm.
  const computeRoute = async () => {
    let target: { lat: number; lon: number; label: string } | null = destination;
    if (!target && routeFarmId) {
      const farm = farms.find((f) => f.id === routeFarmId);
      if (farm) target = { lat: farm.lat, lon: farm.lon, label: farm.name };
    }
    if (!target) { toast.error("Search a place or pick a destination farm first"); return; }
    if (!position.lat || !position.lon) { toast.error("Current location unavailable"); return; }
    setRouteBusy(true);
    try {
      const url = `https://router.project-osrm.org/route/v1/driving/${position.lon},${position.lat};${target.lon},${target.lat}?overview=full&geometries=geojson`;
      const res = await fetch(url);
      const json = await res.json();
      const coords = json?.routes?.[0]?.geometry?.coordinates;
      if (!coords?.length) throw new Error("No route found");
      setRoute(coords.map((c: number[]) => [c[1], c[0]] as [number, number]));
      setRouteMeta({ distance: json.routes[0].distance, duration: json.routes[0].duration });
      const km = (json.routes[0].distance / 1000).toFixed(1);
      const min = (json.routes[0].duration / 60).toFixed(0);
      toast.success(`Route ${km} km · ${min} min`);
      speak(`Route ready. ${km} kilometres. About ${min} minutes. ${fr.level === "high" || fr.level === "critical" ? "Caution: flood risk is " + fr.level + " on this corridor." : "Conditions look manageable."}`, voiceOn);
    } catch (err: any) {
      toast.error(err.message || "Routing failed");
      speak("Route could not be computed", voiceOn);
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
        else { toast.success("SOS broadcast sent"); speak("S.O.S broadcast sent. Stay calm. Help is being dispatched.", voiceOn); }
        setSosBusy(false);
      }, () => { toast.error("Location unavailable"); setSosBusy(false); });
    } catch { setSosBusy(false); }
  };

  const center: [number, number] = destination
    ? [destination.lat, destination.lon]
    : [position.lat || 7.95, position.lon || -1.03];

  return (
    <div className="p-4 lg:p-6 max-w-7xl mx-auto space-y-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><Anchor className="h-6 w-6 text-primary" /> AGNav — Water Transport Navigator</h1>
          <p className="text-sm text-muted-foreground">Search any place, address or GPS coordinate. Live water-route navigation with voice cues for the Volta basin.</p>
        </div>
        <Badge variant={fr.level === "critical" || fr.level === "high" ? "destructive" : "outline"} className="capitalize">
          <AlertTriangle className="h-3 w-3 mr-1" /> Flood risk today: {fr.level} ({fr.score})
        </Badge>
      </div>

      {/* Uber-style destination search */}
      <Card>
        <CardContent className="p-3 space-y-2">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") handleSearch(); }}
                placeholder="Where to? Place name, address, or GPS (e.g. 6.5244, 0.1234)"
                className="pl-9 h-11"
              />
            </div>
            <Button onClick={() => handleSearch()} disabled={searchBusy} className="h-11">
              {searchBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Search"}
            </Button>
            <Button variant="outline" onClick={toggleVoiceInput} className="h-11" title="Voice input">
              {listening ? <MicOff className="h-4 w-4 text-red-500" /> : <Mic className="h-4 w-4" />}
            </Button>
            <Button variant="outline" onClick={() => setVoiceOn((v) => !v)} className="h-11" title="Voice cues">
              {voiceOn ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
            </Button>
            <Button variant="ghost" onClick={useCurrentAsDestination} className="h-11" title="Use current GPS">
              <Crosshair className="h-4 w-4" />
            </Button>
          </div>
          {destination && (
            <div className="text-xs text-muted-foreground flex items-center gap-2 flex-wrap">
              <MapPin className="h-3.5 w-3.5 text-primary" />
              <span className="font-medium text-foreground">{destination.label}</span>
              <span>· {destination.lat.toFixed(5)}, {destination.lon.toFixed(5)}</span>
              <Button size="sm" className="ml-auto" onClick={computeRoute} disabled={routeBusy}>
                {routeBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <><Navigation className="h-3.5 w-3.5 mr-1" />Navigate</>}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => { setDestination(null); setRoute([]); setRouteMeta(null); }}>Clear</Button>
            </div>
          )}
        </CardContent>
      </Card>

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

          {/* Optional: route to a registered farm */}
          <div className="flex flex-wrap items-center gap-2 mb-3">
            <RouteIcon className="h-4 w-4 text-primary" />
            <Label className="text-xs">Or route to registered farm</Label>
            <Select value={routeFarmId} onValueChange={(v) => { setRouteFarmId(v); setDestination(null); }}>
              <SelectTrigger className="h-8 w-64"><SelectValue placeholder={farms.length ? "Pick a farm" : "No farms with GPS"} /></SelectTrigger>
              <SelectContent>
                {farms.map((f) => <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button size="sm" onClick={computeRoute} disabled={routeBusy || (!routeFarmId && !destination)}>
              {routeBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Compute route"}
            </Button>
            {routeMeta && (
              <span className="text-xs text-muted-foreground">
                ≈ {(routeMeta.distance / 1000).toFixed(1)} km · {(routeMeta.duration / 60).toFixed(0)} min
              </span>
            )}
            {route.length > 0 && <Button size="sm" variant="ghost" onClick={() => { setRoute([]); setRouteMeta(null); }}>Clear route</Button>}
          </div>

          <div className="rounded-lg overflow-hidden border" style={{ height: "62vh", minHeight: 420 }}>
            <MapContainer center={center} zoom={destination ? 11 : 7} scrollWheelZoom style={{ height: "100%", width: "100%" }}>
              <FlyTo lat={center[0]} lon={center[1]} zoom={destination ? 11 : 7} />
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

              {showHeat && heatLayers[heatDay]?.map((p, i) => (
                <Circle
                  key={`h-${heatDay}-${i}`}
                  center={[p.lat, p.lon]}
                  radius={8000 + p.intensity * 14000}
                  pathOptions={{ color: heatColor(p.intensity), fillColor: heatColor(p.intensity), fillOpacity: 0.18 + p.intensity * 0.25, weight: 0 }}
                />
              ))}

              {showWeather && today && (
                <CircleMarker center={[position.lat || 7.95, position.lon || -1.03]} radius={Math.max(8, (today.rainProb || 0) / 5)}
                  pathOptions={{ color: "#0ea5e9", fillColor: "#0ea5e9", fillOpacity: 0.25 }}>
                  <Popup>Rain {today.rainProb}% · {today.tempLow}–{today.tempHigh}°C · {today.description}</Popup>
                </CircleMarker>
              )}

              <Marker position={[position.lat || 7.95, position.lon || -1.03]}>
                <Popup>You are here · {position.locationName}</Popup>
              </Marker>

              {destination && (
                <Marker position={[destination.lat, destination.lon]}>
                  <Popup>Destination · {destination.label}</Popup>
                </Marker>
              )}

              {showFarms && farms.map((f) => (
                <Marker key={f.id} position={[f.lat, f.lon]}><Popup>{f.name}</Popup></Marker>
              ))}

              {showBoats && boatTrail.length > 1 && (
                <Polyline positions={boatTrail} pathOptions={{ color: "#16a34a", weight: 3, dashArray: "4 6" }} />
              )}

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
            <span className="text-[11px] text-muted-foreground ml-auto">Heatmap: <span className="inline-block h-2 w-2 rounded-full bg-green-600" /> low → <span className="inline-block h-2 w-2 rounded-full bg-yellow-400" /> mod → <span className="inline-block h-2 w-2 rounded-full bg-orange-500" /> high → <span className="inline-block h-2 w-2 rounded-full bg-red-600" /> critical</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
