import React, { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Activity, Target, BarChart3, ShieldCheck, Plane, Battery, AlertTriangle, Droplets } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface Stats {
  totalMissions: number;
  completed: number;
  totalFlightSec: number;
  totalDistanceM: number;
  totalAreaHa: number;
  detections: number;
  floods: number;
  diseases: number;
  successRate: number;
  avgBattery: number;
}

export function DroneAnalytics() {
  const [s, setS] = useState<Stats | null>(null);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const [m, d, t] = await Promise.all([
        supabase.from("drone_missions").select("status, started_at, completed_at, estimated_coverage_ha, estimated_duration_min").eq("user_id", user.id),
        supabase.from("drone_ai_detections").select("category").eq("user_id", user.id),
        supabase.from("drone_telemetry_logs").select("battery_pct, ground_speed_ms").eq("user_id", user.id).limit(2000),
      ]);
      const missions = m.data || [];
      const dets = d.data || [];
      const tel = t.data || [];
      const completed = missions.filter((x: any) => x.status === "completed").length;
      const totalFlightSec = missions.reduce((acc: number, x: any) => {
        if (x.started_at && x.completed_at) return acc + (new Date(x.completed_at).getTime() - new Date(x.started_at).getTime())/1000;
        return acc + (x.estimated_duration_min || 0) * 60;
      }, 0);
      const totalAreaHa = missions.reduce((a: number, x: any) => a + (x.estimated_coverage_ha || 0), 0);
      const totalDistanceM = tel.reduce((a: number, x: any) => a + (x.ground_speed_ms || 0) * 5, 0);
      const avgBattery = tel.length ? tel.reduce((a: number, x: any) => a + (x.battery_pct || 0), 0) / tel.length : 0;
      setS({
        totalMissions: missions.length,
        completed,
        totalFlightSec,
        totalDistanceM,
        totalAreaHa,
        detections: dets.length,
        floods: dets.filter((x: any) => x.category === "flood" || x.category === "water_accumulation").length,
        diseases: dets.filter((x: any) => x.category === "disease" || x.category === "pest_damage").length,
        successRate: missions.length ? Math.round((completed / missions.length) * 100) : 0,
        avgBattery,
      });
    })();
  }, []);

  const fmtTime = (sec: number) => {
    const h = Math.floor(sec / 3600); const m = Math.floor((sec % 3600) / 60);
    return `${h}h ${m}m`;
  };

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      <Stat icon={<Plane className="h-5 w-5 text-cyan-400" />} label="TOTAL MISSIONS" value={String(s?.totalMissions ?? 0)} />
      <Stat icon={<Activity className="h-5 w-5 text-emerald-400" />} label="FLIGHT TIME" value={fmtTime(s?.totalFlightSec ?? 0)} />
      <Stat icon={<BarChart3 className="h-5 w-5 text-purple-400" />} label="AREA SURVEYED" value={`${(s?.totalAreaHa ?? 0).toFixed(1)} Ha`} />
      <Stat icon={<Target className="h-5 w-5 text-blue-400" />} label="DISTANCE" value={`${((s?.totalDistanceM ?? 0)/1000).toFixed(1)} km`} />
      <Stat icon={<ShieldCheck className="h-5 w-5 text-emerald-400" />} label="SUCCESS RATE" value={`${s?.successRate ?? 0}%`} />
      <Stat icon={<AlertTriangle className="h-5 w-5 text-amber-400" />} label="AI DETECTIONS" value={String(s?.detections ?? 0)} />
      <Stat icon={<Droplets className="h-5 w-5 text-blue-400" />} label="FLOOD / WATER" value={String(s?.floods ?? 0)} />
      <Stat icon={<Battery className="h-5 w-5 text-emerald-400" />} label="AVG BATTERY" value={`${(s?.avgBattery ?? 0).toFixed(0)}%`} />
    </div>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <Card className="bg-slate-900 border-slate-800 text-slate-100">
      <CardContent className="p-4 flex items-center gap-4">
        <div className="p-3 bg-slate-950 rounded-lg border border-slate-800">{icon}</div>
        <div>
          <div className="text-[10px] font-mono text-slate-500 uppercase">{label}</div>
          <div className="text-lg font-mono font-bold text-slate-200">{value}</div>
        </div>
      </CardContent>
    </Card>
  );
}
