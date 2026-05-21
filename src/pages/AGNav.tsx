import { useEffect, useMemo, useRef, useState } from "react";
import { MapContainer, TileLayer, Marker, Popup, Polyline, Polygon, CircleMarker, Circle, LayersControl, useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import {
  Anchor, AlertTriangle, MapPin, Navigation, LifeBuoy, Layers, Loader2, Cloud,
  Route as RouteIcon, Search, Mic, MicOff, Volume2, VolumeX, Crosshair, Wind, Waves,
  Save, Ship, Phone, MessageCircle, Send,
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
  subscribeVesselLocation,
  subscribeIncomingSOS,
  subscribeVesselMessages,
  sendVesselMessage,
  acceptSOS,
  resolveSOS,
  registerVessel,
  generateVesselId,
  saveFarm,
  listFarms,
  segmentColour,
  scoreRisk,
  type RouteResult,
  type SosResponse,
  type RiskLevel,
  type OperatorType,
} from "./admin/AGNavEngine";

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

function MapClickPicker({ onPick }: { onPick: (lat: number, lon: number) => void }) {
  useMapEvents({ click(e) { onPick(e.latlng.lat, e.latlng.lng); } });
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

function haversineDist(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

function getBearing(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const lat1Rad = lat1 * Math.PI / 180;
  const lat2Rad = lat2 * Math.PI / 180;
  const y = Math.sin(dLon) * Math.cos(lat2Rad);
  const x = Math.cos(lat1Rad) * Math.sin(lat2Rad) - Math.sin(lat1Rad) * Math.cos(lat2Rad) * Math.cos(dLon);
  let brng = Math.atan2(y, x) * 180 / Math.PI;
  return (brng + 360) % 360;
}

function getBearingDifference(b1: number, b2: number): number {
  let diff = b2 - b1;
  while (diff < -180) diff += 360;
  while (diff > 180) diff -= 360;
  return diff;
}

const VESSEL_ID_KEY = "agnav.vessel_id";
const VESSEL_REGISTERED_KEY = "agnav.vessel_registered";

export default function AGNav() {
  const { user } = useAuth();
  const { position } = useGeolocation();
  const { forecast } = useWeather(position.lat, position.lon);

  const [currentPos, setCurrentPos] = useState<{ lat: number; lon: number }>(() => ({
    lat: position?.lat || 5.6037,
    lon: position?.lon || -0.187,
  }));

  const lastTurnAnnouncedIdxRef = useRef<number>(-1);
  const lastArrivalAnnouncedRef = useRef<boolean>(false);
  const lastOffCourseAnnouncedRef = useRef<number>(0);

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
  const [routeResult, setRouteResult] = useState<RouteResult | null>(null);
  const [routeBusy, setRouteBusy] = useState(false);

  // Farm GPS input (replaces dropdown)
  const [farmGpsText, setFarmGpsText] = useState("");
  const [farmTarget, setFarmTarget] = useState<{ lat: number; lon: number } | null>(null);
  const [pickOnMap, setPickOnMap] = useState(false);
  const [savedFarmId, setSavedFarmId] = useState<string>("");
  const [saveFarmName, setSaveFarmName] = useState("");
  const [savingFarm, setSavingFarm] = useState(false);

  // SOS
  const [sosBusy, setSosBusy] = useState(false);
  const [sosStatus, setSosStatus] = useState<SosResponse | null>(null);
  const [rescuePos, setRescuePos] = useState<{ lat: number; lon: number } | null>(null);
  const [blink, setBlink] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState<{ from: string; body: string; ts: string }[]>([]);
  const [chatDraft, setChatDraft] = useState("");

  // Incoming SOS (decentralized — any vessel can accept)
  const [incomingSos, setIncomingSos] = useState<any | null>(null);

  // Search / destination
  const [destination, setDestination] = useState<Destination | null>(null);
  const [searchText, setSearchText] = useState("");
  const [searchBusy, setSearchBusy] = useState(false);

  // Voice
  const [voiceOn, setVoiceOn] = useState(true);
  const [listening, setListening] = useState(false);

  // Load
  const [passengers, setPassengers] = useState<number>(1);
  const [cargoKg, setCargoKg] = useState<number>(0);

  // Vessel ID (PXT)
  const [vesselId, setVesselId] = useState<string>(() => {
    const stored = typeof window !== "undefined" ? localStorage.getItem(VESSEL_ID_KEY) : null;
    if (stored) return stored;
    const id = generateVesselId();
    if (typeof window !== "undefined") localStorage.setItem(VESSEL_ID_KEY, id);
    return id;
  });
  const [registered, setRegistered] = useState<boolean>(() => typeof window !== "undefined" && localStorage.getItem(VESSEL_REGISTERED_KEY) === "1");
  const [regOpen, setRegOpen] = useState(false);

  // Vessel registration form
  const [regName, setRegName] = useState("");
  const [regOperator, setRegOperator] = useState("");
  const [regOperatorType, setRegOperatorType] = useState<OperatorType>("private");
  const [regPhone, setRegPhone] = useState("");
  const [regHomeText, setRegHomeText] = useState("");
  const [regMaxCap, setRegMaxCap] = useState<number>(10);
  const [regCargoCap, setRegCargoCap] = useState<number>(500);
  const [regRescue, setRegRescue] = useState(false);
  const [regBusy, setRegBusy] = useState(false);

  const watchIdRef = useRef<number | null>(null);
  const recognitionRef = useRef<any>(null);
  const lastPushRef = useRef<number>(0);
  const lastWarnRef = useRef<{ zone?: number; overload?: number; weather?: number }>({});

  const today = forecast?.[0];
  const fr = floodRisk({ rainProb: today?.rainProb, humidity: today?.humidity, riverLevelPct: 60 });

  // Load saved farms (per user)
  const reloadFarms = async () => {
    const items = await listFarms(user?.id);
    setFarms(items.map((r: any) => ({ id: r.id, name: r.name, lat: Number(r.lat), lon: Number(r.lon) })));
  };
  useEffect(() => { reloadFarms(); flushSOSQueue(); }, [user?.id]);

  // Subscribe to incoming SOS broadcasts from other vessels (decentralized rescue)
  useEffect(() => {
    if (!registered) return;
    const unsub = subscribeIncomingSOS((row) => {
      if (row.vessel_id === vesselId) return; // ignore own
      setIncomingSos(row);
      toast.warning(`Emergency nearby — ${row.vessel_id}`, { duration: 12000 });
      speak(`Emergency nearby. Vessel ${row.vessel_id}. Tap to accept rescue.`, voiceOn);
      beep();
    });
    return unsub;
  }, [registered, vesselId, voiceOn]);

  useEffect(() => {
    if (position.lat && position.lon) {
      setCurrentPos({ lat: position.lat, lon: position.lon });
    }
  }, [position.lat, position.lon]);

  // LIVE TRACKING & TURN-BY-TURN SEA NAVIGATOR
  useEffect(() => {
    if (!navigator.geolocation) return;
    const watchId = navigator.geolocation.watchPosition(
      async (pos) => {
        const lat = pos.coords.latitude;
        const lon = pos.coords.longitude;
        setCurrentPos({ lat, lon });

        if (showLiveTrack) {
          setBoatTrail((t) => [...t.slice(-200), [lat, lon]]);
        }

        // Turn-by-turn Voice Navigator (purposely styled for sea travel using nautical terms)
        if (routeResult && routeResult.route && routeResult.route.length > 2) {
          const route = routeResult.route;
          const distToDest = haversineDist(lat, lon, route[route.length - 1][0], route[route.length - 1][1]);
          
          if (distToDest < 30) {
            if (!lastArrivalAnnouncedRef.current) {
              lastArrivalAnnouncedRef.current = true;
              speak("Destination reached. Heave to and drop anchor.", voiceOn);
              toast.success("Destination reached");
            }
          } else {
            if (distToDest > 50) lastArrivalAnnouncedRef.current = false;

            let closestIdx = -1;
            let minDistance = Infinity;
            for (let i = 0; i < route.length; i++) {
              const dist = haversineDist(lat, lon, route[i][0], route[i][1]);
              if (dist < minDistance) {
                minDistance = dist;
                closestIdx = i;
              }
            }

            if (minDistance > 150) {
              const nowTime = Date.now();
              if (nowTime - lastOffCourseAnnouncedRef.current > 45000) {
                lastOffCourseAnnouncedRef.current = nowTime;
                speak("Warning. You are off course. Realign heading to route.", voiceOn);
                toast.warning("Off course warning");
              }
            } else {
              let scanIdx = closestIdx + 1;
              let accumulatedDist = 0;

              while (scanIdx < route.length - 3 && accumulatedDist < 150) {
                const stepDist = haversineDist(route[scanIdx - 1][0], route[scanIdx - 1][1], route[scanIdx][0], route[scanIdx][1]);
                accumulatedDist += stepDist;

                const b1 = getBearing(route[scanIdx - 1][0], route[scanIdx - 1][1], route[scanIdx][0], route[scanIdx][1]);
                const b2 = getBearing(route[scanIdx][0], route[scanIdx][1], route[scanIdx + 3][0], route[scanIdx + 3][1]);
                const diff = getBearingDifference(b1, b2);

                if (Math.abs(diff) > 25) {
                  if (lastTurnAnnouncedIdxRef.current !== scanIdx) {
                    lastTurnAnnouncedIdxRef.current = scanIdx;
                    const direction = diff > 0 ? "starboard" : "port";
                    const roundedDist = Math.round(accumulatedDist);

                    if (roundedDist < 40) {
                      speak(`Steer ${direction} now.`, voiceOn);
                      toast.info(`Steer ${direction} now`);
                    } else {
                      speak(`In ${roundedDist} meters, steer ${direction}.`, voiceOn);
                      toast.info(`In ${roundedDist}m, steer ${direction}`);
                    }
                  }
                  break;
                }
                scanIdx++;
              }
            }
          }
        }

        const now = Date.now();
        if (now - lastPushRef.current > 4000) {
          lastPushRef.current = now;
          const level = scoreRisk({ lat, lon }, { rainProb: today?.rainProb, load: { passengers, cargo_kg: cargoKg } }).level;
          await pushVesselLocation({
            vessel_id: vesselId, user_id: user?.id, lat, lon,
            speed_kn: pos.coords.speed ? pos.coords.speed * 1.94384 : undefined,
            heading: pos.coords.heading ?? undefined, risk_level: level,
          }).catch(() => {});

          for (let i = 0; i < FLOOD_ZONES.length; i++) {
            if (pointInPolygon([lat, lon], FLOOD_ZONES[i].coords)) {
              if (!lastWarnRef.current.zone || now - lastWarnRef.current.zone > 30000) {
                lastWarnRef.current.zone = now;
                toast.warning(`Entering danger zone: ${FLOOD_ZONES[i].name}`);
                speak(`Warning. Entering ${FLOOD_ZONES[i].name}`, voiceOn); beep();
              }
            }
          }
          if ((today?.rainProb || 0) >= 80 && (!lastWarnRef.current.weather || now - lastWarnRef.current.weather > 60000)) {
            lastWarnRef.current.weather = now;
            toast.warning(`Weather spike: rain ${today?.rainProb}%`);
            speak("Weather spike detected. Consider sheltering.", voiceOn); beep();
          }
        }
      },
      () => {},
      { enableHighAccuracy: true, maximumAge: 1000, timeout: 10000 },
    );
    return () => { navigator.geolocation.clearWatch(watchId); };
  }, [showLiveTrack, today, passengers, cargoKg, vesselId, user?.id, voiceOn, routeResult]);

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

  useEffect(() => {
    if (!sosStatus || sosStatus.status === "RESOLVED") return;
    const t = setInterval(() => setBlink(b => !b), 600);
    return () => clearInterval(t);
  }, [sosStatus]);

  const heatLayers = useMemo(
    () => buildHeatPoints(forecast || [], currentPos.lat || 7.95, currentPos.lon || -1.03),
    [forecast, currentPos.lat, currentPos.lon],
  );

  // ----- Destination geocode (place names) -----
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
      if (!dest) { toast.error("No place found"); return; }
      setDestination(dest); setRouteResult(null);
      toast.success(`Destination set: ${dest.label}`);
    } catch (err: any) { toast.error(err.message || "Search failed"); }
    finally { setSearchBusy(false); }
  };

  const toggleVoiceInput = () => {
    const SR: any = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) { toast.error("Voice input not supported"); return; }
    if (listening) { recognitionRef.current?.stop(); setListening(false); return; }
    const rec = new SR();
    rec.lang = "en-US"; rec.interimResults = false;
    rec.onresult = (e: any) => { const t = e.results[0][0].transcript; setSearchText(t); setListening(false); handleSearch(t); };
    rec.onerror = () => { setListening(false); toast.error("Voice input failed"); };
    rec.onend = () => setListening(false);
    recognitionRef.current = rec; rec.start(); setListening(true);
  };

  const useCurrentAsDestination = () => {
    if (!currentPos.lat || !currentPos.lon) { toast.error("Location unavailable"); return; }
    setSearchText(`${currentPos.lat.toFixed(5)}, ${currentPos.lon.toFixed(5)}`);
  };

  // ----- Farm GPS input handlers (replaces dropdown) -----
  const applyFarmGpsText = () => {
    const c = parseCoords(farmGpsText);
    if (!c) { toast.error("Invalid GPS. Use format: 6.5244, 0.1234"); return; }
    setFarmTarget(c);
    toast.success(`Farm target set: ${c.lat.toFixed(5)}, ${c.lon.toFixed(5)}`);
  };
  const onMapPick = (lat: number, lon: number) => {
    setFarmTarget({ lat, lon });
    setFarmGpsText(`${lat.toFixed(5)}, ${lon.toFixed(5)}`);
    setPickOnMap(false);
    toast.success("Farm location selected from map");
  };
  const pickSavedFarm = (id: string) => {
    setSavedFarmId(id);
    const f = farms.find(x => x.id === id);
    if (f) { setFarmTarget({ lat: f.lat, lon: f.lon }); setFarmGpsText(`${f.lat.toFixed(5)}, ${f.lon.toFixed(5)}`); }
  };
  const handleSaveFarm = async () => {
    if (!farmTarget) { toast.error("Enter or pick a GPS location first"); return; }
    if (!saveFarmName.trim()) { toast.error("Give the farm a name"); return; }
    setSavingFarm(true);
    try {
      await saveFarm({ name: saveFarmName.trim(), location: farmTarget, user_id: user?.id });
      toast.success("Farm saved");
      setSaveFarmName("");
      await reloadFarms();
    } catch (err: any) { toast.error(err.message || "Could not save farm"); }
    finally { setSavingFarm(false); }
  };

  // ----- Route -----
  const computeRoute = async () => {
    let target: { lat: number; lon: number; label: string } | null = destination;
    if (!target && farmTarget) target = { ...farmTarget, label: `Farm ${farmTarget.lat.toFixed(4)}, ${farmTarget.lon.toFixed(4)}` };
    if (!target) { toast.error("Enter a farm GPS, pick on map, or search a destination"); return; }
    if (!currentPos.lat || !currentPos.lon) { toast.error("Current location unavailable"); return; }
    setRouteBusy(true);
    try {
      const result = await engineComputeRoute({
        start: { lat: currentPos.lat, lon: currentPos.lon },
        end: { lat: target.lat, lon: target.lon },
        vessel_id: vesselId, user_id: user?.id,
        load: { passengers, cargo_kg: cargoKg },
        rainProb: today?.rainProb,
      });
      setRouteResult(result);
      lastTurnAnnouncedIdxRef.current = -1;
      lastArrivalAnnouncedRef.current = false;
      lastOffCourseAnnouncedRef.current = 0;
      const km = (result.distance_m / 1000).toFixed(1);
      const min = (result.duration_s / 60).toFixed(0);
      toast.success(`Route ${km} km · ${min} min · risk ${result.risk_level}`);
      speak(`Route ready. ${km} kilometres. About ${min} minutes. Risk ${result.risk_level}.`, voiceOn);
    } catch (err: any) { toast.error(err.message || "Routing failed"); }
    finally { setRouteBusy(false); }
  };

  // ----- Decentralized SOS -----
  const triggerSOS = async () => {
    if (!user) { toast.error("Sign in to send SOS"); return; }
    if (!registered) { toast.error("Register your vessel before sending SOS"); setRegOpen(true); return; }
    if (!currentPos.lat || !currentPos.lon) { toast.error("Distress location unavailable"); return; }
    if (!confirm("Confirm SOS — broadcast distress signal to nearby vessels and rescue authorities?")) return;
    setSosBusy(true);
    try {
      const resp = await engineTriggerSOS({
        vessel_id: vesselId, user_id: user.id,
        location: { lat: currentPos.lat, lon: currentPos.lon },
        risk_level: (routeResult?.risk_level || fr.level) as RiskLevel,
      });
      setSosStatus(resp);
      toast.success(`SOS broadcast → ${resp.notified_vessels.length} vessels, ${resp.notified_responders.length} responders`);
      speak(`S O S broadcast to ${resp.notified_vessels.length} vessels and ${resp.notified_responders.length} rescue authorities. Stand by.`, voiceOn);
      beep();

      const unsubEv = subscribeSOSEvent(resp.event_id, (row) => {
        setSosStatus((s) => s ? { ...s, status: row.status, accepted_by: row.accepted_by_vessel_id ? { vessel_id: row.accepted_by_vessel_id, eta: row.eta_minutes ?? 0 } : s.accepted_by } : s);
        if (row.status === "ACCEPTED" && row.accepted_by_vessel_id) {
          toast.success(`Rescue accepted by ${row.accepted_by_vessel_id} · ETA ${row.eta_minutes} min`);
          speak(`Rescue accepted by vessel ${row.accepted_by_vessel_id}. ETA ${row.eta_minutes} minutes.`, voiceOn);
          subscribeVesselLocation(row.accepted_by_vessel_id, (loc) => {
            if (loc.lat != null && loc.lon != null) setRescuePos({ lat: loc.lat, lon: loc.lon });
          });
        }
        if (row.status === "RESOLVED") { toast.success("SOS resolved"); setRescuePos(null); }
      });
      const unsubMsg = subscribeVesselMessages(resp.event_id, (m) => {
        setChatMessages((cs) => [...cs, { from: m.from_vessel_id, body: m.body, ts: m.created_at }]);
      });
      window.addEventListener("beforeunload", () => { unsubEv(); unsubMsg(); }, { once: true });
    } catch (err: any) {
      toast.error(`SOS queued offline (SMS fallback) — ${err?.message || ""}`);
    } finally { setSosBusy(false); }
  };

  const acceptIncoming = async () => {
    if (!incomingSos) return;
    if (!currentPos.lat || !currentPos.lon) { toast.error("Your location unavailable"); return; }
    try {
      const { eta } = await acceptSOS({
        event_id: incomingSos.id, rescuer_vessel_id: vesselId,
        rescuer_location: { lat: currentPos.lat, lon: currentPos.lon },
        victim_location: { lat: incomingSos.lat, lon: incomingSos.lon },
      });
      toast.success(`You are the rescuer — ETA ${eta} min`);
      speak(`Rescue accepted. ETA ${eta} minutes.`, voiceOn);
      setDestination({ lat: incomingSos.lat, lon: incomingSos.lon, label: `Rescue → ${incomingSos.vessel_id}` });
      setIncomingSos(null);
      setShowLiveTrack(true);
    } catch (err: any) {
      toast.error(err.message || "Could not accept");
      setIncomingSos(null);
    }
  };

  const sendChat = async () => {
    if (!sosStatus || !chatDraft.trim()) return;
    await sendVesselMessage({
      sos_event_id: sosStatus.event_id, from_vessel_id: vesselId,
      to_vessel_id: sosStatus.accepted_by?.vessel_id, body: chatDraft.trim(),
    });
    setChatDraft("");
  };

  const handleRegisterVessel = async () => {
    const home = parseCoords(regHomeText) || (currentPos.lat ? { lat: currentPos.lat, lon: currentPos.lon } : null);
    if (!home) { toast.error("Provide home base GPS (e.g. 6.52, 0.12) or enable location"); return; }
    if (!regName.trim() || !regOperator.trim() || !regPhone.trim()) { toast.error("Fill all required fields"); return; }
    setRegBusy(true);
    try {
      const { vessel_id } = await registerVessel({
        vessel_name: regName.trim(), operator_name: regOperator.trim(),
        operator_type: regOperatorType, phone_number: regPhone.trim(),
        home_location: home, max_capacity: regMaxCap, cargo_capacity_kg: regCargoCap,
        has_rescue_capability: regRescue, user_id: user?.id,
      });
      localStorage.setItem(VESSEL_ID_KEY, vessel_id);
      localStorage.setItem(VESSEL_REGISTERED_KEY, "1");
      setVesselId(vessel_id); setRegistered(true); setRegOpen(false);
      toast.success(`Vessel registered: ${vessel_id}`);
    } catch (err: any) { toast.error(err.message || "Registration failed"); }
    finally { setRegBusy(false); }
  };

  const center: [number, number] = destination
    ? [destination.lat, destination.lon]
    : farmTarget ? [farmTarget.lat, farmTarget.lon]
    : [currentPos.lat || 7.95, currentPos.lon || -1.03];

  return (
    <div className="p-4 lg:p-6 max-w-7xl mx-auto space-y-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><Anchor className="h-6 w-6 text-primary" /> AGNav — Decentralized Water Navigator</h1>
          <p className="text-sm text-muted-foreground">
            Vessel <span className="font-mono">{vesselId}</span>
            {registered ? <Badge variant="outline" className="ml-2 text-xs">Registered</Badge> : <Badge variant="destructive" className="ml-2 text-xs">Unregistered</Badge>}
            {" "}· peer-to-peer SOS · live routing
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={fr.level === "critical" || fr.level === "high" ? "destructive" : "outline"} className="capitalize">
            <AlertTriangle className="h-3 w-3 mr-1" /> Flood: {fr.level} ({fr.score})
          </Badge>
          <Dialog open={regOpen} onOpenChange={setRegOpen}>
            <DialogTrigger asChild>
              <Button size="sm" variant={registered ? "outline" : "default"}><Ship className="h-4 w-4 mr-1" />{registered ? "Vessel" : "Register vessel"}</Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader><DialogTitle>Register vessel</DialogTitle></DialogHeader>
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2"><Label className="text-xs">Vessel name</Label><Input value={regName} onChange={(e) => setRegName(e.target.value)} placeholder="e.g. Volta Star" /></div>
                <div><Label className="text-xs">Operator name</Label><Input value={regOperator} onChange={(e) => setRegOperator(e.target.value)} /></div>
                <div>
                  <Label className="text-xs">Operator type</Label>
                  <Select value={regOperatorType} onValueChange={(v) => setRegOperatorType(v as OperatorType)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="private">Private Boat Operator</SelectItem>
                      <SelectItem value="commercial">Commercial Transport</SelectItem>
                      <SelectItem value="rescue_team">Rescue Team</SelectItem>
                      <SelectItem value="navy">Navy / Marine Police</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="col-span-2"><Label className="text-xs">Phone</Label><Input value={regPhone} onChange={(e) => setRegPhone(e.target.value)} placeholder="+233..." /></div>
                <div className="col-span-2"><Label className="text-xs">Home base GPS (lat, lon)</Label><Input value={regHomeText} onChange={(e) => setRegHomeText(e.target.value)} placeholder={position.lat ? `${position.lat.toFixed(5)}, ${position.lon.toFixed(5)}` : "6.5244, 0.1234"} /></div>
                <div><Label className="text-xs">Max capacity (passengers)</Label><Input type="number" value={regMaxCap} onChange={(e) => setRegMaxCap(Number(e.target.value) || 0)} /></div>
                <div><Label className="text-xs">Cargo capacity (kg)</Label><Input type="number" value={regCargoCap} onChange={(e) => setRegCargoCap(Number(e.target.value) || 0)} /></div>
                <div className="col-span-2 flex items-center gap-2"><Switch checked={regRescue} onCheckedChange={setRegRescue} id="rescuecap" /><Label htmlFor="rescuecap" className="text-xs flex items-center gap-1"><LifeBuoy className="h-3.5 w-3.5" /> Rescue-capable vessel</Label></div>
              </div>
              <DialogFooter>
                <Button onClick={handleRegisterVessel} disabled={regBusy}>{regBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Register"}</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Incoming SOS banner (decentralized — any vessel can accept) */}
      {incomingSos && (
        <Card className="border-destructive">
          <CardContent className="p-3 flex items-center gap-3 text-sm flex-wrap">
            <LifeBuoy className="h-5 w-5 text-destructive" />
            <span className="font-semibold">Emergency nearby — {incomingSos.vessel_id}</span>
            <span className="text-xs text-muted-foreground">{Number(incomingSos.lat).toFixed(4)}, {Number(incomingSos.lon).toFixed(4)} · risk {incomingSos.risk_level}</span>
            <div className="ml-auto flex gap-2">
              <Button size="sm" variant="destructive" onClick={acceptIncoming}>Accept rescue</Button>
              <Button size="sm" variant="ghost" onClick={() => setIncomingSos(null)}>Dismiss</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* SOS status banner (for victim) */}
      {sosStatus && sosStatus.status !== "RESOLVED" && (
        <Card className="border-destructive">
          <CardContent className="p-3 flex items-center gap-3 text-sm flex-wrap">
            <LifeBuoy className={`h-5 w-5 text-destructive ${blink ? "opacity-30" : "opacity-100"}`} />
            <span className="font-semibold">
              {sosStatus.status === "ACCEPTED" ? `Rescue on the way — ${sosStatus.accepted_by?.vessel_id}` : `SOS broadcast — ${sosStatus.notified_vessels.length} vessels notified`}
            </span>
            {sosStatus.accepted_by?.eta != null && <span>ETA {sosStatus.accepted_by.eta} min</span>}
            <div className="ml-auto flex gap-2">
              {sosStatus.status === "ACCEPTED" && (
                <Button size="sm" variant="outline" onClick={() => setChatOpen(true)}><MessageCircle className="h-3.5 w-3.5 mr-1" />Chat</Button>
              )}
              <Button size="sm" variant="ghost" onClick={async () => { await resolveSOS(sosStatus.event_id, sosStatus.accepted_by?.vessel_id); setSosStatus({ ...sosStatus, status: "RESOLVED" }); }}>Mark resolved</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Chat dialog */}
      <Dialog open={chatOpen} onOpenChange={setChatOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Rescue communication</DialogTitle></DialogHeader>
          <div className="space-y-1 max-h-64 overflow-auto border rounded p-2 text-sm">
            {chatMessages.length === 0 ? <p className="text-xs text-muted-foreground">No messages yet.</p> : chatMessages.map((m, i) => (
              <div key={i} className={`flex ${m.from === vesselId ? "justify-end" : "justify-start"}`}>
                <div className={`px-2 py-1 rounded-md ${m.from === vesselId ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
                  <div className="text-[10px] opacity-70">{m.from}</div>{m.body}
                </div>
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <Input value={chatDraft} onChange={(e) => setChatDraft(e.target.value)} placeholder="Type message…" onKeyDown={(e) => e.key === "Enter" && sendChat()} />
            <Button onClick={sendChat}><Send className="h-4 w-4" /></Button>
          </div>
          <p className="text-[11px] text-muted-foreground">Falls back to SMS if your device goes offline.</p>
        </DialogContent>
      </Dialog>

      {/* Destination search */}
      <Card><CardContent className="p-3 space-y-2">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input value={searchText} onChange={(e) => setSearchText(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleSearch(); }}
              placeholder="Where to? Place, address, or GPS" className="pl-9 h-11" />
          </div>
          <Button onClick={() => handleSearch()} disabled={searchBusy} className="h-11">{searchBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Search"}</Button>
          <Button variant="outline" onClick={toggleVoiceInput} className="h-11">{listening ? <MicOff className="h-4 w-4 text-red-500" /> : <Mic className="h-4 w-4" />}</Button>
          <Button variant="outline" onClick={() => setVoiceOn((v) => !v)} className="h-11">{voiceOn ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}</Button>
          <Button variant="ghost" onClick={useCurrentAsDestination} className="h-11"><Crosshair className="h-4 w-4" /></Button>
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

      {/* FARM GPS INPUT (replaces dropdown) */}
      <Card><CardContent className="p-3 space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <RouteIcon className="h-4 w-4 text-primary" />
          <Label className="text-xs font-semibold">Farm GPS</Label>
          <Input
            value={farmGpsText}
            onChange={(e) => setFarmGpsText(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") applyFarmGpsText(); }}
            placeholder="Enter farm GPS (e.g. 6.5244, 0.1234) or search location"
            className="h-9 flex-1 min-w-[260px]"
          />
          <Button size="sm" onClick={applyFarmGpsText}>Use GPS</Button>
          <Button size="sm" variant={pickOnMap ? "destructive" : "outline"} onClick={() => setPickOnMap(p => !p)}>
            <MapPin className="h-3.5 w-3.5 mr-1" />{pickOnMap ? "Click map…" : "Pick on map"}
          </Button>
          {farms.length > 0 && (
            <Select value={savedFarmId} onValueChange={pickSavedFarm}>
              <SelectTrigger className="h-9 w-56"><SelectValue placeholder="Saved farms" /></SelectTrigger>
              <SelectContent>
                {farms.map((f) => <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>)}
              </SelectContent>
            </Select>
          )}
          <Button size="sm" onClick={computeRoute} disabled={routeBusy || (!farmTarget && !destination)}>
            {routeBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Compute route"}
          </Button>
        </div>
        {farmTarget && (
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <MapPin className="h-3.5 w-3.5 text-primary" />
            <span className="text-foreground font-mono">{farmTarget.lat.toFixed(5)}, {farmTarget.lon.toFixed(5)}</span>
            <Input value={saveFarmName} onChange={(e) => setSaveFarmName(e.target.value)} placeholder="Name to save as farm" className="h-8 w-56 ml-auto" />
            <Button size="sm" variant="outline" onClick={handleSaveFarm} disabled={savingFarm}>
              {savingFarm ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <><Save className="h-3.5 w-3.5 mr-1" />Save as Farm</>}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => { setFarmTarget(null); setFarmGpsText(""); }}>Clear</Button>
          </div>
        )}
        {routeResult && (
          <div className="text-xs text-muted-foreground">≈ {(routeResult.distance_m / 1000).toFixed(1)} km · {(routeResult.duration_s / 60).toFixed(0)} min · risk {routeResult.risk_level}</div>
        )}
      </CardContent></Card>

      {/* Load input */}
      <Card><CardContent className="p-3">
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col"><Label className="text-xs mb-1">Passengers</Label><Input type="number" min={0} value={passengers} onChange={(e) => setPassengers(Number(e.target.value) || 0)} className="h-9 w-28" /></div>
          <div className="flex flex-col"><Label className="text-xs mb-1">Cargo (kg)</Label><Input type="number" min={0} value={cargoKg} onChange={(e) => setCargoKg(Number(e.target.value) || 0)} className="h-9 w-32" /></div>
          <span className="text-xs text-muted-foreground">Load is included in route risk scoring.</span>
        </div>
      </CardContent></Card>

      {/* Map */}
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

        <div className="rounded-lg overflow-hidden border" style={{ height: "62vh", minHeight: 420 }}>
          <MapContainer center={center} zoom={destination || farmTarget ? 11 : 7} scrollWheelZoom style={{ height: "100%", width: "100%" }}>
            <FlyTo lat={center[0]} lon={center[1]} zoom={destination || farmTarget ? 11 : 7} />
            {pickOnMap && <MapClickPicker onPick={onMapPick} />}
            <LayersControl position="topright">
              <LayersControl.BaseLayer checked name="Streets"><TileLayer attribution="&copy; OpenStreetMap" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" /></LayersControl.BaseLayer>
              <LayersControl.BaseLayer name="Satellite"><TileLayer attribution="Tiles © Esri" url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}" /></LayersControl.BaseLayer>
              <LayersControl.BaseLayer name="AGNav (terrain)"><TileLayer attribution="© OpenTopoMap" url="https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png" /></LayersControl.BaseLayer>
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

            {showWind && today && (
              <CircleMarker center={[currentPos.lat || 7.95, currentPos.lon || -1.03]} radius={Math.max(6, ((today as any).windSpeed || 4))}
                pathOptions={{ color: "#0891b2", fillColor: "#0891b2", fillOpacity: 0.4 }}>
                <Popup>Wind {(today as any).windSpeed || 0} m/s {(today as any).windDir != null ? `· ${(today as any).windDir}°` : ""}</Popup>
              </CircleMarker>
            )}

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
              <CircleMarker center={[currentPos.lat || 7.95, currentPos.lon || -1.03]} radius={Math.max(8, (today.rainProb || 0) / 5)}
                pathOptions={{ color: "#0ea5e9", fillColor: "#0ea5e9", fillOpacity: 0.25 }}>
                <Popup>Rain {today.rainProb}% · {today.tempLow}–{today.tempHigh}°C · {today.description}</Popup>
              </CircleMarker>
            )}

            {/* Vessel marker (blink red while SOS active) */}
            <CircleMarker center={[currentPos.lat || 7.95, currentPos.lon || -1.03]} radius={10}
              pathOptions={{ color: sosStatus && sosStatus.status !== "RESOLVED" ? (blink ? "#dc2626" : "#fca5a5") : "#2563eb",
                fillColor: sosStatus && sosStatus.status !== "RESOLVED" ? "#dc2626" : "#2563eb", fillOpacity: 0.8 }}>
              <Popup>You · {vesselId}</Popup>
            </CircleMarker>

            {destination && <Marker position={[destination.lat, destination.lon]}><Popup>Destination · {destination.label}</Popup></Marker>}
            {farmTarget && (
              <Marker position={[farmTarget.lat, farmTarget.lon]}>
                <Popup>Farm target · {farmTarget.lat.toFixed(5)}, {farmTarget.lon.toFixed(5)}</Popup>
              </Marker>
            )}

            {showFarms && farms.map((f) => (<Marker key={f.id} position={[f.lat, f.lon]}><Popup>{f.name}</Popup></Marker>))}

            {showLiveTrack && boatTrail.length > 1 && (
              <Polyline positions={boatTrail} pathOptions={{ color: "#16a34a", weight: 3, dashArray: "4 6" }} />
            )}

            {routeResult && routeResult.risk_segments.map((s, i) => (
              <Polyline key={`seg-${i}`} positions={s.coords} pathOptions={{ color: segmentColour(s.level), weight: 6, opacity: 0.9 }} />
            ))}
            {routeResult && routeResult.alternatives.map((a, i) => (
              <Polyline key={`alt-${i}`} positions={a} pathOptions={{ color: "#94a3b8", weight: 3, opacity: 0.6, dashArray: "6 6" }} />
            ))}

            {rescuePos && (
              <CircleMarker center={[rescuePos.lat, rescuePos.lon]} radius={10}
                pathOptions={{ color: "#16a34a", fillColor: "#16a34a", fillOpacity: 0.85 }}>
                <Popup>Rescue vessel en route</Popup>
              </CircleMarker>
            )}
            {rescuePos && currentPos.lat && (
              <Polyline positions={[[rescuePos.lat, rescuePos.lon], [currentPos.lat, currentPos.lon]]}
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
