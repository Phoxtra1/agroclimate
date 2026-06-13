import React, { useRef, useState, useEffect } from "react";
import { useAIH } from "@/hooks/useAIH";
import { CameraSensorSource, StreamProtocol } from "@/services/aih/types";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Video, Camera, Settings, Activity, Thermometer, ShieldAlert, Cpu } from "lucide-react";

interface Props {
  isRecording?: boolean;
  onTakeScreenshot?: () => void;
  onToggleRecording?: () => void;
}

export function LiveStreamingConsole({ isRecording = false, onTakeScreenshot, onToggleRecording }: Props) {
  const {
    activeAircraft,
    activeSensor,
    cameraProtocol,
    telemetry,
    streamHealth,
    changeSensor,
    changeCameraProtocol,
    isSimulator,
  } = useAIH();

  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Stream protocols configuration
  const protocols: { value: StreamProtocol; label: string }[] = [
    { value: "rtsp", label: "RTSP Gateway" },
    { value: "webrtc", label: "WebRTC Live Channel" },
    { value: "hls", label: "HTTP Live Streaming (HLS)" },
  ];

  // Camera sources configuration
  const sensors: { value: CameraSensorSource; label: string; icon: any; color: string }[] = [
    { value: "rgb", label: "Standard RGB", icon: Camera, color: "text-cyan-400 border-cyan-800" },
    { value: "thermal", label: "Thermal FLIR", icon: Thermometer, color: "text-amber-500 border-amber-800" },
    { value: "multispectral", label: "Multispectral NDVI", icon: Cpu, color: "text-emerald-400 border-emerald-800" },
    { value: "environmental", label: "Environmental Probe", icon: Activity, color: "text-fuchsia-400 border-fuchsia-800" },
  ];

  // Simulation shader drawing loop
  useEffect(() => {
    let raf = 0;

    const draw = () => {
      const cv = canvasRef.current;
      if (!cv) return;
      
      const ctx = cv.getContext("2d")!;
      cv.width = cv.clientWidth || 800;
      cv.height = cv.clientHeight || 450;

      const lat = telemetry?.latitude || 5.6037;
      const lng = telemetry?.longitude || -0.1870;
      const altitude = telemetry?.altitude || 0;
      const distance = (telemetry?.speed || 0) * 1.5;

      const offsetX = (lng - (-0.1870)) * 250000;
      const offsetY = (lat - 5.6037) * 250000;

      // Set base background color by sensor type
      if (activeSensor === "rgb") {
        ctx.fillStyle = "#0c1810";
      } else if (activeSensor === "thermal") {
        ctx.fillStyle = "#08020f"; // dark purple/blue thermal baseline
      } else if (activeSensor === "multispectral") {
        ctx.fillStyle = "#101f05"; // dark olive NDVI baseline
      } else {
        ctx.fillStyle = "#0a0a14"; // environmental dark blue
      }
      ctx.fillRect(0, 0, cv.width, cv.height);

      // Draw farmland furrows / map squares
      const gridSize = 240;
      const startX = ((-offsetX) % gridSize) - gridSize;
      const startY = ((offsetY) % gridSize) - gridSize;

      for (let x = startX; x < cv.width + gridSize; x += gridSize) {
        for (let y = startY; y < cv.height + gridSize; y += gridSize) {
          const gridValX = Math.floor((x + offsetX) / gridSize);
          const gridValY = Math.floor((y - offsetY) / gridSize);
          const shade = (gridValX + gridValY) % 3;

          if (activeSensor === "rgb") {
            ctx.fillStyle = shade === 0 ? "#122a18" : shade === 1 ? "#1b2d13" : "#24341b";
          } else if (activeSensor === "thermal") {
            // Thermal spectrum: deep purple/blue to orange/yellow (ironbow)
            ctx.fillStyle = shade === 0 ? "#140a32" : shade === 1 ? "#230f41" : "#321450";
          } else if (activeSensor === "multispectral") {
            // NDVI: red (stressed/soil) to neon green (healthy foliage)
            ctx.fillStyle = shade === 0 ? "#1a3b04" : shade === 1 ? "#265408" : "#0f2604";
          } else {
            ctx.fillStyle = shade === 0 ? "#0c102b" : shade === 1 ? "#101636" : "#141c40";
          }
          ctx.fillRect(x, y, gridSize - 6, gridSize - 6);

          // Grid lines / furrow rows
          ctx.strokeStyle = activeSensor === "thermal" 
            ? "rgba(255, 100, 0, 0.03)" 
            : activeSensor === "multispectral" 
              ? "rgba(100, 255, 0, 0.03)" 
              : "rgba(255,255,255,0.02)";
          ctx.lineWidth = 1;
          for (let row = 15; row < gridSize; row += 30) {
            ctx.beginPath();
            ctx.moveTo(x + row, y);
            ctx.lineTo(x + row, y + gridSize - 6);
            ctx.stroke();
          }
        }
      }

      // Draw ground targets based on active sensor
      const targets = [
        { name: "Maize (Healthy)", rx: 200, ry: 120, rgbCol: "#22c55e", thermalCol: "#ffffff", ndviCol: "#4ade80", temp: "31.2C", stress: "0.15" },
        { name: "Soybeans (Stressed)", rx: 500, ry: 300, rgbCol: "#ef4444", thermalCol: "#f97316", ndviCol: "#f87171", temp: "39.4C", stress: "0.85" },
        { name: "Wheat (Water Stressed)", rx: 320, ry: 420, rgbCol: "#f59e0b", thermalCol: "#fb923c", ndviCol: "#fbbf24", temp: "36.8C", stress: "0.62" },
      ];

      targets.forEach((t) => {
        const tx = ((t.rx - offsetX) % 1000 + 1000) % 1000 - 100;
        const ty = ((t.ry + offsetY) % 600 + 600) % 600 - 50;

        if (tx > 0 && tx < cv.width && ty > 0 && ty < cv.height) {
          let targetColor = t.rgbCol;
          if (activeSensor === "thermal") targetColor = t.thermalCol;
          else if (activeSensor === "multispectral") targetColor = t.ndviCol;
          else if (activeSensor === "environmental") targetColor = "#a855f7";

          ctx.strokeStyle = targetColor;
          ctx.lineWidth = 1.5;
          
          // Draw bounding bracket
          ctx.beginPath();
          // Top Left
          ctx.moveTo(tx - 20, ty - 10); ctx.lineTo(tx - 20, ty - 20); ctx.lineTo(tx - 10, ty - 20);
          // Top Right
          ctx.moveTo(tx + 10, ty - 20); ctx.lineTo(tx + 20, ty - 20); ctx.lineTo(tx + 20, ty - 10);
          // Bottom Left
          ctx.moveTo(tx - 20, ty + 10); ctx.lineTo(tx - 20, ty + 20); ctx.lineTo(tx - 10, ty + 20);
          // Bottom Right
          ctx.moveTo(tx + 10, ty + 20); ctx.lineTo(tx + 20, ty + 20); ctx.lineTo(tx + 20, ty + 10);
          ctx.stroke();

          // Sensor-specific telemetry overlays
          ctx.fillStyle = targetColor;
          ctx.font = "8px monospace";
          ctx.fillText(t.name.toUpperCase(), tx - 22, ty - 25);
          
          ctx.fillStyle = "rgba(255,255,255,0.4)";
          if (activeSensor === "thermal") {
            ctx.fillStyle = "#ff5555";
            ctx.fillText(`TEMP: ${t.temp}`, tx - 22, ty + 32);
          } else if (activeSensor === "multispectral") {
            ctx.fillStyle = "#55ff55";
            ctx.fillText(`NDVI: ${(1 - Number(t.stress)).toFixed(2)}`, tx - 22, ty + 32);
          } else if (activeSensor === "environmental") {
            ctx.fillStyle = "#d8b4fe";
            ctx.fillText(`SOIL MOIST: ${(Number(t.stress) * 100).toFixed(0)}%`, tx - 22, ty + 32);
          } else {
            ctx.fillText(`CONF: ${(85 + (tx % 15)).toFixed(0)}%`, tx - 22, ty + 32);
          }
        }
      });

      // Scan Sweep effect for thermal/ndvi
      if (activeSensor !== "rgb") {
        const sweepY = (Date.now() / 8) % (cv.height + 100) - 50;
        ctx.fillStyle = activeSensor === "thermal" 
          ? "rgba(255, 100, 0, 0.06)" 
          : "rgba(34, 211, 238, 0.05)";
        ctx.fillRect(0, sweepY - 30, cv.width, 30);
        ctx.strokeStyle = activeSensor === "thermal" 
          ? "rgba(255, 100, 0, 0.15)" 
          : "rgba(34, 211, 238, 0.12)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(0, sweepY);
        ctx.lineTo(cv.width, sweepY);
        ctx.stroke();
      }

      // Draw horizon pitch/roll overlay
      ctx.strokeStyle = "rgba(34,211,238,0.25)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.strokeRect(cv.width / 2 - 15, cv.height / 2 - 15, 30, 30);
      ctx.arc(cv.width / 2, cv.height / 2, 1, 0, Math.PI * 2);
      ctx.stroke();

      raf = requestAnimationFrame(draw);
    };

    draw();

    return () => cancelAnimationFrame(raf);
  }, [activeSensor, telemetry]);

  return (
    <div className="space-y-4">
      {/* Stream Controls Panel */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-slate-900 p-3 rounded-lg border border-slate-800">
        <div className="flex items-center gap-3">
          <div className="space-y-1">
            <label className="text-[9px] font-mono text-slate-500 uppercase">Stream Protocol</label>
            <Select value={cameraProtocol} onValueChange={(v: StreamProtocol) => changeCameraProtocol(v)}>
              <SelectTrigger className="bg-slate-950 border-slate-800 text-slate-300 font-mono h-8 text-xs w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-slate-900 border-slate-800 text-slate-300 font-mono text-xs">
                {protocols.map((p) => (
                  <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <label className="text-[9px] font-mono text-slate-500 uppercase">Camera Sensor Source</label>
            <div className="flex items-center gap-1.5">
              {sensors.map((s) => {
                const Icon = s.icon;
                const isSelected = activeSensor === s.value;
                return (
                  <Button
                    key={s.value}
                    size="sm"
                    variant="outline"
                    className={`h-8 px-2.5 font-mono text-xs ${
                      isSelected 
                        ? "bg-cyan-950/40 text-cyan-400 border-cyan-600" 
                        : "bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200"
                    }`}
                    onClick={() => changeSensor(s.value)}
                  >
                    <Icon className="h-3.5 w-3.5 mr-1" /> {s.label.split(" ")[0]}
                  </Button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Video signal metrics */}
        <div className="grid grid-cols-3 sm:grid-cols-5 gap-3 text-[10px] font-mono text-slate-400 bg-slate-950 p-2 rounded border border-slate-800">
          <div>FPS: <span className="text-cyan-400 font-bold">{streamHealth.fps}</span></div>
          <div>BITRATE: <span className="text-cyan-400 font-bold">{(streamHealth.bitrateKbps / 1000).toFixed(1)} Mbps</span></div>
          <div>LATENCY: <span className="text-cyan-400 font-bold">{streamHealth.latencyMs}ms</span></div>
          <div>LOSS: <span className="text-cyan-400 font-bold">{streamHealth.packetLossPct.toFixed(1)}%</span></div>
          <div>SIGNAL: <span className="text-cyan-400 font-bold">{streamHealth.signalQuality}%</span></div>
        </div>
      </div>

      {/* Video stream canvas container */}
      <div className="relative border border-slate-800 rounded-lg overflow-hidden bg-black aspect-video w-full">
        {activeAircraft ? (
          <>
            <canvas ref={canvasRef} className="w-full h-full block" />
            <div className="absolute top-3 left-3 bg-black/60 border border-slate-800 rounded px-2 py-1 font-mono text-[10px] text-cyan-500 flex items-center gap-1.5 tracking-wider">
              <span className="w-2 h-2 rounded-full bg-red-500 animate-ping" />
              {cameraProtocol.toUpperCase()} FEED // SENSOR: {activeSensor.toUpperCase()}
              {isRecording && <span className="text-red-400 font-bold ml-2">● RECORDING</span>}
            </div>

            <div className="absolute top-3 right-3 bg-black/60 border border-slate-800 rounded px-2 py-1 font-mono text-[9px] text-slate-400">
              {isSimulator ? "SIMULATION MODE ACTIVE" : "REAL-TIME HARDWARE ENVELOPE"}
            </div>

            {/* Crosshair indicator */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="w-8 h-8 border border-cyan-500/20 rounded-full flex items-center justify-center">
                <div className="w-1 h-1 bg-cyan-500/50 rounded-full" />
              </div>
            </div>
          </>
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-500 font-mono p-4 text-center">
            <Video className="h-12 w-12 text-slate-700 mb-3 animate-pulse" />
            <h4 className="font-bold text-slate-400 uppercase tracking-widest text-xs">Waiting for Signal Payload</h4>
            <p className="text-[10px] text-slate-600 max-w-xs mt-1.5 leading-relaxed">
              Air Integration Hub (AIH) awaiting aircraft handshake. Connect an asset in the registry to pipe streaming feeds.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
export default LiveStreamingConsole;
