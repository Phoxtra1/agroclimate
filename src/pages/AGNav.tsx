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
  Route as RouteIcon, Search, Mic, MicOff, Volume2, VolumeX, Crosshair, Wind, Waves,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useGeolocation } from "@/hooks/useGeolocation";
import { useWeather } from "@/hooks/useWeather";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { floodRisk } from "@/lib/riskEngine";
import {
  computeRoute as engineComputeRoute,
  pushVesselLocation,
  triggerSOS as engineTriggerSOS,
  flushSOSQueue,
  subscribeSOSEvent,
  subscribeRescueUnit,
  segmentColour,
  scoreRisk,
  type RouteResult,
  type SosResponse,
  type RiskLevel,
} from "../page/admin/AGNavEngine";

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

// Static current-flow hints for the basin (lat,lon -> direction degrees, magnitude 0-1).
const RIVER_CURRENTS: { lat: number; lon: number; dir: number; mag: number }[] = [
  { lat: 6.2, lon: 0.0, dir: 200, mag: 0.7 },
  { lat: 7.5, lon: -0.6, dir: 180, mag: 0.5 },
  { lat: 9.0, lon: -1.1, dir: 170, mag: 0.6 },
  { lat: 8.6, lon: -2.6, dir: 155, mag: 0.55 },
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

function parseCoords(text: string): { lat: number; lon: number } | null {
  const m = text.trim().match(/^\s*(-?\d+(?:\.\d+)?)\s*[, ]\s*(-?\d+(?:\.\d+)?)\s*$/);
  if (!m) return null;
  const lat = parseFloat(m[1]); const lon = parseFloat(m[2]);
  if (Math.abs(lat) > 90 || Math.abs(lon) > 180) return null;
  return { lat, lon };
}

function speak(text: string, enabled: boolean) {
  if (!enabled || typeof window === "undefined" || !window.speechSynthesis) return;
  const u = new SpeechSynthesisUtterance(text);
  u.rate = 1; u.pitch = 1; u.lang = "en-US";
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(u);
}

function beep() {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const o = ctx.createOscillator(); const g = ctx.createGain();
    o.frequency.value = 880; o.connect(g); g.connect(ctx.destination);
    g.gain.setValueAtTime(0.001, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.2, ctx.currentTime + 0.01);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
    o.start(); o.stop(ctx.currentTime + 0.45);
  } catch { /* ignore */ }
}

function pointInPolygon(pt: [number, number], poly: [number, number][]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i][1], yi = poly[i][0], xj = poly[j][1], yj = poly[j][0];
    const x = pt[1], y = pt[0];
    const intersect = ((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi || 1e-9) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}

const VESSEL_ID_KEY = "agnav.vessel_id";

export default function AGNav() {
  const { user } = useAuth();
  const { position } = useGeolocation();
  const { forecast } = useWeather(position.lat, position.lon);

  // Layer toggles
  const [showWeather, setShowWeather] = useState(true);
  const [showRisk, setShowRisk] = useState(true);
  const [showFarms, setShowFarms] = useState(true);
  const [showLiveTrack, setShowLiveTrack] = useState(false);
  const [showHeat, setShowHeat] = useState(true);
  const [showWind, setShowWind] = useState(false);
  const [showCurrent, setShowCurrent] = useState(false);
  const [heatDay, setHeatDay] = useState(0);

  // Data
  const [farms, setFarms] = useState<FarmPoint[]>([]);
  const [boatTrail, setBoatTrail] = useState<[number, number][]>([]);
  const [routeFarmId, setRouteFarmId] = useState<string>("");
  const [routeResult, setRouteResult] = useState<RouteResult | null>(null);
  const [routeBusy, setRouteBusy] = useState(false);

  // SOS state
  const [sosBusy, setSosBusy] = useState(false);
  const [sosStatus, setSosStatus] = useState<SosResponse | null>(null);
  const [rescuePos, setRescuePos] = useState<{ lat: number; lon: number } | null>(null);
  const [blink, setBlink] = useState(false);

  // Search
  const [destination, setDestination] = useState<Destination | null>(null);
  const [searchText, setSearchText] = useState("");
  const [searchBusy, setSearchBusy] = useState(false);

  // Voice
  const [voiceOn, setVoiceOn] = useState(true);
  const [listening, setListening] = useState(false);

  // Load (passengers / cargo)
  const [passengers, setPassengers] = useState<number>(1);
  const [cargoKg, setCargoKg] = useState<number>(0);

  // Vessel id (PXT). Persisted locally; admin can register in vessels table.
  const [vesselId] = useState<string>(() => {
    const stored = typeof window !== "undefined" ? localStorage.getItem(VESSEL_ID_KEY) : null;
    if (stored) return stored;
    const id = `PXT-VSL-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
    if (typeof window !== "undefined") localStorage.setItem(VESSEL_ID_KEY, id);
    return id;
  });

  const watchIdRef = useRef<number | null>(null);
  const recognitionRef = useRef<any>(null);
  const lastPushRef = useRef<number>(0);
  const lastWarnRef = useRef<{ zone?: number; overload?: number; weather?: number }>({});

  const today = forecast?.[0];
  const fr = floodRisk({ rainProb: today?.rainProb, humidity: today?.humidity, riverLevelPct: 60 });

  // Load farms (destination presets)
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
    flushSOSQueue();
  }, []);

  // LIVE TRACKING — GPS watch + 3-5s push to engine
  useEffect(() => {
    if (!showLiveTrack || !navigator.geolocation) return;
    watchIdRef.current = navigator.geolocation.watchPosition(
      async (pos) => {
        const p: [number, number] = [pos.coords.latitude, pos.coords.longitude];
        setBoatTrail((t) => [...t.slice(-200), p]);

        // Throttle to 1 push every 4s
        const now = Date.now();
        if (now - lastPushRef.current > 4000) {
          lastPushRef.current = now;
          const level = scoreRisk({ lat: p[0], lon: p[1] }, { rainProb: today?.rainProb, load: { passengers, cargo_kg: cargoKg } }).level;
          await pushVesselLocation({
            vessel_id: vesselId, user_id: user?.id, lat: p[0], lon: p[1],
            speed_kn: pos.coords.speed ? pos.coords.speed * 1.94384 : undefined,
            heading: pos.coords.heading ?? undefined, risk_level: level,
          }).catch(() => {});

          // Alerts: danger zone
          for (let i = 0; i < FLOOD_ZONES.length; i++) {
            if (pointInPolygon(p, FLOOD_ZONES[i].coords)) {
              if (!lastWarnRef.current.zone || now - lastWarnRef.current.zone > 30000) {
                lastWarnRef.current.zone = now;
                toast.warning(`Entering danger zone: ${FLOOD_ZONES[i].name}`);
                speak(`Warning. Entering ${FLOOD_ZONES[i].name}`, voiceOn); beep();
              }
            }
          }
          // Weather spike
          if ((today?.rainProb || 0) >= 80 && (!lastWarnRef.current.weather || now - lastWarnRef.current.weather > 60000)) {
            lastWarnRef.current.weather = now;
            toast.warning(`Weather spike: rain ${today?.rainProb}%`);
            speak("Weather spike detected. Consider sheltering.", voiceOn); beep();
          }
        }
      },
      () => {},
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 10000 },
    );
    return () => { if (watchIdRef.current !== null) navigator.geolocation.clearWatch(watchIdRef.current); };
  }, [showLiveTrack, today, passengers, cargoKg, vesselId, user?.id, voiceOn]);

  // Overload alert (load > 1000 kg or > 20 passengers as soft default)
  useEffect(() => {
    if (passengers > 20 || cargoKg > 1000) {
      const now = Date.now();
      if (!lastWarnRef.current.overload || now - lastWarnRef.current.overload > 30000) {
        lastWarnRef.current.overload = now;
        toast.warning("Overload warning — reduce passengers or cargo");
        speak("Overload warning. Reduce load before departure.", voiceOn); beep();
      }
    }
  }, [passengers, cargoKg, voiceOn]);

  // Adaptive re-routing every 8s while moving with active route
  useEffect(() => {
    if (!showLiveTrack || !routeResult || !destination || !position.lat) return;
    const t = setInterval(async () => {
      try {
        const next = await engineComputeRoute({
          start: { lat: position.lat, lon: position.lon },
          end: { lat: destination.lat, lon: destination.lon },
          vessel_id: vesselId, user_id: user?.id,
          load: { passengers, cargo_kg: cargoKg },
          rainProb: today?.rainProb,
        });
        if (next.risk_score + 0.05 < routeResult.risk_score) {
          setRouteResult(next);
          toast.success("Safer route found — switching");
          speak("Safer route found. Switching now.", voiceOn);
        }
      } catch { /* ignore transient */ }
    }, 8000);
    return () => clearInterval(t);
  }, [showLiveTrack, routeResult, destination, position.lat, position.lon, vesselId, user?.id, passengers, cargoKg, today?.rainProb, voiceOn]);

  // Blink for active SOS
  useEffect(() => {
    if (!sosStatus || sosStatus.status === "RESOLVED") return;
    const t = setInterval(() => setBlink(b => !b), 600);
    return () => clearInterval(t);
  }, [sosStatus]);

  const heatLayers = useMemo(
    () => buildHeatPoints(forecast || [], position.lat || 7.95, position.lon || -1.03),
    [forecast, position.lat, position.lon],
  );

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
      setRouteResult(null);
      toast.success(`Destination set: ${dest.label}`);
      speak(`Destination set. ${dest.label.split(",")[0]}.`, voiceOn);
    } catch (err: any) {
      toast.error(err.message || "Search failed");
    } finally { setSearchBusy(false); }
  };

  const toggleVoiceInput = () => {
    const SR: any = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) { toast.error("Voice input not supported in this browser"); return; }
    if (listening) { recognitionRef.current?.stop(); setListening(false); return; }
    const rec = new SR();
    rec.lang = "en-US"; rec.interimResults = false; rec.maxAlternatives = 1;
    rec.onresult = (e: any) => {
      const t = e.results[0][0].transcript;
      setSearchText(t); setListening(false); handleSearch(t);
    };
    rec.onerror = () => { setListening(false); toast.error("Voice input failed"); };
    rec.onend = () => setListening(false);
    recognitionRef.current = rec;
    rec.start(); setListening(true);
    speak("Listening for destination", voiceOn);
  };

  const useCurrentAsDestination = () => {
    if (!position.lat || !position.lon) { toast.error("Location unavailable"); return; }
    setSearchText(`${position.lat.toFixed(5)}, ${position.lon.toFixed(5)}`);
  };

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
      const result = await engineComputeRoute({
        start: { lat: position.lat, lon: position.lon },
        end: { lat: target.lat, lon: target.lon },
        vessel_id: vesselId, user_id: user?.id,
        load: { passengers, cargo_kg: cargoKg },
        rainProb: today?.rainProb,
      });
      setRouteResult(result);
      const km = (result.distance_m / 1000).toFixed(1);
      const min = (result.duration_s / 60).toFixed(0);
      toast.success(`Route ${km} km · ${min} min · risk ${result.risk_level}`);
      speak(`Route ready. ${km} kilometres. About ${min} minutes. Risk ${result.risk_level}.`, voiceOn);
    } catch (err: any) {
      toast.error(err.message || "Routing failed");
      speak("Route could not be computed", voiceOn);
    } finally { setRouteBusy(false); }
  };

  const triggerSOS = async () => {
    if (!user) { toast.error("Sign in to send SOS"); return; }
    if (!confirm("Confirm SOS — broadcast distress signal to admin?")) return;
    setSosBusy(true);
    navigator.geolocation.getCurrentPosition(async (pos) => {
      try {
        const resp = await engineTriggerSOS({
          vessel_id: vesselId, user_id: user.id,
          location: { lat: pos.coords.latitude, lon: pos.coords.longitude },
          risk_level: (routeResult?.risk_level || fr.level) as RiskLevel,
        });
        setSosStatus(resp);
        toast.success(resp.status === "DISPATCHED" ? `Rescue on the way · ETA ${resp.rescue_unit?.eta} min` : "SOS received by admin");
        speak(resp.status === "DISPATCHED" ? `Rescue on the way. Estimated time, ${resp.rescue_unit?.eta} minutes.` : "S O S received. Stand by.", voiceOn);
        beep();
        if (resp.rescue_unit?.lat != null) setRescuePos({ lat: resp.rescue_unit.lat, lon: resp.rescue_unit.lon });

        // Subscribe to live updates on the SOS event + rescue unit
        const unsubEv = subscribeSOSEvent(resp.event_id, (row) => {
          setSosStatus({
            status: row.status, event_id: row.id,
            rescue_unit: row.rescue_unit_id ? { id: row.rescue_unit_id, eta: row.eta_minutes ?? 0 } : undefined,
          });
          if (row.status === "RESOLVED") { toast.success("SOS resolved"); setRescuePos(null); }
        });
        let unsubUnit: (() => void) | null = null;
        if (resp.rescue_unit?.id) {
          unsubUnit = subscribeRescueUnit(resp.rescue_unit.id, (row) => {
            if (row.lat != null && row.lon != null) setRescuePos({ lat: row.lat, lon: row.lon });
          });
        }
        // Cleanup is tied to component unmount via window event
        window.addEventListener("beforeunload", () => { unsubEv(); unsubUnit?.(); }, { once: true });
      } catch (err: any) {
        toast.error(`SOS queued offline — will retry. ${err?.message || ""}`);
      } finally { setSosBusy(false); }
    }, () => { toast.error("Location unavailable"); setSosBusy(false); });
  };

  const center: [number, number] = destination
    ? [destination.lat, destination.lon]
    : [position.lat || 7.95, position.lon || -1.03];

  return (
    <div className="p-4 lg:p-6 max-w-7xl mx-auto space-y-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><Anchor className="h-6 w-6 text-primary" /> AGNav — Water Transport Navigator</h1>
          <p className="text-sm text-muted-foreground">Vessel <span className="font-mono">{vesselId}</span> · live admin-powered routing & rescue.</p>
        </div>
        <Badge variant={fr.level === "critical" || fr.level === "high" ? "destructive" : "outline"} className="capitalize">
          <AlertTriangle className="h-3 w-3 mr-1" /> Flood risk today: {fr.level} ({fr.score})
        </Badge>
      </div>

      {/* SOS status banner */}
      {sosStatus && sosStatus.status !== "RESOLVED" && (
        <Card className="border-destructive">
          <CardContent className="p-3 flex items-center gap-3 text-sm">
            <LifeBuoy className={`h-5 w-5 text-destructive ${blink ? "opacity-30" : "opacity-100"}`} />
            <span className="font-semibold">{sosStatus.status === "DISPATCHED" ? "Rescue on the way" : "SOS received — awaiting dispatch"}</span>
            {sosStatus.rescue_unit?.eta != null && <span>ETA {sosStatus.rescue_unit.eta} min</span>}
          </CardContent>
        </Card>
      )}

      {/* Destination search */}
      <Card><CardContent className="p-3 space-y-2">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleSearch(); }}
              placeholder="Where to? Place name, address, or GPS"
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
            <Button size="sm" variant="ghost" onClick={() => { setDestination(null); setRouteResult(null); }}>Clear</Button>
          </div>
        )}
      </CardContent></Card>

      {/* Load input */}
      <Card><CardContent className="p-3">
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col">
            <Label className="text-xs mb-1">Passengers</Label>
            <Input type="number" min={0} value={passengers} onChange={(e) => setPassengers(Number(e.target.value) || 0)} className="h-9 w-28" />
          </div>
          <div className="flex flex-col">
            <Label className="text-xs mb-1">Cargo (kg)</Label>
            <Input type="number" min={0} value={cargoKg} onChange={(e) => setCargoKg(Number(e.target.value) || 0)} className="h-9 w-32" />
          </div>
          <span className="text-xs text-muted-foreground">Load is included in route risk scoring.</span>
        </div>
      </CardContent></Card>

      <Card><CardContent className="p-3">
        <div className="flex flex-wrap items-center gap-4 mb-3">
          <div className="flex items-center gap-2"><Switch checked={showWeather} onCheckedChange={setShowWeather} id="w" /><Label htmlFor="w" className="text-xs flex items-center gap-1"><Cloud className="h-3.5 w-3.5" /> Weather</Label></div>
          <div className="flex items-center gap-2"><Switch checked={showRisk} onCheckedChange={setShowRisk} id="r" /><Label htmlFor="r" className="text-xs flex items-center gap-1"><AlertTriangle className="h-3.5 w-3.5" /> Risk zones</Label></div>
          <div className="flex items-center gap-2"><Switch checked={showHeat} onCheckedChange={setShowHeat} id="h" /><Label htmlFor="h" className="text-xs">Flood heatmap</Label></div>
          <div className="flex items-center gap-2"><Switch checked={showFarms} onCheckedChange={setShowFarms} id="f" /><Label htmlFor="f" className="text-xs flex items-center gap-1"><MapPin className="h-3.5 w-3.5" /> Farms</Label></div>
          <div className="flex items-center gap-2"><Switch checked={showLiveTrack} onCheckedChange={setShowLiveTrack} id="b" /><Label htmlFor="b" className="text-xs flex items-center gap-1"><Navigation className="h-3.5 w-3.5" /> Live track</Label></div>
          <div className="flex items-center gap-2"><Switch checked={showWind} onCheckedChange={setShowWind} id="wi" /><Label htmlFor="wi" className="text-xs flex items-center gap-1"><Wind className="h-3.5 w-3.5" /> Wind</Label></div>
          <div className="flex items-center gap-2"><Switch checked={showCurrent} onCheckedChange={setShowCurrent} id="cu" /><Label htmlFor="cu" className="text-xs flex items-center gap-1"><Waves className="h-3.5 w-3.5" /> Current</Label></div>
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
          {routeResult && (
            <span className="text-xs text-muted-foreground">
              ≈ {(routeResult.distance_m / 1000).toFixed(1)} km · {(routeResult.duration_s / 60).toFixed(0)} min · risk {routeResult.risk_level}
            </span>
          )}
          {routeResult && <Button size="sm" variant="ghost" onClick={() => setRouteResult(null)}>Clear route</Button>}
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
              <Circle key={`h-${heatDay}-${i}`} center={[p.lat, p.lon]} radius={8000 + p.intensity * 14000}
                pathOptions={{ color: heatColor(p.intensity), fillColor: heatColor(p.intensity), fillOpacity: 0.18 + p.intensity * 0.25, weight: 0 }} />
            ))}

            {/* Wind layer — direction arrows from forecast */}
            {showWind && today && (
              <CircleMarker center={[position.lat || 7.95, position.lon || -1.03]} radius={Math.max(6, ((today as any).windSpeed || 4))}
                pathOptions={{ color: "#0891b2", fillColor: "#0891b2", fillOpacity: 0.4 }}>
                <Popup>Wind {(today as any).windSpeed || "—"} m/s {(today as any).windDir != null ? `· ${(today as any).windDir}°` : ""}</Popup>
              </CircleMarker>
            )}

            {/* River current arrows */}
            {showCurrent && RIVER_CURRENTS.map((c, i) => {
              const len = 0.25 * c.mag;
              const rad = (c.dir * Math.PI) / 180;
              const tip: [number, number] = [c.lat + len * Math.cos(rad), c.lon + len * Math.sin(rad)];
              return (
                <Polyline key={`cur-${i}`} positions={[[c.lat, c.lon], tip]} pathOptions={{ color: "#0ea5e9", weight: 3 }}>
                  <Popup>Current ~{Math.round(c.mag * 100)}% · heading {c.dir}°</Popup>
                </Polyline>
              );
            })}

            {showWeather && today && (
              <CircleMarker center={[position.lat || 7.95, position.lon || -1.03]} radius={Math.max(8, (today.rainProb || 0) / 5)}
                pathOptions={{ color: "#0ea5e9", fillColor: "#0ea5e9", fillOpacity: 0.25 }}>
                <Popup>Rain {today.rainProb}% · {today.tempLow}–{today.tempHigh}°C · {today.description}</Popup>
              </CircleMarker>
            )}

            {/* Vessel marker (blink red while SOS active) */}
            <CircleMarker center={[position.lat || 7.95, position.lon || -1.03]} radius={10}
              pathOptions={{ color: sosStatus && sosStatus.status !== "RESOLVED" ? (blink ? "#dc2626" : "#fca5a5") : "#2563eb",
                fillColor: sosStatus && sosStatus.status !== "RESOLVED" ? "#dc2626" : "#2563eb", fillOpacity: 0.8 }}>
              <Popup>You · {vesselId}</Popup>
            </CircleMarker>

            {destination && (
              <Marker position={[destination.lat, destination.lon]}>
                <Popup>Destination · {destination.label}</Popup>
              </Marker>
            )}

            {showFarms && farms.map((f) => (
              <Marker key={f.id} position={[f.lat, f.lon]}><Popup>{f.name}</Popup></Marker>
            ))}

            {showLiveTrack && boatTrail.length > 1 && (
              <Polyline positions={boatTrail} pathOptions={{ color: "#16a34a", weight: 3, dashArray: "4 6" }} />
            )}

            {/* Risk-coloured route segments */}
            {routeResult && routeResult.risk_segments.map((s, i) => (
              <Polyline key={`seg-${i}`} positions={s.coords} pathOptions={{ color: segmentColour(s.level), weight: 6, opacity: 0.9 }} />
            ))}

            {/* Alternatives in muted blue */}
            {routeResult && routeResult.alternatives.map((a, i) => (
              <Polyline key={`alt-${i}`} positions={a} pathOptions={{ color: "#94a3b8", weight: 3, opacity: 0.6, dashArray: "6 6" }} />
            ))}

            {/* Rescue unit marker */}
            {rescuePos && (
              <CircleMarker center={[rescuePos.lat, rescuePos.lon]} radius={10}
                pathOptions={{ color: "#16a34a", fillColor: "#16a34a", fillOpacity: 0.85 }}>
                <Popup>Rescue unit en route</Popup>
              </CircleMarker>
            )}
            {rescuePos && position.lat && (
              <Polyline positions={[[rescuePos.lat, rescuePos.lon], [position.lat, position.lon]]}
                pathOptions={{ color: "#16a34a", weight: 3, dashArray: "2 6" }} />
            )}
          </MapContainer>
        </div>

        <div className="mt-3 flex items-center gap-2 flex-wrap">
          <Button variant="destructive" disabled={sosBusy} onClick={triggerSOS}>
            {sosBusy ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <LifeBuoy className="h-4 w-4 mr-1" />} SOS
          </Button>
          <span className="text-xs text-muted-foreground">{fr.rationale} — {fr.recommendations.join(" · ")}</span>
          <span className="text-[11px] text-muted-foreground ml-auto">
            Route: <span className="inline-block h-2 w-2 rounded-full bg-green-600" /> safe →
            <span className="inline-block h-2 w-2 rounded-full bg-yellow-400 ml-1" /> moderate →
            <span className="inline-block h-2 w-2 rounded-full bg-orange-500 ml-1" /> high →
            <span className="inline-block h-2 w-2 rounded-full bg-red-600 ml-1" /> critical
          </span>
        </div>
      </CardContent></Card>
    </div>
  );
}
