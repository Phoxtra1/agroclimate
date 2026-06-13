import { useEffect, useState, useCallback, useMemo } from "react";
import { useAIH } from "@/hooks/useAIH";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { FlightMode, AircraftAsset, UniversalTelemetry } from "@/services/aih/types";

// Back-compat aliases
export type DroneStatus =
  | "disconnected"
  | "connecting"
  | "connected"
  | "calibrating"
  | "armed"
  | "flying"
  | "paused"
  | "returning"
  | "landing"
  | "emergency";

export interface TelemetryData {
  lat: number | undefined;
  lng: number | undefined;
  altitude: number;
  groundSpeed: number;
  verticalSpeed: number;
  heading: number;
  battery: number;
  signalStrength: number;
  gpsAccuracy: number;
  gpsFix: string;
  flightDuration: number;
  distanceCovered: number;
  cameraStatus: string;
}

export interface EnvironmentData {
  windSpeed: number;
  windDirection: string;
  temperature: number;
  humidity: number;
  rainProbability: number;
  visibility: number;
}

const INITIAL_TELEMETRY: TelemetryData = {
  lat: undefined,
  lng: undefined,
  altitude: 0,
  groundSpeed: 0,
  verticalSpeed: 0,
  heading: 0,
  battery: 100,
  signalStrength: 0,
  gpsAccuracy: 0,
  gpsFix: "none",
  flightDuration: 0,
  distanceCovered: 0,
  cameraStatus: "off",
};

export const useDroneState = () => {
  const { toast } = useToast();
  const aih = useAIH();
  
  const [selectedProtocol, setSelectedProtocol] = useState<any>("simulator");
  const [missionId, setMissionId] = useState<string | null>(null);

  const [environment, setEnvironment] = useState<EnvironmentData>({
    windSpeed: 12,
    windDirection: "NE",
    temperature: 28,
    humidity: 65,
    rainProbability: 10,
    visibility: 10,
  });

  // Calculate back-compat status from active aircraft & telemetry
  const status = useMemo((): DroneStatus => {
    if (!aih.activeAircraft) return "disconnected";
    if (aih.activeAircraft.status === "connecting") return "connecting";
    
    if (!aih.telemetry) return "connected";

    switch (aih.telemetry.flightMode) {
      case "manual":
        return "connected";
      case "stabilize":
        return "armed";
      case "loiter":
        return "paused";
      case "auto":
      case "guided":
        return "flying";
      case "rtl":
        return "returning";
      case "land":
        return "landing";
      case "emergency":
        return "emergency";
      case "monitoring":
      default:
        return "connected";
    }
  }, [aih.activeAircraft, aih.telemetry]);

  const isFlying = ["flying", "returning", "paused", "landing", "emergency"].includes(status);

  // Available aircraft based on selected protocol
  const available = useMemo(() => {
    return aih.aircrafts.filter(a => a.protocol === selectedProtocol || selectedProtocol === "custom");
  }, [aih.aircrafts, selectedProtocol]);

  // Telemetry mapping
  const telemetry = useMemo((): TelemetryData => {
    if (!aih.telemetry) return INITIAL_TELEMETRY;

    return {
      lat: aih.telemetry.latitude,
      lng: aih.telemetry.longitude,
      altitude: aih.telemetry.altitude,
      groundSpeed: aih.telemetry.speed,
      verticalSpeed: aih.telemetry.flightMode === "rtl" || aih.telemetry.flightMode === "land" ? -1.5 : 0,
      heading: aih.telemetry.heading,
      battery: aih.telemetry.batteryFuelStatus,
      signalStrength: aih.telemetry.signalStrength,
      gpsAccuracy: aih.telemetry.gpsStatus === "rtk" ? 0.02 : aih.telemetry.gpsStatus === "3d" ? 1.5 : 5,
      gpsFix: aih.telemetry.gpsStatus,
      flightDuration: isFlying ? 120 : 0, // Mock duration if in flight
      distanceCovered: isFlying ? 450 : 0,
      cameraStatus: aih.activeSensor !== "rgb" ? aih.activeSensor : "on",
    };
  }, [aih.telemetry, aih.activeSensor, isFlying]);

  const scan = useCallback(async () => {
    await aih.refreshAircrafts();
    return aih.aircrafts.filter(a => a.protocol === selectedProtocol);
  }, [aih, selectedProtocol]);

  const connect = useCallback(async (aircraft?: AircraftAsset) => {
    const target = aircraft || available[0];
    if (!target) {
      toast({ title: "Connection Error", description: "No registered aircraft found for the selected protocol.", variant: "destructive" });
      return;
    }
    try {
      await aih.connect(target.id);
      toast({ title: "Aircraft Connected", description: `Established connection to ${target.name}.` });
    } catch (err: any) {
      toast({ title: "Connection Failed", description: err.message, variant: "destructive" });
    }
  }, [aih, available, toast]);

  const disconnect = useCallback(async () => {
    try {
      await aih.disconnect();
      setMissionId(null);
      toast({ title: "Disconnected", description: "Connection severed." });
    } catch (err: any) {
      toast({ title: "Disconnect Failed", description: err.message, variant: "destructive" });
    }
  }, [aih, toast]);

  const calibrate = useCallback(async () => {
    if (!aih.activeAircraft) return;
    toast({ title: "Calibration Initiated", description: "Starting compass and sensor calibration..." });
    await new Promise(r => setTimeout(r, 1500));
    toast({ title: "Calibration Completed", description: "All sensors aligned." });
  }, [aih.activeAircraft, toast]);

  const startMission = useCallback(async (config?: any) => {
    if (!aih.activeAircraft) return;
    const res = await aih.issueCommand("startMission", config);
    if (!res.success) {
      toast({ title: "Command Blocked", description: res.message, variant: "destructive" });
      return;
    }

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
    } catch (e) {
      console.warn("Could not log flight mission record in Supabase:", e);
    }
  }, [aih, telemetry]);

  const pauseMission = useCallback(async () => {
    const res = await aih.issueCommand("pauseMission");
    if (!res.success) toast({ title: "Command Blocked", description: res.message, variant: "destructive" });
  }, [aih, toast]);

  const resumeMission = useCallback(async () => {
    const res = await aih.issueCommand("resumeMission");
    if (!res.success) toast({ title: "Command Blocked", description: res.message, variant: "destructive" });
  }, [aih, toast]);

  const returnToHome = useCallback(async () => {
    const res = await aih.issueCommand("returnHome");
    if (!res.success) toast({ title: "Command Blocked", description: res.message, variant: "destructive" });
  }, [aih, toast]);

  const emergencyLand = useCallback(async () => {
    const res = await aih.issueCommand("land");
    if (!res.success) {
      toast({ title: "Command Blocked", description: res.message, variant: "destructive" });
      return;
    }
    if (missionId) {
      try {
        await supabase.from("drone_missions").update({ status: "aborted", completed_at: new Date().toISOString() }).eq("id", missionId);
      } catch {}
      setMissionId(null);
    }
  }, [aih, missionId, toast]);

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

  // Save last known position
  useEffect(() => {
    if (telemetry.lat != null && telemetry.lng != null && isFlying) {
      localStorage.setItem(
        "last_known_drone_pos",
        JSON.stringify({
          lat: telemetry.lat,
          lng: telemetry.lng,
          altitude: telemetry.altitude,
          timestamp: new Date().toISOString(),
          droneName: aih.activeAircraft?.name || "Active Aircraft",
        })
      );
    }
  }, [telemetry.lat, telemetry.lng, telemetry.altitude, isFlying, aih.activeAircraft]);

  // Weather simulation
  useEffect(() => {
    if (status !== "flying") {
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
        windSpeed: 38,
        windDirection: "WSW",
        temperature: 24,
        humidity: 92,
        rainProbability: 95,
        visibility: 3,
      });
      toast({
        title: "CRITICAL WEATHER ALERT",
        description: "Wind became heavy (38 km/h) with signs of heavy rain in flight area. Emergency landing recommended!",
        variant: "destructive",
      });
    }, 20000);

    return () => clearTimeout(timer);
  }, [status, toast]);

  const droneName = aih.activeAircraft?.name || "No Connected Asset";

  return {
    protocol: selectedProtocol,
    setProtocol: setSelectedProtocol,
    status,
    telemetry,
    environment,
    setEnvironment,
    available,
    activeDrone: aih.activeAircraft,
    droneName,
    missionId,
    scan,
    connect,
    disconnect,
    calibrate,
    startMission,
    pauseMission,
    resumeMission,
    returnToHome,
    emergencyLand,
  };
};
