import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface MissionRow {
  id: string;
  user_id: string;
  name?: string | null;
  mission_type: string;
  status: string;
  altitude_m?: number | null;
  speed_ms?: number | null;
  route_pattern?: string | null;
  area_polygon?: any;
  camera_settings?: any;
  started_at?: string | null;
  completed_at?: string | null;
  estimated_battery_pct?: number | null;
  estimated_duration_min?: number | null;
  estimated_coverage_ha?: number | null;
  target_location?: string | null;
  created_at: string;
}

export function useMissions() {
  const [missions, setMissions] = useState<MissionRow[]>([]);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setMissions([]); return; }
      const { data } = await supabase.from("drone_missions").select("*").eq("user_id", user.id).order("created_at", { ascending: false }).limit(50);
      setMissions((data || []) as MissionRow[]);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const create = async (payload: Partial<MissionRow>) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Not signed in");
    const { data, error } = await supabase.from("drone_missions").insert({
      user_id: user.id,
      mission_type: payload.mission_type || "monitoring",
      name: payload.name,
      altitude_m: payload.altitude_m ?? 50,
      speed_ms: payload.speed_ms ?? 10,
      route_pattern: payload.route_pattern ?? "grid",
      area_polygon: payload.area_polygon ?? null,
      camera_settings: payload.camera_settings ?? {},
      estimated_battery_pct: payload.estimated_battery_pct,
      estimated_duration_min: payload.estimated_duration_min,
      estimated_coverage_ha: payload.estimated_coverage_ha,
      status: "planned",
    }).select("*").maybeSingle();
    if (error) throw error;
    refresh();
    return data as MissionRow;
  };

  return { missions, loading, refresh, create };
}
