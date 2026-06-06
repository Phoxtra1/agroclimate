import React, { useState } from 'react';
import { Maximize2, Minimize2, Camera, Video, Settings, Crosshair } from 'lucide-react';
import { TelemetryData, DroneStatus } from '@/hooks/useDroneState';
import { Button } from '@/components/ui/button';

interface LiveFlightViewProps {
  telemetry: TelemetryData;
  status: DroneStatus;
}

export function LiveFlightView({ telemetry, status }: LiveFlightViewProps) {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isRecording, setIsRecording] = useState(false);

  const isFlying = status === 'flying' || status === 'returning';
  const hasVideo = status !== 'disconnected' && status !== 'connecting';

  return (
    <div className={`relative bg-slate-900 border border-slate-800 rounded-xl overflow-hidden flex flex-col ${isFullscreen ? 'fixed inset-4 z-50' : 'h-[500px]'}`}>
      
      {/* Video Overlay / Content */}
      <div className="flex-1 relative bg-black flex items-center justify-center overflow-hidden">
        {hasVideo ? (
          <>
            {/* Mock Video Grid Pattern */}
            <div className="absolute inset-0 opacity-20 bg-[linear-gradient(rgba(255,255,255,0.1)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.1)_1px,transparent_1px)] bg-[size:40px_40px]" />
            
            {/* Center Crosshair */}
            <Crosshair className="absolute text-cyan-500/50 h-16 w-16" strokeWidth={1} />
            
            {/* Artificial Horizon / Pitch & Roll indicator (mocked) */}
            <div className="absolute w-64 h-64 border border-cyan-500/30 rounded-full flex items-center justify-center">
              <div className="w-full h-[1px] bg-cyan-500/50" style={{ transform: `rotate(${isFlying ? Math.sin(Date.now() / 1000) * 5 : 0}deg)` }} />
            </div>

            {/* Video Feed Placeholder Label */}
            <div className="absolute bottom-4 left-4 text-xs font-mono text-cyan-500/70 uppercase tracking-widest bg-black/50 px-2 py-1 rounded">
              CAM-1 MAIN OPTICAL [LIVE] {isRecording && <span className="text-red-500 animate-pulse ml-2">● REC</span>}
            </div>

            {/* In-Video Telemetry Overlay (HUD) */}
            <div className="absolute top-4 left-4 text-cyan-400 font-mono text-xs space-y-1">
              <div>ALT: {telemetry.altitude.toFixed(1)} m</div>
              <div>SPD: {telemetry.groundSpeed.toFixed(1)} m/s</div>
              <div>HDG: {Math.round(telemetry.heading)}°</div>
            </div>
            
            <div className="absolute top-4 right-4 text-cyan-400 font-mono text-xs space-y-1 text-right">
              <div>BAT: {telemetry.battery.toFixed(1)}%</div>
              <div>SIG: {telemetry.signalStrength.toFixed(1)}%</div>
              <div className="text-emerald-400">VISION: NORMAL</div>
            </div>
          </>
        ) : (
          <div className="text-slate-500 flex flex-col items-center">
            <Video className="h-12 w-12 mb-2 opacity-50" />
            <p className="font-mono text-sm uppercase tracking-wider">No Video Signal</p>
          </div>
        )}
      </div>

      {/* Control Bar */}
      <div className="h-14 bg-slate-950 border-t border-slate-800 flex items-center justify-between px-4">
        <div className="flex items-center gap-2">
          <Button 
            variant="ghost" 
            size="icon" 
            className="text-slate-400 hover:text-cyan-400 hover:bg-slate-800"
            disabled={!hasVideo}
          >
            <Camera className="h-5 w-5" />
          </Button>
          <Button 
            variant="ghost" 
            size="icon" 
            className={`${isRecording ? 'text-red-500' : 'text-slate-400 hover:text-red-400'} hover:bg-slate-800`}
            disabled={!hasVideo}
            onClick={() => setIsRecording(!isRecording)}
          >
            <Video className="h-5 w-5" />
          </Button>
        </div>
        
        <div className="flex items-center gap-4 font-mono text-xs text-slate-400">
          <span className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${hasVideo ? 'bg-emerald-500' : 'bg-red-500'}`} />
            {hasVideo ? 'STREAM ACTIVE' : 'STREAM OFFLINE'}
          </span>
          <span>1080p 60FPS</span>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" className="text-slate-400 hover:text-white hover:bg-slate-800">
            <Settings className="h-5 w-5" />
          </Button>
          <Button 
            variant="ghost" 
            size="icon" 
            className="text-slate-400 hover:text-white hover:bg-slate-800"
            onClick={() => setIsFullscreen(!isFullscreen)}
          >
            {isFullscreen ? <Minimize2 className="h-5 w-5" /> : <Maximize2 className="h-5 w-5" />}
          </Button>
        </div>
      </div>
    </div>
  );
}
