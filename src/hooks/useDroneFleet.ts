import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { DroneTelemetry, FlightStatus } from "@/lib/drone/types";

export interface FleetDrone {
  id: string;
  name: string;
  model: string;
  protocol: string;
  status: FlightStatus | "offline";
  battery: number;
  connectionHealth: number;
  lastSeenAt: string;
  telemetry: DroneTelemetry;
}

const makeTelemetry = (seed: number, tick: number): DroneTelemetry => {
  const flying = seed % 3 !== 0;
  return {
    lat: 5.6037 + seed * 0.012 + Math.sin(tick / 12 + seed) * 0.0012,
    lng: -0.187 + seed * 0.01 + Math.cos(tick / 13 + seed) * 0.0012,
    altitude: flying ? 42 + seed * 8 + Math.sin(tick / 8) * 3 : 0,
    groundSpeed: flying ? 8 + seed + Math.cos(tick / 7) * 1.4 : 0,
    verticalSpeed: flying ? Math.sin(tick / 9) * 0.4 : 0,
    heading: (tick * 4 + seed * 55) % 360,
    battery: Math.max(18, 96 - seed * 11 - (tick % 180) * 0.08),
    signalStrength: Math.max(45, 95 - seed * 8 + Math.sin(tick / 5) * 4),
    gpsAccuracy: 0.5 + seed * 0.25,
    gpsFix: "3d",
    flightDuration: tick + seed * 90,
    distanceCovered: tick * (8 + seed) + seed * 240,
    cameraStatus: flying ? "recording" : "ready",
  };
};

const virtualFleet = (tick: number): FleetDrone[] =>
  ["North Field Scout", "Irrigation Mapper", "Flood Watch Rotor", "Pest Patrol"].map((name, index) => {
    const telemetry = makeTelemetry(index + 1, tick);
    const status: FleetDrone["status"] = index === 2 && tick % 60 < 14 ? "returning" : index === 3 && tick % 90 < 18 ? "paused" : "flying";
    return {
      id: `fleet-sim-${index + 1}`,
      name,
      model: index === 1 ? "Agro Hex Surveyor" : "Agro Quad Pro",
      protocol: "simulator",
      status,
      battery: telemetry.battery,
      connectionHealth: telemetry.signalStrength,
      lastSeenAt: new Date().toISOString(),
      telemetry,
    };
  });

export function useDroneFleet() {
  const [tick, setTick] = useState(0);
  const [storedDrones, setStoredDrones] = useState<any[]>([]);
  const [latestLogs, setLatestLogs] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const interval = window.setInterval(() => setTick((value) => value + 1), 1000);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    let mounted = true;

    const refresh = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          if (mounted) setLoading(false);
          return;
        }

        const [{ data: drones }, { data: logs }] = await Promise.all([
          supabase.from("drones").select("*").eq("user_id", user.id).order("last_seen_at", { ascending: false, nullsFirst: false }).limit(20),
          supabase.from("drone_telemetry_logs").select("*").eq("user_id", user.id).order("captured_at", { ascending: false }).limit(100),
        ]);

        if (!mounted) return;
        setStoredDrones(drones || []);
        const byDrone: Record<string, any> = {};
        (logs || []).forEach((log: any) => {
          if (log.drone_id && !byDrone[log.drone_id]) byDrone[log.drone_id] = log;
        });
        setLatestLogs(byDrone);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    refresh();
    const channel = supabase
      .channel("drone-fleet-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "drones" }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "drone_telemetry_logs" }, refresh)
      .subscribe();

    return () => {
      mounted = false;
      supabase.removeChannel(channel);
    };
  }, []);

  const fleet = useMemo<FleetDrone[]>(() => {
    const stored = storedDrones.map((drone, index) => {
      const log = latestLogs[drone.id];
      const fallback = makeTelemetry(index + 5, tick);
      const telemetry: DroneTelemetry = {
        lat: log?.lat ?? fallback.lat,
        lng: log?.lng ?? fallback.lng,
        altitude: Number(log?.altitude_m ?? fallback.altitude),
        groundSpeed: Number(log?.ground_speed_ms ?? fallback.groundSpeed),
        verticalSpeed: Number(log?.vertical_speed_ms ?? fallback.verticalSpeed),
        heading: Number(log?.heading ?? fallback.heading),
        battery: Number(log?.battery_pct ?? drone.last_battery_pct ?? fallback.battery),
        signalStrength: Number(log?.signal_strength ?? fallback.signalStrength),
        gpsAccuracy: Number(log?.gps_accuracy_m ?? fallback.gpsAccuracy),
        gpsFix: log ? "3d" : fallback.gpsFix,
        flightDuration: fallback.flightDuration,
        distanceCovered: fallback.distanceCovered,
        cameraStatus: drone.status === "flying" ? "recording" : "ready",
      };

      return {
        id: drone.id,
        name: drone.name,
        model: drone.model || "Registered drone",
        protocol: drone.protocol || "custom",
        status: (drone.status || "offline") as FleetDrone["status"],
        battery: telemetry.battery,
        connectionHealth: telemetry.signalStrength,
        lastSeenAt: log?.captured_at || drone.last_seen_at || drone.updated_at,
        telemetry,
      };
    });

    return stored.length >= 2 ? stored : [...stored, ...virtualFleet(tick).slice(0, 4 - stored.length)];
  }, [latestLogs, storedDrones, tick]);

  return { fleet, loading, onlineCount: fleet.filter((drone) => drone.status !== "offline").length };
}