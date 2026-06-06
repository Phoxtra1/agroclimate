import React from 'react';
import { TelemetryData } from '@/hooks/useDroneState';
import { Card, CardContent } from '@/components/ui/card';
import { Map as MapIcon, Layers, Crosshair } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface AgNavDroneMapProps {
  telemetry: TelemetryData;
  isFlying: boolean;
}

export function AgNavDroneMap({ telemetry, isFlying }: AgNavDroneMapProps) {
  return (
    <Card className="bg-slate-900 border-slate-800 overflow-hidden h-[300px] lg:h-full relative">
      {/* Mock Map Background */}
      <div className="absolute inset-0 bg-slate-950 opacity-80" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-slate-800/40 via-slate-950/80 to-slate-950" />
      
      {/* Map Grid */}
      <div className="absolute inset-0 bg-[linear-gradient(rgba(14,165,233,0.1)_1px,transparent_1px),linear-gradient(90deg,rgba(14,165,233,0.1)_1px,transparent_1px)] bg-[size:40px_40px]" style={{ backgroundPosition: isFlying ? `-${telemetry.distanceCovered % 40}px ${telemetry.distanceCovered % 40}px` : '0 0' }} />

      {/* Map Controls */}
      <div className="absolute top-4 right-4 flex flex-col gap-2">
        <Button variant="outline" size="icon" className="bg-slate-900/80 border-slate-700 text-slate-300 hover:text-cyan-400 hover:bg-slate-800">
          <Layers className="h-4 w-4" />
        </Button>
        <Button variant="outline" size="icon" className="bg-slate-900/80 border-slate-700 text-slate-300 hover:text-cyan-400 hover:bg-slate-800">
          <Crosshair className="h-4 w-4" />
        </Button>
      </div>

      <div className="absolute top-4 left-4 flex items-center gap-2 bg-slate-900/80 border border-slate-700 rounded px-3 py-1.5 backdrop-blur-sm">
        <MapIcon className="h-4 w-4 text-cyan-400" />
        <span className="text-xs font-mono text-slate-300">AGNAV MAP LAYERS</span>
      </div>

      {/* Drone Marker */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div 
          className="relative transition-transform duration-1000 ease-linear"
          style={{ transform: `rotate(${telemetry.heading}deg)` }}
        >
          {/* Drone Icon */}
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-cyan-400 relative z-10 drop-shadow-[0_0_8px_rgba(34,211,238,0.8)]">
            <path d="m12 2-2 4h4l-2-4Z"/>
            <path d="M12 6v12"/>
            <path d="m5 10 7 2 7-2"/>
            <path d="m5 14 7-2 7 2"/>
          </svg>
          {/* Pulsing ring when flying */}
          {isFlying && (
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-12 h-12 rounded-full border border-cyan-500/50 animate-ping" />
          )}
        </div>
      </div>

      {/* Flight Path (Mock) */}
      {isFlying && (
        <svg className="absolute inset-0 w-full h-full pointer-events-none opacity-30">
          <path 
            d="M 50%,50% Q 40%,60% 30%,80%" 
            stroke="#0ea5e9" 
            strokeWidth="2" 
            fill="none" 
            strokeDasharray="4 4" 
            className="animate-pulse"
          />
        </svg>
      )}
      
      {/* Coordinate HUD */}
      <div className="absolute bottom-4 left-4 right-4 flex justify-between text-[10px] font-mono text-slate-500">
        <div>LAT: 5.6037 N / LNG: 0.1870 W</div>
        <div>ZOOM: 18x / EPSG:4326</div>
      </div>
    </Card>
  );
}
