import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Wifi, WifiOff, PlaneTakeoff, ShieldAlert, Home, RefreshCw, Pause, Play, Search, Crosshair, Bluetooth,
} from "lucide-react";
import type { UseDroneState } from "@/hooks/useDroneState";
import { SUPPORTED_PROTOCOLS } from "@/lib/drone/connectionManager";
import { CopyButton } from "@/components/CopyButton";
import { useToast } from "@/hooks/use-toast";

export function DroneConnectionCenter(props: UseDroneState) {
  const {
    protocol, setProtocol, status, available, activeDrone, droneName,
    scan, connect, disconnect, calibrate,
    startMission, pauseMission, resumeMission, returnToHome, emergencyLand,
    telemetry,
  } = props;
  const [scanning, setScanning] = useState(false);
  const { toast } = useToast();

  const isConnected = !["disconnected", "connecting"].includes(status);
  const isFlying = status === "flying" || status === "returning" || status === "paused";

  const handleScan = async () => {
    setScanning(true);
    try {
      const found = await scan();
      toast({ title: `Found ${found.length} drone(s)` });
    } catch (e: any) {
      toast({ title: "Scan failed", description: e.message, variant: "destructive" });
    } finally { setScanning(false); }
  };

  const handleConnect = async () => {
    try { await connect(); toast({ title: "Connected" }); }
    catch (e: any) { toast({ title: "Connect failed", description: e.message, variant: "destructive" }); }
  };

  const handleCalibrate = async () => {
    try { await calibrate(); toast({ title: "Calibration complete" }); }
    catch (e: any) { toast({ title: "Calibration failed", description: e.message, variant: "destructive" }); }
  };

  const statusBadge = () => {
    const map: Record<string, { label: string; cls: string }> = {
      disconnected: { label: "OFFLINE", cls: "bg-slate-800 text-slate-400 border-slate-700" },
      connecting:   { label: "CONNECTING", cls: "bg-amber-900/30 text-amber-400 border-amber-700 animate-pulse" },
      connected:    { label: "READY", cls: "bg-emerald-900/30 text-emerald-400 border-emerald-700" },
      calibrating:  { label: "CALIBRATING", cls: "bg-amber-900/30 text-amber-400 border-amber-700 animate-pulse" },
      armed:        { label: "ARMED", cls: "bg-cyan-900/30 text-cyan-400 border-cyan-700" },
      flying:       { label: "IN FLIGHT", cls: "bg-cyan-900/30 text-cyan-400 border-cyan-700 animate-pulse" },
      paused:       { label: "PAUSED", cls: "bg-amber-900/30 text-amber-400 border-amber-700" },
      returning:    { label: "RETURNING", cls: "bg-blue-900/30 text-blue-400 border-blue-700" },
      landing:      { label: "LANDING", cls: "bg-blue-900/30 text-blue-400 border-blue-700" },
      emergency:    { label: "EMERGENCY", cls: "bg-red-900/40 text-red-300 border-red-700 animate-pulse" },
    };
    const m = map[status];
    return <Badge variant="outline" className={m.cls}>{m.label}</Badge>;
  };

  return (
    <Card className="bg-slate-900 border-slate-800 text-slate-100 h-full">
      <CardHeader className="py-4 border-b border-slate-800 flex flex-row justify-between items-center">
        <CardTitle className="text-sm font-mono uppercase tracking-widest text-slate-300 flex items-center gap-2">
          <Wifi className="h-4 w-4" /> Connection Center
        </CardTitle>
        {statusBadge()}
      </CardHeader>
      <CardContent className="p-4 space-y-5">
        {/* Protocol */}
        <div className="space-y-2">
          <p className="text-[10px] font-mono text-slate-500 uppercase">Protocol</p>
          <Select value={protocol} onValueChange={(v) => setProtocol(v as any)} disabled={isConnected}>
            <SelectTrigger className="bg-slate-950 border-slate-800 text-slate-300 font-mono h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-slate-900 border-slate-800 text-slate-300 font-mono">
              {SUPPORTED_PROTOCOLS.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.label} {p.ready ? "" : "(bridge required)"}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Active drone */}
        <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
          <div className="flex justify-between items-start mb-2">
            <div className="min-w-0">
              <h3 className="font-mono font-bold text-base text-cyan-400 truncate">{droneName}</h3>
              <p className="text-[10px] text-slate-500 font-mono uppercase">{activeDrone?.model || "—"}</p>
            </div>
            <Wifi className={`h-4 w-4 ${isConnected ? "text-emerald-500" : "text-slate-600"}`} />
          </div>
          <div className="grid grid-cols-2 gap-1 text-[10px] font-mono">
            <div className="text-slate-500">FW: <span className="text-slate-300">{activeDrone?.firmware || "—"}</span></div>
            <div className="text-slate-500">BAT: <span className="text-slate-300">{telemetry.battery.toFixed(0)}%</span></div>
            <div className="text-slate-500">SIG: <span className="text-slate-300">{telemetry.signalStrength.toFixed(0)}%</span></div>
            <div className="text-slate-500">GPS: <span className="text-slate-300">{telemetry.gpsFix.toUpperCase()}</span></div>
            <div className="text-slate-500">CAM: <span className="text-slate-300">{telemetry.cameraStatus.toUpperCase()}</span></div>
            <div className="text-slate-500">PROTO: <span className="text-slate-300">{protocol.toUpperCase()}</span></div>
          </div>
          {activeDrone && (
            <div className="mt-2 flex items-center gap-1 text-[10px] font-mono text-slate-500">
              <span className="truncate">ID: {activeDrone.id}</span>
              <CopyButton value={activeDrone.id} className="h-5 w-5" />
            </div>
          )}
        </div>

        {/* Scan / available */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-mono text-slate-500 uppercase">Discovery</p>
            <Button size="sm" variant="ghost" className="h-7 text-cyan-400 hover:bg-slate-800 font-mono text-[10px]" onClick={handleScan} disabled={scanning}>
              {scanning ? <RefreshCw className="h-3 w-3 mr-1 animate-spin" /> : <Search className="h-3 w-3 mr-1" />} SCAN
            </Button>
          </div>
          {available.length === 0 ? (
            <p className="text-[10px] font-mono text-slate-600 italic">No drones found. Click SCAN.</p>
          ) : (
            <div className="space-y-1 max-h-32 overflow-y-auto">
              {available.map((d) => (
                <button
                  key={d.id}
                  onClick={() => connect(d)}
                  disabled={isConnected}
                  className="w-full text-left text-[11px] font-mono p-2 rounded border border-slate-800 bg-slate-950 hover:border-cyan-700 hover:bg-slate-900 disabled:opacity-50 transition-colors"
                >
                  <div className="flex justify-between items-center">
                    <span className="text-slate-200 truncate">{d.name}</span>
                    <span className="text-emerald-400">{d.signal}%</span>
                  </div>
                  <div className="text-[10px] text-slate-500">{d.model}</div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* System controls */}
        <div className="grid grid-cols-2 gap-2">
          {!isConnected ? (
            <Button className="col-span-2 bg-cyan-600 hover:bg-cyan-500 text-white font-mono" onClick={handleConnect} disabled={status === "connecting"}>
              <Wifi className="mr-2 h-4 w-4" /> {status === "connecting" ? "Linking…" : "Connect"}
            </Button>
          ) : (
            <>
              <Button variant="outline" className="border-slate-700 text-slate-300 hover:bg-slate-800 font-mono" onClick={disconnect} disabled={isFlying}>
                <WifiOff className="mr-2 h-3 w-3" /> Disconnect
              </Button>
              <Button variant="outline" className="border-slate-700 text-slate-300 hover:bg-slate-800 font-mono" onClick={handleCalibrate} disabled={isFlying || status === "calibrating"}>
                <Crosshair className="mr-2 h-3 w-3" /> Calibrate
              </Button>
            </>
          )}
        </div>

        {/* Flight controls */}
        {isConnected && (
          <div className="space-y-2 pt-3 border-t border-slate-800">
            <p className="text-[10px] font-mono text-slate-500 uppercase">Flight Ops</p>
            <div className="grid grid-cols-2 gap-2">
              <Button className="bg-emerald-600 hover:bg-emerald-500 text-white font-mono h-12 text-[10px]" onClick={() => startMission()} disabled={isFlying}>
                <PlaneTakeoff className="h-4 w-4 mr-1" /> LAUNCH
              </Button>
              {status === "paused" ? (
                <Button className="bg-cyan-600 hover:bg-cyan-500 text-white font-mono h-12 text-[10px]" onClick={resumeMission}>
                  <Play className="h-4 w-4 mr-1" /> RESUME
                </Button>
              ) : (
                <Button className="bg-amber-600 hover:bg-amber-500 text-white font-mono h-12 text-[10px]" onClick={pauseMission} disabled={status !== "flying"}>
                  <Pause className="h-4 w-4 mr-1" /> PAUSE
                </Button>
              )}
              <Button className="bg-blue-600 hover:bg-blue-500 text-white font-mono h-12 text-[10px]" onClick={returnToHome} disabled={!isFlying}>
                <Home className="h-4 w-4 mr-1" /> RTH
              </Button>
              <Button variant="outline" className="border-slate-700 text-slate-300 hover:bg-slate-800 font-mono h-12 text-[10px]" disabled>
                <Bluetooth className="h-4 w-4 mr-1" /> PAIR
              </Button>
            </div>
            <Button variant="destructive" className="w-full font-mono bg-red-900/80 hover:bg-red-800 text-red-200 border border-red-700" onClick={emergencyLand} disabled={!isFlying}>
              <ShieldAlert className="mr-2 h-4 w-4" /> EMERGENCY LAND
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
