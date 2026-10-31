import { useEffect, useRef, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getAdapter } from "@/lib/drone/connectionManager";
import { ConnectionAdapter, ConnectionDiagnostics, DiscoveredDrone, DroneProtocol, DroneTelemetry, FlightStatus } from "@/lib/drone/types";
import { logConnectionEvent } from "@/lib/drone/eventLog";


// Back-compat aliases used by existing components
export type DroneStatus = FlightStatus;
export interface TelemetryData extends DroneTelemetry {}
export interface EnvironmentData {
  windSpeed: number;
  windDirection: string;
  temperature: number;
  humidity: number;
  rainProbability: number;
  visibility: number;
}

const INITIAL_TELEMETRY: DroneTelemetry = {
  lat: undefined, lng: undefined,
  altitude: 0, groundSpeed: 0, verticalSpeed: 0, heading: 0,
  battery: 100, signalStrength: 0, gpsAccuracy: 0, gpsFix: "none",
  flightDuration: 0, distanceCovered: 0, cameraStatus: "off",
};

export const useDroneState = () => {
  const [protocol, setProtocol] = useState<DroneProtocol>("simulator");
  const [status, setStatus] = useState<FlightStatus>("disconnected");
  const [available, setAvailable] = useState<DiscoveredDrone[]>([]);
  const [activeDrone, setActiveDrone] = useState<DiscoveredDrone | null>(null);
  const [telemetry, setTelemetry] = useState<DroneTelemetry>(INITIAL_TELEMETRY);
  const [lastTelemetryAt, setLastTelemetryAt] = useState<number | null>(null);
  const [missionId, setMissionId] = useState<string | null>(null);
  const [diagnostics, setDiagnostics] = useState<ConnectionDiagnostics>({ transport: "none", framesReceived: 0, bytesReceived: 0 });

  const [environment, setEnvironment] = useState<EnvironmentData>({
    windSpeed: 12, windDirection: "NE", temperature: 28, humidity: 65, rainProbability: 10, visibility: 10,
  });

  const adapterRef = useRef<ConnectionAdapter | null>(null);
  const unsubRef = useRef<Array<() => void>>([]);

  // Acquire adapter on protocol change
  useEffect(() => {
    unsubRef.current.forEach((u) => u());
    unsubRef.current = [];
    const adapter = getAdapter(protocol);
    adapterRef.current = adapter;
    logConnectionEvent({ type: "protocol_change", protocol, message: `Protocol switched to ${protocol}` });
    unsubRef.current.push(adapter.onStatus((s) => {
      setStatus(s);
      if (s === "connected") logConnectionEvent({ type: "connect", protocol, aircraftId: activeDrone?.id, aircraftName: activeDrone?.name, message: `Aircraft connected via ${protocol}` });
      if (s === "disconnected") logConnectionEvent({ type: "disconnect", protocol, aircraftId: activeDrone?.id, aircraftName: activeDrone?.name, message: `Aircraft disconnected` });
    }));
    setLastTelemetryAt(null);
    unsubRef.current.push(adapter.onTelemetry((nextTelemetry) => {
      setTelemetry(nextTelemetry);
      setLastTelemetryAt(Date.now());
    }));
    if (adapter.onDiagnostics) unsubRef.current.push(adapter.onDiagnostics(setDiagnostics));
    return () => { unsubRef.current.forEach((u) => u()); };
  }, [protocol]);


  // Merge adapter-native discovery with the user's registered aircraft
  // (public.drones) so any powered-on / registered asset appears in Asset
  // Discovery regardless of the currently-selected protocol. Registered
  // entries whose stored protocol matches the active one are prioritised.
  const fetchRegisteredAircraft = useCallback(async (): Promise<DiscoveredDrone[]> => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];
      const { data } = await supabase
        .from("drones").select("id,name,model,protocol,aircraft_type,manufacturer,status,last_seen_at")
        .eq("user_id", user.id).order("last_seen_at", { ascending: false, nullsFirst: false });
      return (data || []).map((d: any) => ({
        id: d.id,
        name: d.name || "Unnamed aircraft",
        model: d.model || "—",
        protocol: (d.protocol || "aih") as any,
        signal: d.status === "offline" ? 0 : 90,
        firmware: d.manufacturer || undefined,
        aircraftType: (d.aircraft_type || "drone") as any,
        type: (d.aircraft_type || "drone") as any,
        manufacturer: d.manufacturer || undefined,
      }));
    } catch { return []; }
  }, []);

  const mergeAvailable = useCallback((adapterFound: DiscoveredDrone[], registered: DiscoveredDrone[]) => {
    const seen = new Set<string>();
    const out: DiscoveredDrone[] = [];
    // Registered assets first (matching protocol on top)
    const sortedReg = [...registered].sort((a, b) => Number(b.protocol === protocol) - Number(a.protocol === protocol));
    for (const d of [...sortedReg, ...adapterFound]) {
      if (!d || seen.has(d.id)) continue;
      seen.add(d.id);
      out.push(d);
    }
    return out;
  }, [protocol]);

  const scan = useCallback(async () => {
    if (!adapterRef.current) return [];
    let adapterFound: DiscoveredDrone[] = [];
    try { adapterFound = await adapterRef.current.scan(); } catch { /* protocol may need hardware */ }
    const registered = await fetchRegisteredAircraft();
    const merged = mergeAvailable(adapterFound, registered);
    setAvailable(merged);
    return merged;
  }, [fetchRegisteredAircraft, mergeAvailable]);

  // Auto-refresh registered assets so newly-registered/powered-on aircraft
  // appear in Asset Discovery without a manual refresh.
  useEffect(() => {
    let stopped = false;
    const tick = async () => {
      if (stopped) return;
      if (status === "disconnected" || status === "connecting") {
        const registered = await fetchRegisteredAircraft();
        setAvailable((prev) => mergeAvailable(prev.filter((d) => !registered.find((r) => r.id === d.id)), registered));
      }
    };
    tick();
    const t = setInterval(tick, 8000);
    return () => { stopped = true; clearInterval(t); };
  }, [status, fetchRegisteredAircraft, mergeAvailable]);

  const connect = useCallback(async (drone?: DiscoveredDrone) => {
    if (!adapterRef.current) return;
    let target = drone || available[0];
    if (!target) {
      const found = await scan();
      target = found[0];
      if (!target) return;
    }
    setActiveDrone(target);
    // Persist aircraft-type hint so AGNav marker + other views can react in real time
    try { localStorage.setItem("aih_active_type", (target.type || target.aircraftType || "drone") as string); } catch {}
    await adapterRef.current.connect(target.id);
    // Best-effort: mark the registered row as connected so admin/registry views update immediately
    try {
      await supabase.from("drones").update({
        status: "connected", last_handshake_at: new Date().toISOString(), last_seen_at: new Date().toISOString(),
      }).eq("id", target.id);
    } catch {}
  }, [available, scan]);

  const disconnect = useCallback(async () => {
    const priorId = activeDrone?.id;
    await adapterRef.current?.disconnect();
    if (priorId) { try { await supabase.from("drones").update({ status: "offline", last_seen_at: new Date().toISOString() }).eq("id", priorId); } catch {} }
    setActiveDrone(null);
    setMissionId(null);
  }, [activeDrone]);

  const calibrate = useCallback(async () => { await adapterRef.current?.calibrate(); }, []);

  const startMission = useCallback(async (config?: { missionType?: string; name?: string; altitude_m?: number }) => {
    if (!adapterRef.current) return;
    await adapterRef.current.startMission();
    // Persist mission record
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data } = await supabase.from("drone_missions").insert({
          user_id: user.id,
          mission_type: config?.missionType || "monitoring",
          name: config?.name || `Mission ${new Date().toLocaleString()}`,
          altitude_m: config?.altitude_m || telemetry.altitude || 50,
          status: "active",
          started_at: new Date().toISOString(),
          target_lat: telemetry.lat ?? null,
          target_lon: telemetry.lng ?? null,
        }).select("id").maybeSingle();
        if (data?.id) setMissionId(data.id);
      }
    } catch (e) { /* offline ok */ }
  }, [telemetry.altitude, telemetry.lat, telemetry.lng]);

  const pauseMission = useCallback(async () => { await adapterRef.current?.pauseMission(); }, []);
  const resumeMission = useCallback(async () => { await adapterRef.current?.resumeMission(); }, []);

  const returnToHome = useCallback(async () => { await adapterRef.current?.returnToHome(); }, []);

  const emergencyLand = useCallback(async () => {
    await adapterRef.current?.emergencyLand();
    if (missionId) {
      await supabase.from("drone_missions").update({ status: "aborted", completed_at: new Date().toISOString() }).eq("id", missionId);
      setMissionId(null);
    }
  }, [missionId]);

  // Persist telemetry breadcrumbs while flying
  useEffect(() => {
    if (status !== "flying" || !missionId) return;
    const t = setInterval(async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        await supabase.from("drone_telemetry_logs").insert({
          user_id: user.id, mission_id: missionId,
          lat: telemetry.lat, lng: telemetry.lng,
          altitude_m: telemetry.altitude, ground_speed_ms: telemetry.groundSpeed,
          vertical_speed_ms: telemetry.verticalSpeed, heading: telemetry.heading,
          battery_pct: telemetry.battery, signal_strength: telemetry.signalStrength,
          gps_accuracy_m: telemetry.gpsAccuracy,
        });
      } catch {}
    }, 5000);
    return () => clearInterval(t);
  }, [status, missionId, telemetry]);

  const droneName = activeDrone?.name || "No Drone";

  // Derived UI connection state driven by real backend events (adapter status +
  // active mission + telemetry age). Consumed by the Connection Manager UI.
  let connectionState:
    | "offline" | "searching" | "aircraft_found" | "connecting" | "connected"
    | "in_flight" | "recording" | "connection_lost" | "reconnecting" | "mission_complete" = "offline";

  if (status === "disconnected") {
    connectionState = activeDrone ? "connection_lost" : (available.length > 0 ? "aircraft_found" : "offline");
  } else if (status === "connecting") {
    connectionState = activeDrone ? "connecting" : "searching";
  } else if (status === "connected" || status === "calibrating" || status === "armed") {
    connectionState = "connected";
  } else if (status === "flying" || status === "returning" || status === "landing") {
    connectionState = missionId ? "in_flight" : "connected";
  } else if (status === "paused") {
    connectionState = missionId ? "in_flight" : "connected";
  } else if (status === "emergency") {
    connectionState = "connection_lost";
  }

  return {
    protocol, setProtocol,
    status, telemetry, lastTelemetryAt, environment, setEnvironment,
    available, activeDrone, droneName,
    missionId, diagnostics,
    connectionState,
    scan, connect, disconnect, calibrate,
    startMission, pauseMission, resumeMission, returnToHome, emergencyLand,
  };
};

export type UseDroneState = ReturnType<typeof useDroneState>;
export type ConnectionState =
  | "offline" | "searching" | "aircraft_found" | "connecting" | "connected"
  | "in_flight" | "recording" | "connection_lost" | "reconnecting" | "mission_complete";


