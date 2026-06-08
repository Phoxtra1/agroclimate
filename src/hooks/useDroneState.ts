import { useEffect, useRef, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getAdapter } from "@/lib/drone/connectionManager";
import { ConnectionAdapter, DiscoveredDrone, DroneProtocol, DroneTelemetry, FlightStatus } from "@/lib/drone/types";
import { useToast } from "@/hooks/use-toast";

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
  const { toast } = useToast();
  const [protocol, setProtocol] = useState<DroneProtocol>("simulator");
  const [status, setStatus] = useState<FlightStatus>("disconnected");
  const [available, setAvailable] = useState<DiscoveredDrone[]>([]);
  const [activeDrone, setActiveDrone] = useState<DiscoveredDrone | null>(null);
  const [telemetry, setTelemetry] = useState<DroneTelemetry>(INITIAL_TELEMETRY);
  const [missionId, setMissionId] = useState<string | null>(null);

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
    unsubRef.current.push(adapter.onStatus(setStatus));
    unsubRef.current.push(adapter.onTelemetry(setTelemetry));
    return () => { unsubRef.current.forEach((u) => u()); };
  }, [protocol]);

  const scan = useCallback(async () => {
    if (!adapterRef.current) return [];
    const found = await adapterRef.current.scan();
    setAvailable(found);
    return found;
  }, []);

  const connect = useCallback(async (drone?: DiscoveredDrone) => {
    if (!adapterRef.current) return;
    const target = drone || available[0];
    if (!target) {
      const found = await adapterRef.current.scan();
      setAvailable(found);
      if (!found[0]) return;
      setActiveDrone(found[0]);
      await adapterRef.current.connect(found[0].id);
      return;
    }
    setActiveDrone(target);
    await adapterRef.current.connect(target.id);
  }, [available]);

  const disconnect = useCallback(async () => {
    await adapterRef.current?.disconnect();
    setActiveDrone(null);
    setMissionId(null);
  }, []);

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

  // Track and save drone location at all times in real-time
  useEffect(() => {
    if (telemetry.lat != null && telemetry.lng != null && ["flying", "returning", "landing", "emergency", "connected", "armed", "paused"].includes(status)) {
      localStorage.setItem(
        "last_known_drone_pos",
        JSON.stringify({
          lat: telemetry.lat,
          lng: telemetry.lng,
          altitude: telemetry.altitude,
          timestamp: new Date().toISOString(),
          droneName: activeDrone?.name || "Odeneho Drone",
        })
      );
    }
  }, [telemetry.lat, telemetry.lng, telemetry.altitude, status, activeDrone]);

  // Automatic weather degradation simulation
  useEffect(() => {
    if (status !== "flying") {
      // Reset to safe levels when not flying
      setEnvironment({
        windSpeed: 12,
        windDirection: "NE",
        temperature: 28,
        humidity: 65,
        rainProbability: 10,
        visibility: 10,
      });
      return;
    }

    const timer = setTimeout(() => {
      setEnvironment({
        windSpeed: 38, // Heavy wind
        windDirection: "WSW",
        temperature: 24,
        humidity: 92,
        rainProbability: 95, // Heavy rain
        visibility: 3, // Poor visibility
      });
      toast({
        title: "CRITICAL WEATHER ALERT",
        description: "Wind became heavy (38 km/h) with signs of heavy rain in flight area. Emergency landing recommended!",
        variant: "destructive",
      });
    }, 20000); // 20 seconds of flight

    return () => clearTimeout(timer);
  }, [status, toast]);

  const droneName = activeDrone?.name || "No Drone";

  return {
    protocol, setProtocol,
    status, telemetry, environment, setEnvironment,
    available, activeDrone, droneName,
    missionId,
    scan, connect, disconnect, calibrate,
    startMission, pauseMission, resumeMission, returnToHome, emergencyLand,
  };
};

export type UseDroneState = ReturnType<typeof useDroneState>;
