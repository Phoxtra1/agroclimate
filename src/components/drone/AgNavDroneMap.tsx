import React, { useState } from "react";
import { Card } from "@/components/ui/card";
import { Map as MapIcon, Layers, Crosshair, Home, Navigation, Satellite, CloudRain, Leaf, Mountain } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { TelemetryData } from "@/hooks/useDroneState";

interface Props { telemetry: TelemetryData; isFlying: boolean; }

const LAYERS = [
  { id: "satellite", label: "Satellite", icon: Satellite },
  { id: "terrain", label: "Terrain", icon: Mountain },
  { id: "climate", label: "Climate", icon: CloudRain },
  { id: "flood", label: "Flood Risk", icon: CloudRain },
  { id: "crop", label: "Crop Health", icon: Leaf },
];

export function AgNavDroneMap({ telemetry, isFlying }: Props) {
  const [activeLayer, setActiveLayer] = useState<string>("satellite");
  const [showLayers, setShowLayers] = useState(false);

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
        <Button variant="outline" size="icon" className="h-8 w-8 bg-slate-900/80 border-slate-700 text-slate-300 hover:text-cyan-400 hover:bg-slate-800" title="Center on drone">
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
      <div className="absolute" style={{ left: "50%", top: "50%", transform: "translate(-80px, 60px)" }}>
        <div className="flex items-center gap-1">
          <Home className="h-4 w-4 text-emerald-400 drop-shadow-[0_0_4px_rgba(52,211,153,0.8)]" />
          <span className="text-[9px] font-mono text-emerald-400">HOME</span>
        </div>
      </div>

      {/* Flight path */}
      {isFlying && (
        <svg className="absolute inset-0 w-full h-full pointer-events-none">
          <path d="M 50%,50% Q 35%,55% 30%,75%" stroke="#06b6d4" strokeWidth="2" fill="none" strokeDasharray="4 4" className="opacity-50" />
        </svg>
      )}

      {/* Drone marker */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="relative transition-transform duration-1000 ease-linear" style={{ transform: `rotate(${telemetry.heading}deg)` }}>
          <Navigation className="text-cyan-400 h-8 w-8 drop-shadow-[0_0_8px_rgba(34,211,238,0.8)]" />
          {isFlying && <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-12 h-12 rounded-full border border-cyan-500/50 animate-ping" />}
        </div>
      </div>

      <div className="absolute bottom-3 left-3 right-3 flex justify-between text-[9px] font-mono text-slate-500 z-10">
        <div>LAT: {telemetry.lat?.toFixed(4) ?? "—"} / LNG: {telemetry.lng?.toFixed(4) ?? "—"}</div>
        <div>ALT {telemetry.altitude.toFixed(0)}m · GPS {telemetry.gpsFix}</div>
      </div>
    </Card>
  );
}
