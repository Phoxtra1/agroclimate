import React, { useMemo, useState } from "react";
import { AlertTriangle, Battery, Crosshair, Radio, Route, Satellite, Signal, Wifi } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { CopyButton } from "@/components/CopyButton";
import { useDroneFleet, type FleetDrone } from "@/hooks/useDroneFleet";

const statusClass: Record<string, string> = {
  flying: "border-cyan-700 bg-cyan-900/30 text-cyan-300",
  returning: "border-blue-700 bg-blue-900/30 text-blue-300",
  paused: "border-amber-700 bg-amber-900/30 text-amber-300",
  connected: "border-emerald-700 bg-emerald-900/30 text-emerald-300",
  offline: "border-slate-700 bg-slate-900 text-slate-400",
  emergency: "border-red-700 bg-red-900/40 text-red-300",
};

export function FleetManagement() {
  const { fleet, loading, onlineCount, alerts } = useDroneFleet();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = useMemo(() => fleet.find((drone) => drone.id === selectedId) || fleet[0], [fleet, selectedId]);
  const avgBattery = fleet.length ? fleet.reduce((sum, drone) => sum + drone.battery, 0) / fleet.length : 0;
  const avgSignal = fleet.length ? fleet.reduce((sum, drone) => sum + drone.connectionHealth, 0) / fleet.length : 0;
  const critical = alerts.filter((a) => a.severity === "critical").length;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <FleetStat icon={<Satellite className="h-4 w-4" />} label="Fleet Units" value={`${fleet.length}`} />
        <FleetStat icon={<Wifi className="h-4 w-4" />} label="Online" value={`${onlineCount}/${fleet.length}`} />
        <FleetStat icon={<Battery className="h-4 w-4" />} label="Avg Battery" value={`${avgBattery.toFixed(0)}%`} />
        <FleetStat icon={<Signal className="h-4 w-4" />} label="Avg Link" value={`${avgSignal.toFixed(0)}%`} />
      </div>

      {alerts.length > 0 && (
        <Card className="bg-slate-900 border-amber-900/60 text-slate-100">
          <CardHeader className="py-3 border-b border-amber-900/40">
            <CardTitle className="text-sm font-mono uppercase tracking-widest text-amber-300 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" /> Fleet Health Alerts
              <Badge variant="outline" className="ml-2 border-amber-700 text-amber-300 text-[10px]">{alerts.length}</Badge>
              {critical > 0 && <Badge variant="outline" className="border-red-700 text-red-300 text-[10px] animate-pulse">{critical} CRITICAL</Badge>}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-3 max-h-44 overflow-y-auto space-y-1">
            {alerts.map((a) => (
              <button key={a.id} onClick={() => setSelectedId(a.droneId)}
                className={`w-full text-left text-[11px] font-mono px-3 py-2 rounded border ${a.severity === "critical" ? "border-red-800 bg-red-950/40 text-red-200" : "border-amber-800 bg-amber-950/30 text-amber-200"} hover:brightness-125`}>
                <div className="flex items-center justify-between gap-2">
                  <span className="font-bold truncate">{a.droneName}</span>
                  <span className="text-[9px] uppercase opacity-70">{a.type}</span>
                </div>
                <div className="opacity-90">{a.message}</div>
              </button>
            ))}
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <Card className="xl:col-span-2 bg-slate-900 border-slate-800 text-slate-100">
          <CardHeader className="py-4 border-b border-slate-800">
            <CardTitle className="text-sm font-mono uppercase tracking-widest text-cyan-400 flex items-center gap-2">
              <Radio className="h-4 w-4" /> Live Multi-Drone Fleet
            </CardTitle>
          </CardHeader>
          <CardContent className="p-3 grid grid-cols-1 md:grid-cols-2 gap-3">
            {fleet.map((drone) => (
              <button
                key={drone.id}
                onClick={() => setSelectedId(drone.id)}
                className={`text-left rounded-lg border p-3 bg-slate-950 hover:border-cyan-700 transition-colors ${selected?.id === drone.id ? "border-cyan-600" : "border-slate-800"}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-sm font-mono font-bold text-slate-100 truncate">{drone.name}</div>
                    <div className="text-[10px] font-mono text-slate-500 uppercase truncate">{drone.model} · {drone.protocol}</div>
                  </div>
                  <Badge variant="outline" className={statusClass[drone.status] || statusClass.connected}>{drone.status.toUpperCase()}</Badge>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-3 text-[10px] font-mono text-slate-500">
                  <Meter label="Battery" value={drone.battery} tone={drone.battery < 25 ? "danger" : "normal"} />
                  <Meter label="Link" value={drone.connectionHealth} tone={drone.connectionHealth < 55 ? "danger" : "normal"} />
                  <span>ALT <b className="text-slate-200">{drone.telemetry.altitude.toFixed(0)}m</b></span>
                  <span>SPD <b className="text-slate-200">{drone.telemetry.groundSpeed.toFixed(1)}m/s</b></span>
                  <span>GPS <b className="text-slate-200">{drone.telemetry.gpsFix.toUpperCase()}</b></span>
                  <span>HDG <b className="text-slate-200">{drone.telemetry.heading.toFixed(0)}°</b></span>
                </div>
              </button>
            ))}
            {loading && <p className="text-xs font-mono text-slate-500">Syncing fleet telemetry…</p>}
          </CardContent>
        </Card>

        <Card className="bg-slate-900 border-slate-800 text-slate-100">
          <CardHeader className="py-4 border-b border-slate-800">
            <CardTitle className="text-sm font-mono uppercase tracking-widest text-cyan-400">Selected Aircraft</CardTitle>
          </CardHeader>
          <CardContent className="p-4 space-y-4">
            {selected && <SelectedDrone drone={selected} />}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function FleetStat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-lg p-3 font-mono">
      <div className="flex items-center gap-2 text-[10px] text-slate-500 uppercase">{icon}{label}</div>
      <div className="text-xl font-bold text-slate-100 mt-1">{value}</div>
    </div>
  );
}

function Meter({ label, value, tone }: { label: string; value: number; tone: "normal" | "danger" }) {
  return (
    <div className="space-y-1 col-span-1">
      <div className="flex justify-between"><span>{label}</span><b className={tone === "danger" ? "text-red-300" : "text-slate-200"}>{value.toFixed(0)}%</b></div>
      <Progress value={value} className="h-1.5 bg-slate-800" />
    </div>
  );
}

function SelectedDrone({ drone }: { drone: FleetDrone }) {
  return (
    <div className="space-y-4 font-mono">
      <div className="rounded-lg border border-slate-800 bg-slate-950 p-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="text-base font-bold text-cyan-300 truncate">{drone.name}</h3>
            <p className="text-[10px] text-slate-500 uppercase">{drone.model}</p>
          </div>
          <CopyButton value={drone.id} className="h-7 w-7 text-slate-400" />
        </div>
        <p className="text-[10px] text-slate-600 mt-2 truncate">ID {drone.id}</p>
      </div>
      <Detail icon={<Crosshair className="h-4 w-4" />} label="Position" value={`${drone.telemetry.lat?.toFixed(5)}, ${drone.telemetry.lng?.toFixed(5)}`} />
      <Detail icon={<Route className="h-4 w-4" />} label="Distance" value={`${(drone.telemetry.distanceCovered / 1000).toFixed(2)} km`} />
      <Detail icon={<Battery className="h-4 w-4" />} label="Battery" value={`${drone.battery.toFixed(0)}%`} />
      <Detail icon={<Signal className="h-4 w-4" />} label="Connection" value={`${drone.connectionHealth.toFixed(0)}%`} />
      <div className="rounded-lg border border-cyan-900/50 bg-cyan-950/20 p-3 text-[11px] text-cyan-100">
        Dipa is monitoring fleet separation, battery risk, signal health, GPS quality, and return-to-home readiness in real time.
      </div>
    </div>
  );
}

function Detail({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center justify-between border-b border-slate-800 pb-2 text-xs">
      <span className="text-slate-500 flex items-center gap-2">{icon}{label}</span>
      <span className="text-slate-100 text-right">{value}</span>
    </div>
  );
}