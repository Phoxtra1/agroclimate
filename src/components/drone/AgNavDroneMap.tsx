import React, { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Map as MapIcon, Layers, Crosshair, Home, Navigation, Satellite, CloudRain, Leaf, Mountain, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { TelemetryData } from "@/hooks/useDroneState";
import { useToast } from "@/hooks/use-toast";

interface Props {
  telemetry: TelemetryData;
  isFlying: boolean;
  status?: string;
}

const LAYERS = [
  { id: "satellite", label: "Satellite", icon: Satellite },
  { id: "terrain", label: "Terrain", icon: Mountain },
  { id: "climate", label: "Climate", icon: CloudRain },
  { id: "flood", label: "Flood Risk", icon: CloudRain },
  { id: "crop", label: "Crop Health", icon: Leaf },
];

export function AgNavDroneMap({ telemetry, isFlying, status }: Props) {
  const [activeLayer, setActiveLayer] = useState<string>("satellite");
  const [showLayers, setShowLayers] = useState(false);
  const [lastPos, setLastPos] = useState<{ lat: number; lng: number; timestamp: string; droneName: string } | null>(null);
  const { toast } = useToast();

  // Load the last known position from localStorage
  useEffect(() => {
    const saved = localStorage.getItem("last_known_drone_pos");
    if (saved) {
      try {
        setLastPos(JSON.parse(saved));
      } catch (e) {
        console.error("Failed to parse last known drone position:", e);
      }
    }
  }, [telemetry.lat, telemetry.lng, status]);

  const handleLocateLostDrone = () => {
    if (lastPos) {
      toast({
        title: "Locating Lost Drone",
        description: `Coordinates: LAT ${lastPos.lat.toFixed(5)} / LNG ${lastPos.lng.toFixed(5)} (Saved: ${new Date(lastPos.timestamp).toLocaleTimeString()})`,
        variant: "default",
      });
    }
  };

  return (
    <Card className="bg-slate-900 border-slate-800 overflow-hidden h-[300px] lg:h-full relative">
      <div className="absolute inset-0 bg-slate-950" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-slate-800/40 via-slate-950/80 to-slate-950" />
      <div
        className="absolute inset-0 bg-[linear-gradient(rgba(14,165,233,0.1)_1px,transparent_1px),linear-gradient(90deg,rgba(14,165,233,0.1)_1px,transparent_1px)] bg-[size:40px_40px]"
        style={{ backgroundPosition: isFlying ? `-${telemetry.distanceCovered % 40}px ${telemetry.distanceCovered % 40}px` : "0 0" }}
      />

      {activeLayer === "crop" && <div className="absolute inset-0 bg-emerald-700/10 mix-blend-screen" />}
      {activeLayer === "flood" && <div className="absolute inset-0 bg-blue-700/15 mix-blend-screen" />}
      {activeLayer === "climate" && <div className="absolute inset-0 bg-cyan-700/15 mix-blend-screen" />}
      {activeLayer === "terrain" && <div className="absolute inset-0 bg-amber-700/10 mix-blend-screen" />}

      <div className="absolute top-3 right-3 flex flex-col gap-2 z-10">
        <Button variant="outline" size="icon" className="h-8 w-8 bg-slate-900/80 border-slate-700 text-slate-300 hover:text-cyan-400 hover:bg-slate-800" onClick={() => setShowLayers((v) => !v)}>
          <Layers className="h-3.5 w-3.5" />
        </Button>
        <Button variant="outline" size="icon" className="h-8 w-8 bg-slate-900/80 border-slate-700 text-slate-300 hover:text-cyan-400 hover:bg-slate-800" title="Center on drone" onClick={handleLocateLostDrone}>
          <Crosshair className="h-3.5 w-3.5" />
        </Button>
      </div>

      {showLayers && (
        <div className="absolute top-3 right-14 bg-slate-950/95 border border-slate-800 rounded p-1.5 z-10 space-y-0.5">
          {LAYERS.map((l) => (
            <button key={l.id} onClick={() => { setActiveLayer(l.id); setShowLayers(false); }} className={`flex items-center gap-2 px-2 py-1 rounded w-full text-left text-[10px] font-mono ${activeLayer === l.id ? "bg-cyan-900/40 text-cyan-300" : "text-slate-400 hover:bg-slate-800"}`}>
              <l.icon className="h-3 w-3" /> {l.label}
            </button>
          ))}
        </div>
      )}

      <div className="absolute top-3 left-3 flex items-center gap-2 bg-slate-900/80 border border-slate-700 rounded px-2 py-1 backdrop-blur-sm z-10">
        <MapIcon className="h-3 w-3 text-cyan-400" />
        <span className="text-[10px] font-mono text-slate-300 uppercase">AGNAV · {activeLayer}</span>
      </div>

      {/* Home marker */}
      <div className="absolute" style={{ left: "15%", top: "65%", transform: "translate(-50%, -50%)" }}>
        <div className="flex flex-col items-center">
          <div className="flex items-center justify-center h-6 w-6 rounded-full bg-emerald-950/60 border border-emerald-500/80">
            <Home className="h-3.5 w-3.5 text-emerald-400 drop-shadow-[0_0_4px_rgba(52,211,153,0.8)]" />
          </div>
          <span className="text-[8px] font-mono text-emerald-400 mt-1 font-bold">HOME BASE</span>
        </div>
      </div>

      {/* Waypoints & Mission Boundaries Overlay */}
      <svg className="absolute inset-0 w-full h-full pointer-events-none">
        {/* Geofence boundary */}
        <polygon
          points="60,60 320,80 280,240 70,220"
          fill="rgba(239, 68, 68, 0.04)"
          stroke="rgba(239, 68, 68, 0.35)"
          strokeWidth="1.5"
          strokeDasharray="4 3"
        />
        {/* Mission Waypoints Route */}
        {isFlying && (
          <>
            <polyline
              points="100,200 150,110 260,95 240,190 180,220"
              fill="none"
              stroke="#06b6d4"
              strokeWidth="1.5"
              className="opacity-70"
            />
            {/* Coverage Swath Swathe (Area scanned) */}
            <polyline
              points="100,200 150,110 260,95 240,190"
              fill="none"
              stroke="rgba(6, 182, 212, 0.08)"
              strokeWidth="32"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </>
        )}
      </svg>

      {/* Waypoints node markers */}
      {isFlying && (
        <>
          <div className="absolute" style={{ left: "150px", top: "110px", transform: "translate(-50%, -50%)" }}>
            <div className="w-2.5 h-2.5 rounded-full bg-cyan-500 border border-cyan-300 flex items-center justify-center"><span className="text-[6px] text-black font-bold">1</span></div>
          </div>
          <div className="absolute" style={{ left: "260px", top: "95px", transform: "translate(-50%, -50%)" }}>
            <div className="w-2.5 h-2.5 rounded-full bg-cyan-500 border border-cyan-300 flex items-center justify-center"><span className="text-[6px] text-black font-bold">2</span></div>
          </div>
          <div className="absolute" style={{ left: "240px", top: "190px", transform: "translate(-50%, -50%)" }}>
            <div className="w-2.5 h-2.5 rounded-full bg-cyan-500 border border-cyan-300 flex items-center justify-center"><span className="text-[6px] text-black font-bold">3</span></div>
          </div>
        </>
      )}

      {/* Dynamic Aircraft marker */}
      {isFlying ? (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="relative transition-transform duration-1000 ease-linear flex flex-col items-center" style={{ transform: `rotate(${telemetry.heading}deg)` }}>
            {/* Render custom icon based on aircraft type */}
            {(() => {
              const activeType = localStorage.getItem("aih_active_type") || "drone";
              if (activeType === "helicopter" || activeType === "air_ambulance") {
                return <Crosshair className="text-cyan-400 h-8 w-8 drop-shadow-[0_0_8px_rgba(34,211,238,0.85)]" />;
              } else if (activeType === "fixed_wing" || activeType === "cargo" || activeType === "maritime_patrol") {
                return <Navigation className="text-cyan-400 h-8 w-8 rotate-45 drop-shadow-[0_0_8px_rgba(34,211,238,0.85)]" />;
              }
              // Default drone/eVTOL arrow
              return <Navigation className="text-cyan-400 h-8 w-8 drop-shadow-[0_0_8px_rgba(34,211,238,0.8)]" />;
            })()}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-12 h-12 rounded-full border border-cyan-500/40 animate-ping pointer-events-none" />
          </div>
        </div>
      ) : (
        /* Last Position Recover banner indicator */
        lastPos && (
          <div className="absolute" style={{ left: "60%", top: "40%", transform: "translate(-50%, -50%)" }}>
            <div className="flex flex-col items-center">
              <div className="relative flex items-center justify-center">
                <span className="absolute h-7 w-7 rounded-full bg-red-500/30 animate-pulse border border-red-500/55" />
                <AlertTriangle className="h-5 w-5 text-red-500 drop-shadow-[0_0_4px_rgba(239,68,68,0.85)] animate-bounce" />
              </div>
              <span className="text-[7px] font-mono text-red-400 bg-slate-950/90 border border-red-900 rounded px-1.5 mt-1 font-bold whitespace-nowrap">
                LAST POS ({lastPos.droneName})
              </span>
            </div>
          </div>
        )
      )}

      {/* Lost Aircraft Recovery Banner overlay */}
      {!isFlying && lastPos && (
        <div className="absolute bottom-10 left-3 right-3 bg-red-950/85 border border-red-900/80 text-red-200 p-2 rounded-lg font-mono text-[9px] flex items-center justify-between z-10 backdrop-blur-sm shadow-xl animate-pulse">
          <div>
            <div className="font-bold text-red-400 flex items-center gap-1">
              <AlertTriangle className="h-3 w-3" /> AIRCRAFT RECOVERY MODE ACTIVE
            </div>
            <div>LAT: {lastPos.lat.toFixed(5)} / LNG: {lastPos.lng.toFixed(5)} ({new Date(lastPos.timestamp).toLocaleTimeString()})</div>
          </div>
          <Button
            size="sm"
            variant="outline"
            className="h-6 px-2 text-[8px] bg-red-900 hover:bg-red-800 text-red-100 border-red-700 font-mono"
            onClick={handleLocateLostDrone}
          >
            LOCATE
          </Button>
        </div>
      )}

      <div className="absolute bottom-3 left-3 right-3 flex justify-between text-[9px] font-mono text-slate-500 z-10">
        <div>LAT: {telemetry.lat?.toFixed(4) ?? "—"} / LNG: {telemetry.lng?.toFixed(4) ?? "—"}</div>
        <div>ALT {telemetry.altitude.toFixed(0)}m · GPS {telemetry.gpsFix}</div>
      </div>
    </Card>
  );
}
