import React, { useRef, useState, useEffect } from "react";
import { Maximize2, Minimize2, Camera, Video, PictureInPicture2, Settings, Crosshair, AlertTriangle, Volume2, VolumeX } from "lucide-react";
import type { TelemetryData, DroneStatus, EnvironmentData } from "@/hooks/useDroneState";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useDroneMedia } from "@/hooks/useDroneMedia";
import { useDroneVision } from "@/hooks/useDroneVision";
import { Link } from "react-router-dom";

interface Props {
  telemetry: TelemetryData;
  status: DroneStatus;
  missionId?: string | null;
  streamUrl?: string; // optional MJPEG/WebRTC source
  onEmergencyLand?: () => Promise<void>;
  onReturnToHome?: () => Promise<void>;
  environment?: EnvironmentData;
}

interface Aircraft {
  id: string;
  name: string;
  distance: number;
  bearing: number;
  type: string;
  x: number;
  y: number;
  speed: number;
}

export function LiveFlightView({ telemetry, status, missionId, streamUrl, onEmergencyLand, onReturnToHome, environment }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunks = useRef<Blob[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [overlayDetections, setOverlayDetections] = useState<string[]>([]);
  const [nearbyAircraft, setNearbyAircraft] = useState<Aircraft | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [showEmergencyPrompt, setShowEmergencyPrompt] = useState(false);

  const { toast } = useToast();
  const { upload } = useDroneMedia();
  const { analyzeBase64 } = useDroneVision();

  const isFlying = status === "flying" || status === "returning" || status === "paused";
  const hasVideo = status !== "disconnected" && status !== "connecting";

  // Check if severe weather is active
  const hasSevereWeather = environment && (environment.windSpeed > 30 || environment.rainProbability > 80);

  // Trigger emergency prompt when severe weather begins during flight
  useEffect(() => {
    if (isFlying && hasSevereWeather) {
      setShowEmergencyPrompt(true);
    } else {
      setShowEmergencyPrompt(false);
    }
  }, [isFlying, hasSevereWeather]);

  // Audio warning beeper using Web Audio API
  const playWarningBeep = (freq = 980, duration = 0.12) => {
    if (isMuted) return;
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.type = "sine";
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.06, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);
      osc.start();
      osc.stop(audioCtx.currentTime + duration);
    } catch (e) {
      // AudioContext blocked by browser policy before user interaction
    }
  };

  // Radar simulator loop
  useEffect(() => {
    if (!isFlying) {
      setNearbyAircraft(null);
      return;
    }

    const interval = setInterval(() => {
      setNearbyAircraft((current) => {
        if (!current) {
          // 15% chance to spawn an aircraft at a distance
          if (Math.random() < 0.15) {
            const angle = Math.random() * Math.PI * 2;
            const startDist = 800 + Math.random() * 400; // meters away
            return {
              id: "flight-" + Math.floor(Math.random() * 1000),
              name: Math.random() > 0.5 ? "Cessna 172 (Manned)" : "Bell 206 (Manned)",
              distance: startDist,
              bearing: Math.floor(Math.random() * 360),
              type: Math.random() > 0.5 ? "Light Aircraft" : "Helicopter",
              x: Math.cos(angle) * 200 + 400,
              y: Math.sin(angle) * 150 + 225,
              speed: 15 + Math.random() * 10,
            };
          }
          return null;
        }

        // Move aircraft closer to center (drone)
        const dx = 400 - current.x;
        const dy = 225 - current.y;
        const angle = Math.atan2(dy, dx);
        const nextX = current.x + Math.cos(angle) * (current.speed / 4);
        const nextY = current.y + Math.sin(angle) * (current.speed / 4);

        const newDist = Math.max(20, current.distance - current.speed * 2);

        // Remove if it flies past the drone and goes far
        if (newDist <= 20 && Math.random() < 0.2) {
          return null;
        }

        return {
          ...current,
          x: nextX,
          y: nextY,
          distance: newDist,
          bearing: (current.bearing + 2) % 360,
        };
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isFlying]);

  // Handle beeping when aircraft is in proximity or weather is severe
  useEffect(() => {
    if (!isFlying) return;

    let beepInterval: ReturnType<typeof setInterval> | null = null;

    if (nearbyAircraft && nearbyAircraft.distance < 300) {
      // Aircraft collision beep (fast)
      beepInterval = setInterval(() => {
        playWarningBeep(1020, 0.1);
      }, 600);
    } else if (hasSevereWeather) {
      // Weather warning beep (slow)
      beepInterval = setInterval(() => {
        playWarningBeep(820, 0.2);
      }, 1500);
    }

    return () => {
      if (beepInterval) clearInterval(beepInterval);
    };
  }, [isFlying, nearbyAircraft?.distance, hasSevereWeather, isMuted]);

  useEffect(() => {
    const onFs = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onFs);
    return () => document.removeEventListener("fullscreenchange", onFs);
  }, []);

  const takeScreenshot = async () => {
    try {
      const canvas = document.createElement("canvas");
      const w = 1280, h = 720;
      canvas.width = w; canvas.height = h;
      const ctx = canvas.getContext("2d")!;

      if (videoRef.current && videoRef.current.readyState >= 2) {
        ctx.drawImage(videoRef.current, 0, 0, w, h);
      } else if (canvasRef.current) {
        ctx.drawImage(canvasRef.current, 0, 0, w, h);
      } else {
        ctx.fillStyle = "#0b1220"; ctx.fillRect(0, 0, w, h);
      }

      const blob: Blob = await new Promise((r) => canvas.toBlob((b) => r(b!), "image/jpeg", 0.85));
      await upload(blob, { mediaType: "image", missionId: missionId ?? undefined, metadata: { telemetry } });
      toast({ title: "Screenshot saved" });

      const base64 = await new Promise<string>((res) => {
        const fr = new FileReader(); fr.onload = () => res((fr.result as string).split(",")[1]); fr.readAsDataURL(blob);
      });
      analyzeBase64(base64, missionId ?? undefined).then((f) => {
        if (f) setOverlayDetections(f.detections.slice(0, 3).map((d) => `${d.category.toUpperCase()}: ${d.observation.slice(0, 40)}`));
      });
    } catch (e: any) {
      toast({ title: "Screenshot failed", description: e.message, variant: "destructive" });
    }
  };

  const toggleRecording = async () => {
    if (isRecording) {
      recorderRef.current?.stop();
      return;
    }
    try {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const stream = (canvas as any).captureStream(15) as MediaStream;
      const rec = new MediaRecorder(stream, { mimeType: "video/webm" });
      recordedChunks.current = [];
      rec.ondataavailable = (e) => { if (e.data.size > 0) recordedChunks.current.push(e.data); };
      rec.onstop = async () => {
        const blob = new Blob(recordedChunks.current, { type: "video/webm" });
        try {
          await upload(blob, { mediaType: "video", missionId: missionId ?? undefined });
          toast({ title: "Recording saved" });
        } catch (e: any) {
          toast({ title: "Save failed", description: e.message, variant: "destructive" });
        }
        setIsRecording(false);
      };
      rec.start();
      recorderRef.current = rec;
      setIsRecording(true);
      toast({ title: "Recording started" });
    } catch (e: any) {
      toast({ title: "Record unavailable", description: e.message, variant: "destructive" });
    }
  };

  const enterPiP = async () => {
    try {
      if (!videoRef.current) return;
      if (document.pictureInPictureElement) await document.exitPictureInPicture();
      else await videoRef.current.requestPictureInPicture();
    } catch (e: any) {
      toast({ title: "PiP unavailable", description: e.message, variant: "destructive" });
    }
  };

  const toggleFullscreen = async () => {
    if (!containerRef.current) return;
    if (document.fullscreenElement) await document.exitFullscreen();
    else await containerRef.current.requestFullscreen();
  };

  // Draw simulated dynamic field scene and HUD overlays
  useEffect(() => {
    let raf = 0;
    const draw = () => {
      const cv = canvasRef.current;
      if (cv) {
        cv.width = cv.clientWidth || 800;
        cv.height = cv.clientHeight || 450;
        const ctx = cv.getContext("2d")!;
        
        // Base coordinate values for movement
        const startLat = 5.6037;
        const startLng = -0.1870;
        const currentLat = telemetry.lat || startLat;
        const currentLng = telemetry.lng || startLng;
        
        // Translate coordinates to pixel offsets (scale factor ~100000)
        const offsetX = (currentLng - startLng) * 250000;
        const offsetY = (currentLat - startLat) * 250000;

        // 1. Draw Farmland background scrolling
        ctx.fillStyle = "#0c1810";
        ctx.fillRect(0, 0, cv.width, cv.height);

        // Draw rolling field grids
        const fieldSize = 240;
        const startX = ((-offsetX) % fieldSize) - fieldSize;
        const startY = ((offsetY) % fieldSize) - fieldSize;

        for (let x = startX; x < cv.width + fieldSize; x += fieldSize) {
          for (let y = startY; y < cv.height + fieldSize; y += fieldSize) {
            const gridValX = Math.floor((x + offsetX) / fieldSize);
            const gridValY = Math.floor((y - offsetY) / fieldSize);
            
            // Choose green, olive, or brown shades for crops
            const shade = (gridValX + gridValY) % 3;
            ctx.fillStyle = shade === 0 ? "#122a18" : shade === 1 ? "#1b2d13" : "#24341b";
            ctx.fillRect(x, y, fieldSize - 6, fieldSize - 6);

            // Draw interior crop furrow rows
            ctx.strokeStyle = "rgba(255,255,255,0.03)";
            ctx.lineWidth = 1;
            for (let row = 15; row < fieldSize; row += 25) {
              ctx.beginPath();
              ctx.moveTo(x + row, y);
              ctx.lineTo(x + row, y + fieldSize - 6);
              ctx.stroke();
            }
          }
        }

        // 2. Draw Crop Health targets scanned by AI
        const groundTargets = [
          { name: "Maize (Healthy)", rx: 200, ry: 120, status: "healthy", color: "#22c55e" },
          { name: "Soybeans (Pest Infestation)", rx: 500, ry: 300, status: "pests", color: "#ef4444" },
          { name: "Wheat (Water Stressed)", rx: 320, ry: 420, status: "dry", color: "#f59e0b" },
          { name: "Maize (Nitrogen Deficient)", rx: 700, ry: 150, status: "deficient", color: "#f59e0b" },
        ];

        groundTargets.forEach((t) => {
          // Compute screen position based on drone coordinate offsets
          const tx = ((t.rx - offsetX) % 1000 + 1000) % 1000 - 100;
          const ty = ((t.ry + offsetY) % 600 + 600) % 600 - 50;

          if (tx > 0 && tx < cv.width && ty > 0 && ty < cv.height) {
            // Draw scanning bounding bracket
            ctx.strokeStyle = t.color;
            ctx.lineWidth = 1.5;
            
            // Corners brackets
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

            // AI Label text
            ctx.fillStyle = t.color;
            ctx.font = "8px monospace";
            ctx.fillText(t.name.toUpperCase(), tx - 22, ty - 25);
            ctx.fillStyle = "rgba(255,255,255,0.4)";
            ctx.fillText(`CONF: ${(88 + (tx % 11)).toFixed(0)}%`, tx - 22, ty + 32);
          }
        });

        // 3. Draw Radar Indicator & scan sweep
        const rx = 100, ry = 350, rSize = 60;
        ctx.fillStyle = "rgba(10,20,15,0.7)";
        ctx.beginPath();
        ctx.arc(rx, ry, rSize, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "rgba(34,211,238,0.2)";
        ctx.lineWidth = 1;
        ctx.stroke();
        
        ctx.beginPath();
        ctx.arc(rx, ry, rSize / 2, 0, Math.PI * 2);
        ctx.stroke();

        // Crosshairs in radar
        ctx.beginPath();
        ctx.moveTo(rx - rSize, ry); ctx.lineTo(rx + rSize, ry);
        ctx.moveTo(rx, ry - rSize); ctx.lineTo(rx, ry + rSize);
        ctx.stroke();

        // Radar line sweep rotating
        const angle = (Date.now() / 800) % (Math.PI * 2);
        ctx.strokeStyle = "rgba(34,211,238,0.6)";
        ctx.beginPath();
        ctx.moveTo(rx, ry);
        ctx.lineTo(rx + Math.cos(angle) * rSize, ry + Math.sin(angle) * rSize);
        ctx.stroke();

        // Draw nearby aircraft on radar and camera feed
        if (nearbyAircraft) {
          const adx = (nearbyAircraft.x - 400) / 4;
          const ady = (nearbyAircraft.y - 225) / 4;
          
          // Radar dot
          const arx = rx + adx;
          const ary = ry + ady;
          if (Math.pow(arx - rx, 2) + Math.pow(ary - ry, 2) < Math.pow(rSize, 2)) {
            ctx.fillStyle = nearbyAircraft.distance < 300 ? "#ef4444" : "#f59e0b";
            ctx.beginPath();
            ctx.arc(arx, ary, 3, 0, Math.PI * 2);
            ctx.fill();
          }

          // Camera Overlay marker (if in field of view)
          const ax = nearbyAircraft.x;
          const ay = nearbyAircraft.y;
          if (ax > 40 && ax < cv.width - 40 && ay > 40 && ay < cv.height - 40) {
            ctx.strokeStyle = nearbyAircraft.distance < 300 ? "#ef4444" : "#f59e0b";
            ctx.lineWidth = 1.5;
            
            // Draw triangle marker
            ctx.beginPath();
            ctx.moveTo(ax, ay - 10);
            ctx.lineTo(ax - 8, ay + 6);
            ctx.lineTo(ax + 8, ay + 6);
            ctx.closePath();
            ctx.stroke();

            // Labels
            ctx.fillStyle = nearbyAircraft.distance < 300 ? "#ef4444" : "#f59e0b";
            ctx.font = "8px monospace";
            ctx.fillText(nearbyAircraft.name.toUpperCase(), ax - 45, ay - 16);
            ctx.fillStyle = "rgba(255,255,255,0.7)";
            ctx.fillText(`DIST: ${nearbyAircraft.distance.toFixed(0)}m ALT: 120m`, ax - 45, ay + 18);
          }
        }

        // 4. Draw HUD Crosshair
        ctx.strokeStyle = "rgba(34,211,238,0.25)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        // Central box
        ctx.strokeRect(cv.width / 2 - 15, cv.height / 2 - 15, 30, 30);
        // Center dot
        ctx.arc(cv.width / 2, cv.height / 2, 1, 0, Math.PI * 2);
        ctx.stroke();

        // Horizon pitch ladders
        ctx.strokeStyle = "rgba(34,211,238,0.2)";
        const roll = isFlying ? Math.sin(Date.now() / 1500) * 4 : 0;
        ctx.save();
        ctx.translate(cv.width / 2, cv.height / 2);
        ctx.rotate((roll * Math.PI) / 180);
        ctx.beginPath();
        // Left horizon
        ctx.moveTo(-100, 0); ctx.lineTo(-40, 0);
        ctx.moveTo(-40, 0); ctx.lineTo(-40, 10);
        // Right horizon
        ctx.moveTo(40, 0); ctx.lineTo(100, 0);
        ctx.moveTo(40, 0); ctx.lineTo(40, 10);
        ctx.stroke();
        ctx.restore();
      }
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [isFlying, telemetry, nearbyAircraft]);

  return (
    <div ref={containerRef} className="relative bg-slate-900 border border-slate-800 rounded-xl overflow-hidden flex flex-col h-[500px]">
      
      {/* SEVERE WEATHER ALERT BANNER */}
      {isFlying && hasSevereWeather && (
        <div className="absolute top-0 inset-x-0 bg-red-600/90 text-white font-mono text-[10px] sm:text-xs py-1.5 px-3 flex items-center justify-between z-30 animate-pulse border-b border-red-700">
          <span className="flex items-center gap-1.5">
            <AlertTriangle className="h-4 w-4 shrink-0 text-white" />
            CRITICAL WEATHER ALERT: HIGH WIND ({environment?.windSpeed} km/h) / PRECIPITATION ({environment?.rainProbability}%)
          </span>
          <span className="font-bold">IMMEDIATE EMERGENCY LANDING RECOMMENDED</span>
        </div>
      )}

      {/* RADAR COLLISION ALERT BANNER */}
      {isFlying && nearbyAircraft && nearbyAircraft.distance < 300 && (
        <div className="absolute top-8 inset-x-0 bg-amber-600/95 text-white font-mono text-[10px] sm:text-xs py-1.5 px-3 flex items-center gap-2 z-30 animate-pulse border-b border-amber-700">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          COLLISION WARNING: MANNED AIRCRAFT ({nearbyAircraft.name}) DETECTED WITHIN {nearbyAircraft.distance.toFixed(0)}m!
        </div>
      )}

      {/* EMERGENCY LANDING PROMPT MODAL OVERLAY */}
      {showEmergencyPrompt && (
        <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-40">
          <div className="bg-slate-900 border border-red-800 rounded-lg p-5 max-w-sm w-full space-y-4 font-mono text-slate-100 shadow-2xl">
            <div className="flex items-center gap-2 text-red-500 font-bold border-b border-slate-800 pb-2">
              <AlertTriangle className="h-5 w-5 animate-bounce" />
              <span>DANGER: HIGH WEATHER RISK</span>
            </div>
            <div className="text-xs text-slate-400 space-y-2 leading-relaxed">
              <p>Current wind speed <span className="text-red-400 font-bold">{environment?.windSpeed} km/h</span> and rain risk <span className="text-red-400 font-bold">{environment?.rainProbability}%</span> exceed safety operational boundaries.</p>
              <p className="text-slate-300">Failure to land may result in drone crash or signal loss.</p>
            </div>
            <div className="flex gap-2">
              <Button
                variant="destructive"
                className="flex-1 text-xs font-semibold py-2 bg-red-600 hover:bg-red-500 text-white font-mono"
                onClick={async () => {
                  if (onEmergencyLand) {
                    await onEmergencyLand();
                    setShowEmergencyPrompt(false);
                    toast({ title: "Emergency Landing Initiated", description: "Drone descending immediately at current location." });
                  }
                }}
              >
                EMERGENCY LAND
              </Button>
              <Button
                className="flex-1 text-xs font-semibold py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-mono"
                onClick={async () => {
                  if (onReturnToHome) {
                    await onReturnToHome();
                    setShowEmergencyPrompt(false);
                    toast({ title: "RTH Initiated", description: "Drone returning to launch coordinates." });
                  }
                }}
              >
                RETURN HOME (RTH)
              </Button>
            </div>
            <button
              onClick={() => setShowEmergencyPrompt(false)}
              className="w-full text-center text-[10px] text-slate-600 hover:text-slate-400 uppercase tracking-widest mt-1 block"
            >
              Dismiss warning
            </button>
          </div>
        </div>
      )}

      {/* VIDEO CONTAINER */}
      <div className="flex-1 relative bg-black flex items-center justify-center overflow-hidden">
        {hasVideo ? (
          <>
            {streamUrl ? (
              <video ref={videoRef} src={streamUrl} autoPlay muted playsInline className="absolute inset-0 w-full h-full object-cover" />
            ) : (
              <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />
            )}
            <Crosshair className="absolute text-cyan-500/40 h-16 w-16 pointer-events-none" strokeWidth={1} />

            <div className="absolute bottom-4 left-4 text-[10px] font-mono text-cyan-500/80 uppercase tracking-widest bg-black/60 px-2 py-1 rounded">
              CAM-1 OPTICAL [LIVE] {isRecording && <span className="text-red-500 animate-pulse ml-2">● REC</span>}
            </div>

            <div className="absolute top-12 left-4 text-cyan-400 font-mono text-[10px] sm:text-xs space-y-1 bg-black/40 px-2 py-1 rounded pointer-events-none">
              <div>ALT: {telemetry.altitude.toFixed(1)} m</div>
              <div>SPD: {telemetry.groundSpeed.toFixed(1)} m/s</div>
              <div>HDG: {Math.round(telemetry.heading)}°</div>
              <div>DST: {telemetry.distanceCovered.toFixed(0)} m</div>
            </div>
            <div className="absolute top-12 right-4 text-cyan-400 font-mono text-[10px] sm:text-xs space-y-1 text-right bg-black/40 px-2 py-1 rounded pointer-events-none">
              <div>BAT: {telemetry.battery.toFixed(1)}%</div>
              <div>SIG: {telemetry.signalStrength.toFixed(0)}%</div>
              <div>T+: {Math.floor(telemetry.flightDuration/60)}:{String(Math.floor(telemetry.flightDuration%60)).padStart(2,"0")}</div>
              <div className={telemetry.battery < 25 ? "text-red-400 animate-pulse font-bold" : "text-emerald-400"}>VISION ACTIVE</div>
            </div>

            {overlayDetections.length > 0 && (
              <div className="absolute bottom-16 left-4 right-4 space-y-1 pointer-events-none">
                {overlayDetections.map((d, i) => (
                  <div key={i} className="text-[10px] font-mono text-amber-300 bg-amber-950/60 border border-amber-900 px-2 py-1 rounded">⌬ {d}</div>
                ))}
              </div>
            )}
          </>
        ) : (
          <div className="text-slate-500 flex flex-col items-center">
            <Video className="h-12 w-12 mb-2 opacity-50" />
            <p className="font-mono text-sm uppercase tracking-wider">No Video Signal</p>
            <p className="text-[10px] text-slate-600 mt-1">Connect a drone to begin streaming</p>
          </div>
        )}
      </div>

      {/* CONTROL FOOTER */}
      <div className="h-14 bg-slate-950 border-t border-slate-800 flex items-center justify-between px-4">
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="text-slate-400 hover:text-cyan-400 hover:bg-slate-800" disabled={!hasVideo} onClick={takeScreenshot} title="Screenshot">
            <Camera className="h-5 w-5" />
          </Button>
          <Button variant="ghost" size="icon" className={`${isRecording ? "text-red-500 animate-pulse" : "text-slate-400 hover:text-red-400"} hover:bg-slate-800`} disabled={!hasVideo} onClick={toggleRecording} title="Record">
            <Video className="h-5 w-5" />
          </Button>
          <Button variant="ghost" size="icon" className="text-slate-400 hover:text-cyan-400 hover:bg-slate-800" disabled={!streamUrl} onClick={enterPiP} title="Picture-in-Picture">
            <PictureInPicture2 className="h-5 w-5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="text-slate-400 hover:text-cyan-400 hover:bg-slate-800"
            onClick={() => setIsMuted(!isMuted)}
            title={isMuted ? "Unmute Alerts" : "Mute Alerts"}
          >
            {isMuted ? <VolumeX className="h-5 w-5 text-red-500" /> : <Volume2 className="h-5 w-5 text-cyan-400" />}
          </Button>
        </div>

        <div className="flex items-center gap-4 font-mono text-xs text-slate-400">
          <span className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${hasVideo ? "bg-emerald-500" : "bg-red-500"}`} />
            {hasVideo ? "STREAM ACTIVE" : "OFFLINE"}
          </span>
          <span>{streamUrl ? "LIVE" : "SIM"} 720p</span>
        </div>

        <div className="flex items-center gap-1">
          <Link to="/profile">
            <Button variant="ghost" size="icon" className="text-slate-400 hover:text-white hover:bg-slate-800" title="Settings">
              <Settings className="h-5 w-5" />
            </Button>
          </Link>
          <Button variant="ghost" size="icon" className="text-slate-400 hover:text-white hover:bg-slate-800" onClick={toggleFullscreen} title="Fullscreen">
            {isFullscreen ? <Minimize2 className="h-5 w-5" /> : <Maximize2 className="h-5 w-5" />}
          </Button>
        </div>
      </div>
    </div>
  );
}
