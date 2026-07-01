import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Wifi, WifiOff, PlaneTakeoff, ShieldAlert, Home as HomeIcon, RefreshCw, Pause, Play, Search, Crosshair,
  Lock, Eye, AlertTriangle
} from "lucide-react";
import type { UseDroneState } from "@/hooks/useDroneState";
import { useAIH } from "@/hooks/useAIH";
import { CopyButton } from "@/components/CopyButton";
import { useToast } from "@/hooks/use-toast";

const SUPPORTED_PROTOCOLS = [
  { id: "simulator", label: "Built-in Simulator" },
  { id: "wifi", label: "Wi-Fi Link (AgroNet)" },
  { id: "mavlink", label: "MAVLink Port 8088" },
  { id: "px4", label: "PX4 Companion SDK" },
  { id: "ardupilot", label: "ArduPilot Radio" },
  { id: "dji", label: "DJI Mobile SDK" },
  { id: "adsb", label: "ADS-B Ingestion" },
  { id: "rtsp", label: "RTSP Video Stream" },
  { id: "custom", label: "Custom API Bridge" },
];

export function DroneConnectionCenter(props: UseDroneState) {
  const {
    protocol, setProtocol, status, available, activeDrone, droneName,
    scan, connect, disconnect, calibrate,
    startMission, pauseMission, resumeMission, returnToHome, emergencyLand,
    telemetry,
  } = props;

  const aih = useAIH(); // Get master simulator/live toggles
  const [scanning, setScanning] = useState(false);
  const { toast } = useToast();

  const isConnected = !["disconnected", "connecting"].includes(status);
  const isFlying = ["flying", "returning", "paused", "landing", "emergency"].includes(status);

  // Check if active aircraft is a manned commercial type (locked controls)
  const isMannedCommercial = activeDrone && [
    "helicopter",
    "fixed_wing",
    "air_ambulance",
    "cargo",
    "maritime_patrol"
  ].includes((activeDrone as any).type || activeDrone.aircraftType || "");

  const handleScan = async () => {
    setScanning(true);
    try {
      const found = await scan();
      toast({ title: `Discovered ${found.length} aircraft` });
    } catch (e: any) {
      toast({ title: "Discovery failed", description: e.message, variant: "destructive" });
    } finally { setScanning(false); }
  };

  const handleConnect = async () => {
    if (available.length === 0) {
      toast({ title: "No Assets Discovered", description: "Please register or select a valid aircraft protocol.", variant: "destructive" });
      return;
    }
    try {
      await connect();
    } catch (e: any) {
      toast({ title: "Connect failed", description: e.message, variant: "destructive" });
    }
  };

  const handleCalibrate = async () => {
    try {
      await calibrate();
    } catch (e: any) {
      toast({ title: "Calibration failed", description: e.message, variant: "destructive" });
    }
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
    const m = map[status] || map.disconnected;
    return <Badge variant="outline" className={`text-[9px] font-mono tracking-widest ${m.cls}`}>{m.label}</Badge>;
  };

  return (
    <Card className="bg-slate-900 border-slate-800 text-slate-100 h-full">
      <CardHeader className="py-4 border-b border-slate-800 flex flex-row justify-between items-center">
        <CardTitle className="text-sm font-mono uppercase tracking-widest text-slate-300 flex items-center gap-2">
          <Wifi className="h-4 w-4" /> Connection Center
        </CardTitle>
        {statusBadge()}
      </CardHeader>
      <CardContent className="p-4 space-y-4">
        {/* Simulator mode toggle */}
        <div className="flex items-center justify-between bg-slate-950 p-2 rounded border border-slate-800">
          <div className="flex flex-col">
            <span className="text-[10px] font-mono font-bold text-slate-300">SIMULATOR TESTBENCH</span>
            <span className="text-[8px] font-mono text-slate-500">Run safe virtual operations</span>
          </div>
          <Switch
            checked={aih.isSimulator}
            onCheckedChange={aih.toggleSimulatorMode}
            disabled={isConnected}
          />
        </div>

        {/* Protocol */}
        <div className="space-y-1.5">
          <p className="text-[10px] font-mono text-slate-500 uppercase">Protocol</p>
          <Select value={protocol} onValueChange={(v) => setProtocol(v as any)} disabled={isConnected}>
            <SelectTrigger className="bg-slate-950 border-slate-800 text-slate-300 font-mono h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-slate-900 border-slate-800 text-slate-300 font-mono">
              {SUPPORTED_PROTOCOLS.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Active Aircraft Info Card */}
        <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 relative overflow-hidden">
          <div className="flex justify-between items-start mb-2">
            <div className="min-w-0">
              <h3 className="font-mono font-bold text-sm text-cyan-400 truncate">{droneName}</h3>
              <p className="text-[9px] text-slate-500 font-mono uppercase">{activeDrone?.model || "No Connected Asset"}</p>
            </div>
            <Wifi className={`h-4 w-4 shrink-0 ${isConnected ? "text-emerald-500" : "text-slate-600"}`} />
          </div>
          
          <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-[10px] font-mono">
            <div className="text-slate-500">TYPE: <span className="text-slate-300 uppercase">{((activeDrone as any)?.type || activeDrone?.aircraftType || "—").toString().replace("_", " ")}</span></div>
            <div className="text-slate-500">BAT/FUEL: <span className="text-slate-300">{telemetry.battery.toFixed(0)}%</span></div>
            <div className="text-slate-500">SIGNAL: <span className="text-slate-300">{telemetry.signalStrength.toFixed(0)}%</span></div>
            <div className="text-slate-500">GPS FIX: <span className="text-slate-300 uppercase">{telemetry.gpsFix}</span></div>
            <div className="text-slate-500">ALTITUDE: <span className="text-slate-300">{telemetry.altitude.toFixed(0)}m</span></div>
            <div className="text-slate-500">MODE: <span className="text-slate-300 uppercase">{status}</span></div>
          </div>

          {activeDrone && (
            <div className="mt-2.5 pt-2 border-t border-slate-900 flex items-center justify-between text-[8px] font-mono text-slate-500">
              <span className="truncate">UUID: {activeDrone.id.slice(0, 16)}...</span>
              <CopyButton value={activeDrone.id} className="h-4 w-4" />
            </div>
          )}

          {/* Manned Aircraft Indicator */}
          {isMannedCommercial && (
            <div className="absolute inset-0 bg-amber-950/20 backdrop-blur-[1px] border border-amber-500/30 flex items-center justify-center p-2 text-center select-none pointer-events-none">
              <div className="bg-slate-950/95 border border-amber-500 rounded p-1.5 shadow-2xl max-w-[90%]">
                <div className="flex items-center gap-1 justify-center text-amber-500 font-bold text-[9px] font-mono">
                  <Eye className="h-3.5 w-3.5" /> MONITORING ONLY
                </div>
                <div className="text-[7.5px] font-mono text-slate-400 mt-0.5 leading-tight">
                  Manned flight active. Control signals bypass disabled.
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Discovery / Selection */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-mono text-slate-500 uppercase">Registered Assets ({protocol.toUpperCase()})</p>
            <Button size="sm" variant="ghost" className="h-7 px-1.5 text-cyan-400 hover:bg-slate-800 font-mono text-[10px]" onClick={handleScan} disabled={scanning}>
              {scanning ? <RefreshCw className="h-3 w-3 mr-1 animate-spin" /> : <Search className="h-3 w-3 mr-1" />} DISCOVER
            </Button>
          </div>
          
          {available.length === 0 ? (
            <p className="text-[10px] font-mono text-slate-600 italic py-1">
              No registered {protocol} aircraft. Register assets in the Aircraft Registry tab.
            </p>
          ) : (
            <div className="space-y-1 max-h-24 overflow-y-auto">
              {available.map((d) => (
                <button
                  key={d.id}
                  onClick={() => connect(d)}
                  disabled={isConnected}
                  className="w-full text-left text-[10px] font-mono p-1.5 rounded border border-slate-800 bg-slate-950 hover:border-cyan-700 hover:bg-slate-900 disabled:opacity-50 transition-colors"
                >
                  <div className="flex justify-between items-center">
                    <span className="text-slate-200 truncate font-bold">{d.name}</span>
                    <span className="text-cyan-500 uppercase text-[8px]">{(((d as any).type || d.aircraftType || "drone") as string).replace("_", " ")}</span>
                  </div>
                  <div className="text-[9px] text-slate-500 truncate">{(d as any).manufacturer || ""} {d.model}</div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* System controls */}
        <div className="grid grid-cols-2 gap-2">
          {!isConnected ? (
            <Button className="col-span-2 bg-cyan-600 hover:bg-cyan-500 text-white font-mono text-xs" onClick={handleConnect} disabled={status === "connecting"}>
              <Wifi className="mr-1.5 h-4 w-4" /> {status === "connecting" ? "LINKING ASSET…" : "CONNECT AIRCRAFT"}
            </Button>
          ) : (
            <>
              <Button variant="outline" className="border-slate-800 bg-slate-950 text-slate-300 hover:bg-slate-800 font-mono text-xs" onClick={disconnect} disabled={isFlying}>
                <WifiOff className="mr-1.5 h-3.5 w-3.5" /> Disconnect
              </Button>
              <Button variant="outline" className="border-slate-800 bg-slate-950 text-slate-300 hover:bg-slate-800 font-mono text-xs" onClick={handleCalibrate} disabled={isFlying || status === "calibrating" || isMannedCommercial}>
                <Crosshair className="mr-1.5 h-3.5 w-3.5" /> Calibrate
              </Button>
            </>
          )}
        </div>

        {/* Flight controls */}
        {isConnected && (
          <div className={`space-y-2 pt-3 border-t border-slate-800 ${isMannedCommercial ? "opacity-50" : ""}`}>
            <p className="text-[10px] font-mono text-slate-500 uppercase flex items-center gap-1">
              Flight Operation Controllers
              {isMannedCommercial && <Lock className="h-3 w-3 text-amber-500" />}
            </p>
            
            <div className="grid grid-cols-2 gap-2">
              <Button
                className="bg-emerald-600 hover:bg-emerald-500 text-white font-mono h-11 text-[10px]"
                onClick={() => startMission()}
                disabled={isFlying || isMannedCommercial}
              >
                <PlaneTakeoff className="h-4 w-4 mr-1" /> LAUNCH
              </Button>
              
              {status === "paused" ? (
                <Button
                  className="bg-cyan-600 hover:bg-cyan-500 text-white font-mono h-11 text-[10px]"
                  onClick={resumeMission}
                  disabled={isMannedCommercial}
                >
                  <Play className="h-4 w-4 mr-1" /> RESUME
                </Button>
              ) : (
                <Button
                  className="bg-amber-600 hover:bg-amber-500 text-white font-mono h-11 text-[10px]"
                  onClick={pauseMission}
                  disabled={status !== "flying" || isMannedCommercial}
                >
                  <Pause className="h-4 w-4 mr-1" /> PAUSE
                </Button>
              )}
              
              <Button
                className="bg-blue-600 hover:bg-blue-500 text-white font-mono h-11 text-[10px]"
                onClick={returnToHome}
                disabled={!isFlying || isMannedCommercial}
              >
                <HomeIcon className="h-4 w-4 mr-1" /> RTH (HOME)
              </Button>
              
              <Button
                variant="outline"
                className="border-slate-800 bg-slate-950 text-slate-400 font-mono h-11 text-[10px]"
                disabled
              >
                AUTO GRID
              </Button>
            </div>
            
            <Button
              variant="destructive"
              className="w-full font-mono bg-red-950/60 hover:bg-red-900/80 text-red-200 border border-red-800 text-xs"
              onClick={emergencyLand}
              disabled={!isFlying || isMannedCommercial}
            >
              <ShieldAlert className="mr-1.5 h-4 w-4" /> EMERGENCY HARD LAND
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
export default DroneConnectionCenter;
