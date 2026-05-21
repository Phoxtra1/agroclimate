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
  Save, Ship, Phone, MessageCircle, Send, Car, Bike, Train, Footprints, Play, Pause, Square,
  Bot
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useGeolocation } from "@/hooks/useGeolocation";
import { useWeather } from "@/hooks/useWeather";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { floodRisk } from "@/lib/riskEngine";
import { getActiveProvider } from "@/lib/aiProviders/registry";
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

// Custom interfaces & helper functions for real-time live navigation
interface AIAssistantAdvisory {
  confidenceScore: number;
  routeSafetyClass: "Safe" | "Moderate" | "High Risk" | "Critical";
  weatherImpact: string;
  anomalyDetected: string;
  adaptiveBehaviorAdvice: string;
  movementPrediction: string;
}

const createNavigationPointer = (bearingDeg: number, isSos: boolean, isBlinking: boolean) => {
  const color = isSos ? "#dc2626" : "#3b82f6";
  return L.divIcon({
    html: `
      <div style="position: relative; display: flex; align-items: center; justify-content: center; width: 36px; height: 36px;">
        <!-- Pulsing halo -->
        <div style="
          position: absolute; 
          width: 32px; 
          height: 32px; 
          border-radius: 50%; 
          background-color: ${color}; 
          opacity: 0.3; 
          animation: pulse-ring 1.5s cubic-bezier(0.215, 0.61, 0.355, 1) infinite;
        "></div>
        <!-- Inner circle -->
        <div style="
          position: relative; 
          width: 18px; 
          height: 18px; 
          border-radius: 50%; 
          border: 2px solid #ffffff; 
          background-color: ${color}; 
          box-shadow: 0 0 8px rgba(0,0,0,0.3); 
          display: flex; 
          align-items: center; 
          justify-content: center;
        ">
          <!-- Direction arrow -->
          <svg style="
            width: 10px; 
            height: 10px; 
            color: #ffffff; 
            transform: rotate(${bearingDeg}deg); 
            transition: transform 0.2s ease-out;
          " fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="4">
            <path stroke-linecap="round" stroke-linejoin="round" d="M5 10l7-7m0 0l7 7m-7-7v18" />
          </svg>
        </div>
      </div>
      <style>
        @keyframes pulse-ring {
          0% { transform: scale(0.5); opacity: 0.8; }
          80%, 100% { transform: scale(1.3); opacity: 0; }
        }
      </style>
    `,
    className: "",
    iconSize: [36, 36],
    iconAnchor: [18, 18],
  });
};

function MapController({ center, isAutoFollow, onMapInteraction }: { center: [number, number]; isAutoFollow: boolean; onMapInteraction: () => void }) {
  const map = useMap();
  const lastCenterRef = useRef<[number, number]>([0, 0]);

  useMapEvents({
    dragstart: onMapInteraction,
    zoomstart: onMapInteraction,
  });

  useEffect(() => {
    if (!isAutoFollow) return;
    const [lat, lon] = center;
    const [lastLat, lastLon] = lastCenterRef.current;
    const dist = haversineDist(lat, lon, lastLat, lastLon);
    if (dist > 1.5 || lastLat === 0) {
      map.panTo([lat, lon], { animate: true, duration: 0.5 });
      lastCenterRef.current = center;
    }
  }, [center, isAutoFollow, map]);

  return null;
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
  const [isMoving, setIsMoving] = useState(false);
  const lastGPSPosRef = useRef<{ lat: number; lon: number; time: number } | null>(null);

  // Real-Time and AI-backed states
  const [bearing, setBearing] = useState<number>(0);
  const [speedKn, setSpeedKn] = useState<number>(0);
  const [isNavigating, setIsNavigating] = useState(false);
  const [isAutoFollow, setIsAutoFollow] = useState(true);
  const [gpsLocked, setGpsLocked] = useState(false);
  const [currentRouteIdx, setCurrentRouteIdx] = useState<number>(0);
  const [aiAdvisory, setAiAdvisory] = useState<AIAssistantAdvisory | null>(null);
  const [aiAdvisoryLoading, setAiAdvisoryLoading] = useState(false);

  const lastTurnAnnouncementStageRef = useRef<{ index: number; stage: 'none' | 'prep' | 'now' }>({ index: -1, stage: 'none' });
  const deviationCountRef = useRef<number>(0);

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
  const [navMode, setNavMode] = useState<"water" | "road">(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("agnav.nav_mode");
      if (saved === "water" || saved === "road") return saved;
    }
    return "water";
  });

  // Road transport search & autocomplete states
  const [startLocation, setStartLocation] = useState<Destination | null>(null);
  const [startLocationText, setStartLocationText] = useState("");
  const [startSuggestions, setStartSuggestions] = useState<Destination[]>([]);
  const [destSuggestions, setDestSuggestions] = useState<Destination[]>([]);
  const [showStartSuggestions, setShowStartSuggestions] = useState(false);
  const [showDestSuggestions, setShowDestSuggestions] = useState(false);
  const [travelMode, setTravelMode] = useState<"car" | "motorcycle" | "train" | "walking">("car");

  // Navigation simulation states
  const [simulating, setSimulating] = useState(false);
  const [simStepIdx, setSimStepIdx] = useState(0);

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

  // Core Navigator Guidance Engine (triggered whenever currentPos changes, supporting live GPS and Simulator!)
  useEffect(() => {
    const { lat, lon } = currentPos;
    if (!lat || !lon) return;

    if (showLiveTrack) {
      setBoatTrail((t) => [...t.slice(-200), [lat, lon]]);
    }

    // Turn-by-turn Voice Navigator (configurable for sea/road modes)
    if (routeResult && routeResult.route && routeResult.route.length > 2) {
      const route = routeResult.route;
      const distToDest = haversineDist(lat, lon, route[route.length - 1][0], route[route.length - 1][1]);
      const isRoad = navMode === "road";
      
      if (distToDest < 30) {
        if (!lastArrivalAnnouncedRef.current) {
          lastArrivalAnnouncedRef.current = true;
          const arrivalMsg = isRoad 
            ? "You have arrived at your destination." 
            : "Destination reached. Heave to and drop anchor.";
          speak(arrivalMsg, voiceOn);
          toast.success("Destination reached");
          if (simulating) {
            setSimulating(false);
          }
          setIsNavigating(false);
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

        if (closestIdx !== -1) {
          setCurrentRouteIdx(closestIdx);
        }

        // Auto-scroll simulation marker index to match closest coordinate during live tracking
        if (simulating && closestIdx !== -1) {
          setSimStepIdx(closestIdx);
        }

        const activeRouteIdx = simulating ? simStepIdx : (closestIdx !== -1 ? closestIdx : currentRouteIdx);
        const activeNav = simulating || (isNavigating && isMoving && gpsLocked);

        // Auto-rerouting & Off-course checks
        if (minDistance > 80) {
          if (activeNav) {
            deviationCountRef.current += 1;
            if (deviationCountRef.current >= 3 && !simulating) {
              deviationCountRef.current = 0;
              autoReroute(lat, lon);
            }
          }

          const nowTime = Date.now();
          if (nowTime - lastOffCourseAnnouncedRef.current > 25000) {
            // Only announce off-course drift when actively navigating and moving
            if (activeNav) {
              lastOffCourseAnnouncedRef.current = nowTime;
              let destinationName = destination?.label || "your target destination";
              if (destinationName.length > 25) {
                destinationName = destinationName.slice(0, 22) + "...";
              }

              const offRouteMsg = isRoad
                ? `Warning. You have shifted from the planned road route. Continuing on this heading will bypass ${destinationName} and lead towards local rural coordinates. Please realign or recalculate to get back on track.`
                : `Warning. You are drifting off course from the river channel. Continuing on this bearing leads towards shallow sandbars and agricultural danger zones in the Volta Basin. Realign your vessel's heading immediately to remain safe.`;
              
              speak(offRouteMsg, voiceOn);
              toast.warning("Off-course drift detected", { 
                description: isRoad ? "Headed towards rural coordinates" : "Headed towards Volta Basin danger zones" 
              });
            }
          }
        } else {
          deviationCountRef.current = 0;

          // Scanning ahead for turns
          let scanIdx = activeRouteIdx + 1;
          let accumulatedDist = 0;

          while (scanIdx < route.length - 3 && accumulatedDist < 150) {
            const stepDist = haversineDist(route[scanIdx - 1][0], route[scanIdx - 1][1], route[scanIdx][0], route[scanIdx][1]);
            accumulatedDist += stepDist;

            const b1 = getBearing(route[scanIdx - 1][0], route[scanIdx - 1][1], route[scanIdx][0], route[scanIdx][1]);
            const b2 = getBearing(route[scanIdx][0], route[scanIdx][1], route[scanIdx + 3][0], route[scanIdx + 3][1]);
            const diff = getBearingDifference(b1, b2);

            if (Math.abs(diff) > 25) {
              const roundedDist = Math.round(accumulatedDist);
              const direction = isRoad 
                ? (diff > 0 ? "right" : "left") 
                : (diff > 0 ? "starboard" : "port");
              const actionWord = isRoad ? "turn" : "steer";

              if (activeNav) {
                const turnRef = lastTurnAnnouncementStageRef.current;
                if (turnRef.index !== scanIdx) {
                  lastTurnAnnouncementStageRef.current = { index: scanIdx, stage: 'none' };
                }

                const currentStage = lastTurnAnnouncementStageRef.current.stage;

                if (roundedDist <= 30 && currentStage !== 'now') {
                  lastTurnAnnouncementStageRef.current.stage = 'now';
                  speak(`${actionWord} ${direction} now.`, voiceOn);
                  toast.info(`${actionWord} ${direction} now`);
                } else if (roundedDist > 30 && roundedDist <= 120 && currentStage === 'none') {
                  lastTurnAnnouncementStageRef.current.stage = 'prep';
                  speak(`In ${roundedDist} meters, ${actionWord} ${direction}.`, voiceOn);
                  toast.info(`In ${roundedDist}m, ${actionWord} ${direction}`);
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
      pushVesselLocation({
        vessel_id: vesselId, user_id: user?.id, lat, lon,
        speed_kn: speedKn, heading: bearing,
        risk_level: level,
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
  }, [currentPos, routeResult, navMode, voiceOn, showLiveTrack, today, passengers, cargoKg, vesselId, user?.id, simulating, isMoving, isNavigating, gpsLocked, speedKn, bearing]);

  // Live GPS Geolocation Watcher
  useEffect(() => {
    if (!navigator.geolocation) return;
    const watchId = navigator.geolocation.watchPosition(
      async (pos) => {
        const lat = pos.coords.latitude;
        const lon = pos.coords.longitude;
        setGpsLocked(true);
        
        // Calculate dynamic real-time speed in m/s to filter out stationary jitter
        const now = Date.now();
        if (lastGPSPosRef.current) {
          const prev = lastGPSPosRef.current;
          const dt = (now - prev.time) / 1000; // time diff in seconds
          if (dt > 0.5) {
            const dist = haversineDist(lat, lon, prev.lat, prev.lon);
            const calculatedSpeed = dist / dt; // speed in meters per second
            
            // Set speed in knots
            setSpeedKn(calculatedSpeed * 1.94384);
            
            // Filter out minor indoor GPS drift/jitter (less than 0.7 m/s / 2.5 km/h)
            if (calculatedSpeed > 0.7) {
              setIsMoving(true);
              const brng = getBearing(prev.lat, prev.lon, lat, lon);
              setBearing(brng);
            } else {
              setIsMoving(false);
            }
          }
        } else {
          setBearing(pos.coords.heading || 0);
        }
        lastGPSPosRef.current = { lat, lon, time: now };

        // Only update currentPos if NOT currently simulating
        if (!simulating) {
          setCurrentPos({ lat, lon });
        }
      },
      () => {
        setGpsLocked(false);
      },
      { enableHighAccuracy: true, maximumAge: 0, timeout: 5000 },
    );
    return () => { navigator.geolocation.clearWatch(watchId); };
  }, [simulating]);

  // GPS Navigation Simulator Effect
  useEffect(() => {
    if (!simulating || !routeResult || !routeResult.route || routeResult.route.length === 0) return;

    let intervalMs = 1000;
    let stepSize = 1;

    switch (travelMode) {
      case "walking":
        intervalMs = 1500;
        stepSize = 1;
        break;
      case "motorcycle":
        intervalMs = 1000;
        stepSize = 2;
        break;
      case "car":
        intervalMs = 800;
        stepSize = 3;
        break;
      case "train":
        intervalMs = 600;
        stepSize = 4;
        break;
    }

    const route = routeResult.route;
    const intervalId = setInterval(() => {
      setSimStepIdx((currIdx) => {
        const nextIdx = currIdx + stepSize;
        if (nextIdx >= route.length - 1) {
          clearInterval(intervalId);
          setSimulating(false);
          setIsMoving(false);
          const arrivalMsg = navMode === "road" 
            ? "You have arrived at your destination." 
            : "Destination reached. Heave to and drop anchor.";
          speak(arrivalMsg, voiceOn);
          toast.success("Destination reached");
          setCurrentPos({ lat: route[route.length - 1][0], lon: route[route.length - 1][1] });
          return route.length - 1;
        }

        const p1 = route[currIdx];
        const p2 = route[nextIdx];
        if (p1 && p2) {
          const brng = getBearing(p1[0], p1[1], p2[0], p2[1]);
          setBearing(brng);
          
          const dt = intervalMs / 1000;
          const dist = haversineDist(p1[0], p1[1], p2[0], p2[1]);
          setSpeedKn((dist / dt) * 1.94384);
        }
        setIsMoving(true);
        setCurrentPos({ lat: route[nextIdx][0], lon: route[nextIdx][1] });
        return nextIdx;
      });
    }, intervalMs);

    return () => {
      clearInterval(intervalId);
      setIsMoving(false);
    };
  }, [simulating, routeResult, travelMode, voiceOn, navMode]);

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

  // ----- OSM Address Auto-suggestions -----
  const fetchSuggestions = async (query: string): Promise<Destination[]> => {
    if (!query || query.trim().length < 3) return [];
    try {
      const url = `https://nominatim.openstreetmap.org/search?format=json&limit=5&q=${encodeURIComponent(query)}`;
      const res = await fetch(url, { headers: { "Accept-Language": "en" } });
      const json = await res.json();
      if (!Array.isArray(json)) return [];
      return json.map((item: any) => ({
        lat: parseFloat(item.lat),
        lon: parseFloat(item.lon),
        label: item.display_name,
      }));
    } catch {
      return [];
    }
  };

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

  const handleStartTextChange = async (val: string) => {
    setStartLocationText(val);
    if (val.trim().length >= 3) {
      const sug = await fetchSuggestions(val);
      setStartSuggestions(sug);
      setShowStartSuggestions(true);
    } else {
      setStartSuggestions([]);
      setShowStartSuggestions(false);
    }
  };

  const handleDestTextChange = async (val: string) => {
    setSearchText(val);
    if (val.trim().length >= 3) {
      const sug = await fetchSuggestions(val);
      setDestSuggestions(sug);
      setShowDestSuggestions(true);
    } else {
      setDestSuggestions([]);
      setShowDestSuggestions(false);
    }
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
  const generateRuleBasedAdvisory = (route: RouteResult): AIAssistantAdvisory => {
    const rain = today?.rainProb || 0;
    const isWater = navMode === "water";
    
    let score = 95 - (route.risk_score * 40);
    if (rain > 70) score -= 15;
    if (passengers > 12) score -= 10;
    if (cargoKg > 600) score -= 8;
    score = Math.max(10, Math.min(100, Math.round(score)));

    let safetyClass: "Safe" | "Moderate" | "High Risk" | "Critical" = "Safe";
    if (score < 40) safetyClass = "Critical";
    else if (score < 60) safetyClass = "High Risk";
    else if (score < 80) safetyClass = "Moderate";

    const weatherImpact = rain > 50 
      ? `High rain probability (${rain}%) may degrade visibility and cause slick surfaces/high river waves.` 
      : "Weather conditions are favorable with stable visibility.";

    const anomalyDetected = isWater && rain > 60 
      ? "Volta Basin flood warning: high water flow rates expected." 
      : (cargoKg > 800 ? "Heavy cargo load may reduce steering responsiveness." : "None");

    const adaptiveBehaviorAdvice = isWater
      ? `Piloting tip: Keep vessel speed under ${rain > 50 ? "8" : "12"} knots. Secure all cargo and distribute weight evenly.`
      : `Driving tip: Reduce speed on curves. Maintain a safe following distance of ${rain > 50 ? "50" : "30"} meters.`;

    const movementPrediction = rain > 60
      ? "Conditions are predicted to deteriorate slightly over the next 4 hours as rain clouds settle."
      : "Conditions are expected to remain stable and clear for the next 6 hours.";

    return {
      confidenceScore: score,
      routeSafetyClass: safetyClass,
      weatherImpact,
      anomalyDetected,
      adaptiveBehaviorAdvice,
      movementPrediction
    };
  };

  const fetchAIRouteAdvisory = async (route: RouteResult) => {
    if (!route || !route.route || route.route.length === 0) return;
    setAiAdvisoryLoading(true);
    try {
      const provider = getActiveProvider();
      const prompt = `You are the AGNav AI Navigation Co-Pilot.
Analyze the following navigation route and environmental context:
- Mode: ${navMode}
- Start Location: ${startLocationText || (navMode === "road" ? "Current Location" : "Vessel Home")}
- Destination: ${searchText || farmGpsText || "Target Point"}
- Total Distance: ${(route.distance_m / 1000).toFixed(1)} km
- Total Duration: ${(route.duration_s / 60).toFixed(0)} mins
- Environmental Risk Score (Rule-based): ${route.risk_score} (Level: ${route.risk_level})
- Current Weather / Rain Probability: ${today?.rainProb || 0}%
- Passengers: ${passengers}, Cargo: ${cargoKg} kg

Generate a JSON response assessing the route safety, weather constraints, potential anomalies, and driving/piloting recommendations. Return ONLY valid, raw JSON without markdown syntax wrapper. Return exactly this JSON schema:
{
  "confidenceScore": number (0 to 100 representing safety confidence),
  "routeSafetyClass": "Safe" | "Moderate" | "High Risk" | "Critical",
  "weatherImpact": "concise description of weather impact",
  "anomalyDetected": "hazard/anomaly name or 'None'",
  "adaptiveBehaviorAdvice": "actionable driving/sailing speed or behavior tips based on cargo load and environment",
  "movementPrediction": "expected conditions along path in the next 3-6 hours"
}`;

      const text = await provider.chatCompletion([
        { role: "system", content: "You are the AGNav AI assistant. You reply ONLY with a single JSON object. Do not include markdown codeblocks or triple backticks." },
        { role: "user", content: prompt }
      ]);

      const cleanJson = text.replace(/```json/g, "").replace(/```/g, "").trim();
      const data: AIAssistantAdvisory = JSON.parse(cleanJson);
      setAiAdvisory(data);
    } catch (err) {
      console.warn("AI Advisory edge call failed, using rule-based fallback:", err);
      const localAdvisory = generateRuleBasedAdvisory(route);
      setAiAdvisory(localAdvisory);
    } finally {
      setAiAdvisoryLoading(false);
    }
  };

  const autoReroute = async (currentLat: number, currentLon: number) => {
    let target: { lat: number; lon: number; label: string } | null = destination;
    if (!target && farmTarget) target = { ...farmTarget, label: `Farm ${farmTarget.lat.toFixed(4)}, ${farmTarget.lon.toFixed(4)}` };
    if (!target) return;
    
    setRouteBusy(true);
    try {
      const result = await engineComputeRoute({
        start: { lat: currentLat, lon: currentLon },
        end: { lat: target.lat, lon: target.lon },
        vessel_id: vesselId, user_id: user?.id,
        load: { passengers, cargo_kg: cargoKg },
        rainProb: today?.rainProb,
      });
      setRouteResult(result);
      lastTurnAnnouncedIdxRef.current = -1;
      lastArrivalAnnouncedRef.current = false;
      lastOffCourseAnnouncedRef.current = 0;
      lastTurnAnnouncementStageRef.current = { index: -1, stage: 'none' };
      setCurrentRouteIdx(0);
      toast.success("Route recalculated automatically");
      speak("Rerouting. A new path has been calculated.", voiceOn);
      
      // Refresh AI advisory
      fetchAIRouteAdvisory(result);
    } catch (err: any) {
      console.error("Auto-rerouting failed:", err);
    } finally {
      setRouteBusy(false);
    }
  };

  const computeRoute = async () => {
    let target: { lat: number; lon: number; label: string } | null = destination;
    if (!target && farmTarget) target = { ...farmTarget, label: `Farm ${farmTarget.lat.toFixed(4)}, ${farmTarget.lon.toFixed(4)}` };
    if (!target) { toast.error("Enter a farm GPS, pick on map, or search a destination"); return; }
    
    // Choose start location (fallback to current position if not defined or in water mode)
    const startPoint = (navMode === "road" && startLocation)
      ? { lat: startLocation.lat, lon: startLocation.lon }
      : { lat: currentPos.lat, lon: currentPos.lon };

    if (!startPoint.lat || !startPoint.lon) { toast.error("Start location coordinates unavailable"); return; }
    setRouteBusy(true);
    try {
      const result = await engineComputeRoute({
        start: startPoint,
        end: { lat: target.lat, lon: target.lon },
        vessel_id: vesselId, user_id: user?.id,
        load: { passengers, cargo_kg: cargoKg },
        rainProb: today?.rainProb,
      });
      setRouteResult(result);
      lastTurnAnnouncedIdxRef.current = -1;
      lastArrivalAnnouncedRef.current = false;
      lastOffCourseAnnouncedRef.current = 0;
      lastTurnAnnouncementStageRef.current = { index: -1, stage: 'none' };
      setCurrentRouteIdx(0);
      setSimStepIdx(0);
      setSimulating(false);
      setIsNavigating(false);
      
      const km = (result.distance_m / 1000).toFixed(1);
      const min = (result.duration_s / 60).toFixed(0);
      toast.success(`Route ${km} km · ${min} min · risk ${result.risk_level}`);
      speak(`Route ready. ${km} kilometres. About ${min} minutes. Risk ${result.risk_level}.`, voiceOn);

      // Async AI route assessment
      fetchAIRouteAdvisory(result);
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

  const center: [number, number] = simulating
    ? [currentPos.lat || 7.95, currentPos.lon || -1.03]
    : destination
    ? [destination.lat, destination.lon]
    : farmTarget ? [farmTarget.lat, farmTarget.lon]
    : [currentPos.lat || 7.95, currentPos.lon || -1.03];

  return (
    <div className="p-4 lg:p-6 max-w-7xl mx-auto space-y-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            {navMode === "road" ? (
              <><Navigation className="h-6 w-6 text-emerald-500 animate-pulse" /> AGNav — Real-Time Road Navigator</>
            ) : (
              <><Anchor className="h-6 w-6 text-primary" /> AGNav — Decentralized Water Navigator</>
            )}
          </h1>
          <p className="text-sm text-muted-foreground">
            {navMode === "road" ? (
              <>GPS tracking · address autocomplete · real-time travel simulator</>
            ) : (
              <>Vessel <span className="font-mono">{vesselId}</span> {registered ? <Badge variant="outline" className="ml-2 text-xs">Registered</Badge> : <Badge variant="destructive" className="ml-2 text-xs">Unregistered</Badge>} · peer-to-peer SOS · live routing</>
            )}
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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-start">
        {/* Navigation Sidebar & Controls */}
        <div className="space-y-4 lg:col-span-1">
          {/* Destination search */}
          <Card className="relative"><CardContent className="p-3 space-y-3">
        {navMode === "road" ? (
          <div className="space-y-3">
            {/* START LOCATION INPUT */}
            <div className="relative space-y-1">
              <Label className="text-xs font-semibold text-muted-foreground">Start Location</Label>
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <MapPin className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-emerald-500" />
                  <Input 
                    value={startLocationText} 
                    onChange={(e) => handleStartTextChange(e.target.value)}
                    placeholder="Enter starting point (defaults to GPS location)" 
                    className="pl-9 h-10 font-medium" 
                  />
                  {startLocationText && (
                    <Button 
                      size="sm" 
                      variant="ghost" 
                      onClick={() => { setStartLocation(null); setStartLocationText(""); }} 
                      className="absolute right-2 top-1/2 -translate-y-1/2 h-7 w-7 p-0"
                    >
                      ×
                    </Button>
                  )}
                </div>
                <Button variant="ghost" onClick={() => {
                  if (currentPos.lat) {
                    setStartLocation({ lat: currentPos.lat, lon: currentPos.lon, label: "Current Location" });
                    setStartLocationText("Current Location");
                    toast.success("Start location set to current GPS coordinates");
                  }
                }} className="h-10 px-2" title="Use current position">
                  <Crosshair className="h-4 w-4" />
                </Button>
              </div>

              {/* Start Suggestions Dropdown */}
              {showStartSuggestions && startSuggestions.length > 0 && (
                <div className="absolute left-0 right-0 mt-1 bg-popover text-popover-foreground border rounded-lg shadow-lg z-[100] max-h-48 overflow-y-auto divide-y divide-border">
                  {startSuggestions.map((item, idx) => (
                    <div 
                      key={`start-sug-${idx}`}
                      onClick={() => {
                        setStartLocation(item);
                        setStartLocationText(item.label);
                        setShowStartSuggestions(false);
                        toast.success("Start location set");
                      }}
                      className="p-2 text-xs hover:bg-accent hover:text-accent-foreground cursor-pointer transition-colors font-medium text-left truncate"
                    >
                      {item.label}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* DESTINATION LOCATION INPUT */}
            <div className="relative space-y-1">
              <Label className="text-xs font-semibold text-muted-foreground">Destination Location</Label>
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-primary" />
                  <Input 
                    value={searchText} 
                    onChange={(e) => handleDestTextChange(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") handleSearch(); }}
                    placeholder="Where to? (e.g. Accra Mall, Kumasi)" 
                    className="pl-9 h-10 font-medium" 
                  />
                  {searchText && (
                    <Button 
                      size="sm" 
                      variant="ghost" 
                      onClick={() => { setDestination(null); setSearchText(""); setRouteResult(null); }} 
                      className="absolute right-2 top-1/2 -translate-y-1/2 h-7 w-7 p-0"
                    >
                      ×
                    </Button>
                  )}
                </div>
                <Button variant="outline" onClick={toggleVoiceInput} className="h-10 px-3">{listening ? <MicOff className="h-4 w-4 text-red-500" /> : <Mic className="h-4 w-4" />}</Button>
              </div>

              {/* Dest Suggestions Dropdown */}
              {showDestSuggestions && destSuggestions.length > 0 && (
                <div className="absolute left-0 right-0 mt-1 bg-popover text-popover-foreground border rounded-lg shadow-lg z-[100] max-h-48 overflow-y-auto divide-y divide-border">
                  {destSuggestions.map((item, idx) => (
                    <div 
                      key={`dest-sug-${idx}`}
                      onClick={() => {
                        setDestination(item);
                        setSearchText(item.label);
                        setShowDestSuggestions(false);
                        toast.success("Destination set");
                        setRouteResult(null);
                      }}
                      className="p-2 text-xs hover:bg-accent hover:text-accent-foreground cursor-pointer transition-colors font-medium text-left truncate"
                    >
                      {item.label}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* TRANSPORT MODE SELECTOR */}
            <div className="space-y-1">
              <Label className="text-xs font-semibold text-muted-foreground">Transport Mode</Label>
              <div className="grid grid-cols-4 gap-1.5 bg-muted p-1 rounded-lg border border-border/60">
                <Button
                  variant={travelMode === "car" ? "secondary" : "ghost"}
                  size="sm"
                  onClick={() => {
                    setTravelMode("car");
                    speak("Travel mode set to vehicle.", voiceOn);
                    toast.info("Vehicle navigation mode (Speed: Car)");
                  }}
                  className="h-8 text-xs flex items-center gap-1 font-semibold"
                >
                  <Car className="h-3.5 w-3.5" /> Vehicle
                </Button>
                <Button
                  variant={travelMode === "motorcycle" ? "secondary" : "ghost"}
                  size="sm"
                  onClick={() => {
                    setTravelMode("motorcycle");
                    speak("Travel mode set to motor.", voiceOn);
                    toast.info("Motorcycle navigation mode (Speed: Motor)");
                  }}
                  className="h-8 text-xs flex items-center gap-1 font-semibold"
                >
                  <Bike className="h-3.5 w-3.5" /> Motor
                </Button>
                <Button
                  variant={travelMode === "train" ? "secondary" : "ghost"}
                  size="sm"
                  onClick={() => {
                    setTravelMode("train");
                    speak("Travel mode set to train.", voiceOn);
                    toast.info("Train transit mode (Speed: High-speed)");
                  }}
                  className="h-8 text-xs flex items-center gap-1 font-semibold"
                >
                  <Train className="h-3.5 w-3.5" /> Train
                </Button>
                <Button
                  variant={travelMode === "walking" ? "secondary" : "ghost"}
                  size="sm"
                  onClick={() => {
                    setTravelMode("walking");
                    speak("Travel mode set to walking.", voiceOn);
                    toast.info("Pedestrian walking mode (Speed: Walking)");
                  }}
                  className="h-8 text-xs flex items-center gap-1 font-semibold"
                >
                  <Footprints className="h-3.5 w-3.5" /> Walking
                </Button>
              </div>
            </div>

          </div>
        ) : (
          /* WATER TRANSPORT SEARCH (MARINE) */
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
        )}

        <div className="flex items-center justify-between border-t border-border/50 pt-2 text-xs">
          <span className="text-muted-foreground font-medium flex items-center gap-1">
            <Navigation className="h-3 w-3" /> Navigation Profile
          </span>
          <div className="flex bg-muted p-0.5 rounded-lg border border-border">
            <Button
              variant={navMode === "water" ? "secondary" : "ghost"}
              size="sm"
              onClick={() => {
                setNavMode("water");
                if (typeof window !== "undefined") localStorage.setItem("agnav.nav_mode", "water");
                speak("Switched to water transport navigation. Marine voice director active.", voiceOn);
                toast.info("Marine navigator active (Nautical director)");
              }}
              className="h-7 text-[11px] px-2.5 flex items-center gap-1 font-semibold"
            >
              <Waves className="h-3.5 w-3.5" /> Marine Mode
            </Button>
            <Button
              variant={navMode === "road" ? "secondary" : "ghost"}
              size="sm"
              onClick={() => {
                setNavMode("road");
                if (typeof window !== "undefined") localStorage.setItem("agnav.nav_mode", "road");
                speak("Switched to road transport navigation. Road voice director active.", voiceOn);
                toast.info("Road driving navigator active (Road director)");
              }}
              className="h-7 text-[11px] px-2.5 flex items-center gap-1 font-semibold"
            >
              <Car className="h-3.5 w-3.5" /> Road Driving Mode
            </Button>
          </div>
        </div>
        {destination && (
          <div className="space-y-3 pt-2 border-t border-border/40">
            <div className="text-xs text-muted-foreground flex items-center gap-2 flex-wrap">
              <MapPin className="h-3.5 w-3.5 text-primary" />
              <span className="font-medium text-foreground truncate max-w-[200px]">{destination.label}</span>
              <span>· {destination.lat.toFixed(4)}, {destination.lon.toFixed(4)}</span>
              <Button size="sm" className="ml-auto" onClick={computeRoute} disabled={routeBusy}>
                {routeBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <><Navigation className="h-3.5 w-3.5 mr-1" />Navigate</>}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => { setDestination(null); setRouteResult(null); setSimStepIdx(0); setSimulating(false); }}>Clear</Button>
            </div>

            {/* SIMULATION GPS PLAYER CONTROLS & AI CO-PILOT ADVISORY */}
            {routeResult && (
              <div className="space-y-3">
                <div className="bg-emerald-500/10 border border-emerald-500/25 p-3 rounded-lg space-y-3 mt-2 text-left">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-emerald-700 flex items-center gap-1">
                      <Navigation className="h-3.5 w-3.5 animate-pulse" /> Active Navigation Control
                    </span>
                    <span className="font-mono bg-emerald-500/20 px-1.5 py-0.5 rounded text-[10px] text-emerald-800 uppercase font-bold">
                      {navMode === "road" ? `${travelMode} mode` : "water route"}
                    </span>
                  </div>

                  <div className="flex flex-col gap-2">
                    {/* Mode toggles */}
                    <div className="flex items-center justify-between text-xs border-b border-emerald-500/10 pb-2">
                      <span className="text-muted-foreground">Simulation Mode</span>
                      <Switch
                        checked={simulating}
                        onCheckedChange={(checked) => {
                          setSimulating(checked);
                          if (checked) {
                            setIsNavigating(false);
                            speak("Simulation mode activated.", voiceOn);
                          } else {
                            if (position.lat && position.lon) {
                              setCurrentPos({ lat: position.lat, lon: position.lon });
                            }
                            speak("Live navigation mode activated.", voiceOn);
                          }
                        }}
                      />
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="flex gap-1.5">
                        {simulating ? (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setSimulating(false);
                              speak("Navigation simulation paused.", voiceOn);
                            }}
                            className="h-9 w-9 p-0 border-emerald-500/30 hover:bg-emerald-500/20 text-emerald-700"
                          >
                            <Pause className="h-4 w-4" />
                          </Button>
                        ) : isNavigating ? (
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => {
                              setIsNavigating(false);
                              speak("Live navigation stopped.", voiceOn);
                            }}
                            className="h-9 px-3 flex items-center gap-1 font-semibold text-xs"
                          >
                            <Square className="h-3.5 w-3.5 mr-1" /> Stop
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            onClick={() => {
                              setIsNavigating(true);
                              setIsAutoFollow(true);
                              speak(`Starting live navigation guidance.`, voiceOn);
                            }}
                            className="h-9 bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-1 px-3 text-xs font-semibold"
                          >
                            <Play className="h-3.5 w-3.5 fill-current" /> Start
                          </Button>
                        )}

                        {simulating && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setSimulating(false);
                              setSimStepIdx(0);
                              if (routeResult.route && routeResult.route.length > 0) {
                                setCurrentPos({ lat: routeResult.route[0][0], lon: routeResult.route[0][1] });
                              }
                              speak("Guidance reset to starting point.", voiceOn);
                              toast.info("Navigator reset to start position");
                            }}
                            className="h-9 w-9 p-0 border-emerald-500/30 hover:bg-emerald-500/20 text-emerald-700"
                          >
                            <Square className="h-3.5 w-3.5 fill-current" />
                          </Button>
                        )}
                      </div>

                      <div className="flex-1 space-y-1">
                        <div className="flex justify-between text-[10px] text-muted-foreground">
                          <span>Progress</span>
                          <span>{routeResult.route ? Math.round((activeRouteIdx / (routeResult.route.length - 1)) * 100) : 0}%</span>
                        </div>
                        <div className="w-full bg-emerald-500/20 h-1.5 rounded-full overflow-hidden">
                          <div 
                            className="bg-emerald-600 h-full transition-all duration-300"
                            style={{ width: `${routeResult.route ? (activeRouteIdx / (routeResult.route.length - 1)) * 100 : 0}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* AI CO-PILOT ADVISORY CARD */}
                <Card className="border-emerald-500/30 bg-gradient-to-br from-emerald-500/5 to-amber-500/5 shadow-sm">
                  <CardContent className="p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-emerald-700 flex items-center gap-1">
                        <Bot className="h-4 w-4 text-emerald-600 animate-pulse" /> AI Co-Pilot Advisor
                      </span>
                      {aiAdvisoryLoading ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin text-emerald-600" />
                      ) : aiAdvisory ? (
                        <Badge 
                          variant="outline" 
                          className={`text-[9px] font-bold uppercase ${
                            aiAdvisory.routeSafetyClass === "Safe" ? "text-green-600 border-green-200 bg-green-50" :
                            aiAdvisory.routeSafetyClass === "Moderate" ? "text-yellow-600 border-yellow-200 bg-yellow-50" :
                            aiAdvisory.routeSafetyClass === "High Risk" ? "text-orange-600 border-orange-200 bg-orange-50" :
                            "text-red-600 border-red-200 bg-red-50"
                          }`}
                        >
                          {aiAdvisory.routeSafetyClass} (Conf: {aiAdvisory.confidenceScore}%)
                        </Badge>
                      ) : null}
                    </div>

                    {aiAdvisoryLoading ? (
                      <div className="py-4 text-center text-xs text-muted-foreground flex flex-col items-center justify-center gap-1.5">
                        <Loader2 className="h-5 w-5 animate-spin text-primary" />
                        Synthesizing environmental route intelligence...
                      </div>
                    ) : aiAdvisory ? (
                      <div className="space-y-2 text-xs">
                        <div className="bg-background/60 p-2 rounded border border-border/40">
                          <span className="font-semibold text-muted-foreground block text-[10px] uppercase">Weather Impact</span>
                          <p className="text-foreground text-[11px] leading-snug">{aiAdvisory.weatherImpact}</p>
                        </div>
                        <div className="bg-background/60 p-2 rounded border border-border/40">
                          <span className="font-semibold text-muted-foreground block text-[10px] uppercase">Adaptive Advice</span>
                          <p className="text-foreground text-[11px] leading-snug">{aiAdvisory.adaptiveBehaviorAdvice}</p>
                        </div>
                        <div className="bg-background/60 p-2 rounded border border-border/40">
                          <span className="font-semibold text-muted-foreground block text-[10px] uppercase">Anomaly & Prediction</span>
                          <p className="text-foreground text-[11px] leading-snug">
                            {aiAdvisory.anomalyDetected !== "None" ? (
                              <span className="text-destructive font-semibold">Anomaly: {aiAdvisory.anomalyDetected}. </span>
                            ) : null}
                            {aiAdvisory.movementPrediction}
                          </p>
                        </div>
                      </div>
                    ) : (
                      <div className="py-2 text-center text-[11px] text-muted-foreground">
                        No route analysis available. Compute a route to get AI advisory.
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            )}
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

        </div>

        {/* Dynamic Route Map & Environmental Filters */}
        <div className="space-y-4 lg:col-span-2">
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

        <div className="relative rounded-lg overflow-hidden border h-[340px] sm:h-[480px] lg:h-[62vh] w-full">
          {/* Floating GPS Lock status & telemetry badge */}
          <div className="absolute top-4 left-4 z-[1000] pointer-events-none flex flex-col gap-1.5">
            <Badge className={`shadow-md text-[10px] font-bold py-1 px-2 border flex items-center gap-1.5 ${
              gpsLocked 
                ? "bg-green-500/90 text-white border-green-400" 
                : "bg-red-500/90 text-white border-red-400 animate-pulse"
            }`}>
              <span className={`h-1.5 w-1.5 rounded-full bg-white ${gpsLocked ? "animate-ping" : ""}`} />
              {gpsLocked ? "GPS LOCKED" : "GPS DISCONNECTED"}
            </Badge>
            {gpsLocked && speedKn > 0 && (
              <Badge className="bg-background/90 text-foreground border shadow-md text-[10px] font-mono py-0.5 px-1.5">
                SPEED: {speedKn.toFixed(1)} KN · HDG: {bearing.toFixed(0)}°
              </Badge>
            )}
          </div>

          {/* Floating Recenter button */}
          {!isAutoFollow && (
            <Button
              size="sm"
              onClick={() => {
                setIsAutoFollow(true);
                speak("Recentered on your location.", voiceOn);
              }}
              className="absolute bottom-4 right-4 z-[1000] bg-background/95 hover:bg-background border shadow-md font-semibold text-xs flex items-center gap-1"
            >
              <Crosshair className="h-4 w-4 text-primary" /> Recenter
            </Button>
          )}

          <MapContainer center={center} zoom={destination || farmTarget ? 11 : 7} scrollWheelZoom style={{ height: "100%", width: "100%" }}>
            <FlyTo lat={center[0]} lon={center[1]} zoom={destination || farmTarget ? 11 : 7} />
            <MapController center={[currentPos.lat || 7.95, currentPos.lon || -1.03]} isAutoFollow={isAutoFollow} onMapInteraction={() => setIsAutoFollow(false)} />
            
            {pickOnMap && <MapClickPicker onPick={onMapPick} />}
            <LayersControl position="topright">
              <LayersControl.BaseLayer checked={navMode === "road"} name="Streets"><TileLayer attribution="&copy; OpenStreetMap" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" /></LayersControl.BaseLayer>
              <LayersControl.BaseLayer name="Satellite"><TileLayer attribution="Tiles © Esri" url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}" /></LayersControl.BaseLayer>
              <LayersControl.BaseLayer checked={navMode === "water"} name="AGNav (terrain)"><TileLayer attribution="© OpenTopoMap" url="https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png" /></LayersControl.BaseLayer>
            </LayersControl>

            {navMode === "water" && <Polygon positions={VOLTA_BASIN} pathOptions={{ color: "#2563eb", weight: 1, fillOpacity: 0.05 }} />}

            {navMode === "water" && showRisk && FLOOD_ZONES.map((z) => (
              <Polygon key={z.name} positions={z.coords} pathOptions={{ color: "#dc2626", fillColor: "#dc2626", fillOpacity: 0.15 }}>
                <Popup>{z.name} — flood-prone</Popup>
              </Polygon>
            ))}

            {navMode === "water" && showHeat && heatLayers[heatDay]?.map((p, i) => (
              <Circle key={`h-${heatDay}-${i}`} center={[p.lat, p.lon]} radius={8000 + p.intensity * 14000}
                pathOptions={{ color: heatColor(p.intensity), fillColor: heatColor(p.intensity), fillOpacity: 0.18 + p.intensity * 0.25, weight: 0 }} />
            ))}

            {navMode === "water" && showWind && today && (
              <CircleMarker center={[currentPos.lat || 7.95, currentPos.lon || -1.03]} radius={Math.max(6, ((today as any).windSpeed || 4))}
                pathOptions={{ color: "#0891b2", fillColor: "#0891b2", fillOpacity: 0.4 }}>
                <Popup>Wind {(today as any).windSpeed || 0} m/s {(today as any).windDir != null ? `· ${(today as any).windDir}°` : ""}</Popup>
              </CircleMarker>
            )}

            {navMode === "water" && showCurrent && RIVER_CURRENTS.map((c, i) => {
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

            {/* Custom Rotated Navigation Pointer (Blue Dot) */}
            {currentPos.lat && currentPos.lon && (
              <Marker 
                position={[currentPos.lat, currentPos.lon]}
                icon={createNavigationPointer(bearing, sosStatus && sosStatus.status !== "RESOLVED", blink)}
              >
                <Popup>
                  <div className="text-xs space-y-1">
                    <p className="font-bold">You · {vesselId}</p>
                    <p>Speed: {speedKn.toFixed(1)} knots</p>
                    <p>Bearing: {bearing.toFixed(0)}°</p>
                  </div>
                </Popup>
              </Marker>
            )}

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

            {/* Glowing gold logo route line for remaining path */}
            {routeResult && routeResult.route && (
              <Polyline
                positions={routeResult.route.slice(activeRouteIdx)}
                pathOptions={{ color: "#d4af37", weight: 6, opacity: 0.95 }}
              />
            )}

            {/* Faded completed path line */}
            {routeResult && routeResult.route && activeRouteIdx > 0 && (
              <Polyline
                positions={routeResult.route.slice(0, activeRouteIdx + 1)}
                pathOptions={{ color: "#94a3b8", weight: 4, opacity: 0.5, dashArray: "4 4" }}
              />
            )}

            {/* Risk segment overlay */}
            {routeResult && routeResult.risk_segments.map((s, i) => (
              <Polyline key={`seg-${i}`} positions={s.coords} pathOptions={{ color: segmentColour(s.level), weight: 3, opacity: 0.4 }} />
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
      </div>
    </div>
  );
}
