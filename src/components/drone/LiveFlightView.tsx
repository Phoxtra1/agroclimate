import React, { useRef, useState, useEffect } from "react";
import { Maximize2, Minimize2, Camera, Video, PictureInPicture2, Settings, Crosshair, Cctv, CameraOff } from "lucide-react";
import type { TelemetryData, DroneStatus } from "@/hooks/useDroneState";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { useToast } from "@/hooks/use-toast";
import { useDroneMedia } from "@/hooks/useDroneMedia";
import { useDroneVision } from "@/hooks/useDroneVision";

interface Props {
  telemetry: TelemetryData;
  status: DroneStatus;
  missionId?: string | null;
  streamUrl?: string;
}

export function LiveFlightView({ telemetry, status, missionId, streamUrl }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunks = useRef<Blob[]>([]);
  const webcamStreamRef = useRef<MediaStream | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [useWebcam, setUseWebcam] = useState(false);
  const [facing, setFacing] = useState<"environment" | "user">("environment");
  const [overlayDetections, setOverlayDetections] = useState<string[]>([]);
  const [settings, setSettings] = useState({ hud: true, grid: true, horizon: true, brightness: 100, contrast: 100 });
  const { toast } = useToast();
  const { upload } = useDroneMedia();
  const { analyzeBase64 } = useDroneVision();

  const isFlying = status === "flying" || status === "returning" || status === "paused";
  const hasVideo = status !== "disconnected" && status !== "connecting";
  const liveSource: "stream" | "webcam" | "sim" = streamUrl ? "stream" : useWebcam ? "webcam" : "sim";

  useEffect(() => {
    const onFs = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onFs);
    return () => document.removeEventListener("fullscreenchange", onFs);
  }, []);

  // Webcam stream lifecycle (real-time camera feed)
  useEffect(() => {
    let cancelled = false;
    const start = async () => {
      try {
        if (webcamStreamRef.current) {
          webcamStreamRef.current.getTracks().forEach((t) => t.stop());
          webcamStreamRef.current = null;
        }
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: facing } }, audio: false,
        });
        if (cancelled) { stream.getTracks().forEach((t) => t.stop()); return; }
        webcamStreamRef.current = stream;
        if (videoRef.current) { videoRef.current.srcObject = stream; videoRef.current.play().catch(() => {}); }
      } catch (e: any) {
        toast({ title: "Camera unavailable", description: e.message, variant: "destructive" });
        setUseWebcam(false);
      }
    };
    if (useWebcam) start();
    return () => {
      cancelled = true;
      webcamStreamRef.current?.getTracks().forEach((t) => t.stop());
      webcamStreamRef.current = null;
      if (videoRef.current) videoRef.current.srcObject = null;
    };
  }, [useWebcam, facing, toast]);

  const captureBlob = async (): Promise<Blob> => {
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
    if (settings.hud) {
      ctx.fillStyle = "#22d3ee"; ctx.font = "16px monospace";
      ctx.fillText(`ALT ${telemetry.altitude.toFixed(1)}m`, 24, 32);
      ctx.fillText(`SPD ${telemetry.groundSpeed.toFixed(1)} m/s`, 24, 56);
      ctx.fillText(`HDG ${Math.round(telemetry.heading)}°`, 24, 80);
      ctx.fillText(`BAT ${telemetry.battery.toFixed(0)}%`, w - 140, 32);
    }
    return await new Promise((r) => canvas.toBlob((b) => r(b!), "image/jpeg", 0.85));
  };

  const takeScreenshot = async () => {
    try {
      const blob = await captureBlob();
      await upload(blob, { mediaType: "image", missionId: missionId ?? undefined, metadata: { telemetry } });
      toast({ title: "Screenshot saved" });
      const base64 = await new Promise<string>((res) => {
        const fr = new FileReader(); fr.onload = () => res((fr.result as string).split(",")[1]); fr.readAsDataURL(blob);
      });
      analyzeBase64(base64, missionId ?? undefined).then((f) => {
        if (f) setOverlayDetections(f.detections.slice(0, 3).map((d) => `${d.category.toUpperCase()}: ${d.observation.slice(0, 40)}`));
      });
    } catch (e: any) { toast({ title: "Screenshot failed", description: e.message, variant: "destructive" }); }
  };

  const captureStreamForRecording = (): MediaStream | null => {
    if (webcamStreamRef.current) return webcamStreamRef.current;
    if (videoRef.current && (videoRef.current as any).captureStream) return (videoRef.current as any).captureStream();
    if (canvasRef.current && (canvasRef.current as any).captureStream) return (canvasRef.current as any).captureStream(15);
    return null;
  };

  const toggleRecording = async () => {
    if (isRecording) { recorderRef.current?.stop(); return; }
    try {
      const stream = captureStreamForRecording();
      if (!stream) throw new Error("No active media stream");
      const rec = new MediaRecorder(stream, { mimeType: "video/webm" });
      recordedChunks.current = [];
      rec.ondataavailable = (e) => { if (e.data.size > 0) recordedChunks.current.push(e.data); };
      rec.onstop = async () => {
        const blob = new Blob(recordedChunks.current, { type: "video/webm" });
        try { await upload(blob, { mediaType: "video", missionId: missionId ?? undefined }); toast({ title: "Recording saved" }); }
        catch (e: any) { toast({ title: "Save failed", description: e.message, variant: "destructive" }); }
        setIsRecording(false);
      };
      rec.start();
      recorderRef.current = rec;
      setIsRecording(true);
      toast({ title: "Recording started" });
    } catch (e: any) { toast({ title: "Record unavailable", description: e.message, variant: "destructive" }); }
  };

  const enterPiP = async () => {
    try {
      const video = videoRef.current;
      if (!video) throw new Error("No video element");
      // If using simulated canvas, pipe it into the hidden video first
      if (liveSource === "sim" && canvasRef.current) {
        const stream = (canvasRef.current as any).captureStream?.(15);
        if (stream) { video.srcObject = stream; await video.play().catch(() => {}); }
      }
      if (document.pictureInPictureElement) await document.exitPictureInPicture();
      else await video.requestPictureInPicture();
    } catch (e: any) { toast({ title: "PiP unavailable", description: e.message, variant: "destructive" }); }
  };

  const toggleFullscreen = async () => {
    if (!containerRef.current) return;
    if (document.fullscreenElement) await document.exitFullscreen();
    else await containerRef.current.requestFullscreen();
  };

  // HUD render loop for sim/fallback
  useEffect(() => {
    let raf = 0;
    const draw = () => {
      const cv = canvasRef.current;
      if (cv && liveSource === "sim") {
        cv.width = cv.clientWidth || 800;
        cv.height = cv.clientHeight || 450;
        const ctx = cv.getContext("2d")!;
        ctx.fillStyle = "#000"; ctx.fillRect(0, 0, cv.width, cv.height);
        if (settings.grid) {
          ctx.strokeStyle = "rgba(255,255,255,0.05)"; ctx.lineWidth = 1;
          for (let x = 0; x < cv.width; x += 40) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, cv.height); ctx.stroke(); }
          for (let y = 0; y < cv.height; y += 40) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(cv.width, y); ctx.stroke(); }
        }
        if (settings.horizon) {
          ctx.strokeStyle = "rgba(34,211,238,0.3)"; ctx.beginPath();
          ctx.arc(cv.width/2, cv.height/2, 110, 0, Math.PI*2); ctx.stroke();
          ctx.beginPath();
          const roll = isFlying ? Math.sin(Date.now()/1000) * 8 : 0;
          ctx.save(); ctx.translate(cv.width/2, cv.height/2); ctx.rotate(roll*Math.PI/180);
          ctx.moveTo(-100, 0); ctx.lineTo(100, 0); ctx.stroke(); ctx.restore();
        }
      }
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [isFlying, liveSource, settings.grid, settings.horizon]);

  const filterStyle = { filter: `brightness(${settings.brightness}%) contrast(${settings.contrast}%)` } as React.CSSProperties;

  return (
    <div ref={containerRef} className="relative bg-slate-900 border border-slate-800 rounded-xl overflow-hidden flex flex-col h-[500px]">
      <div className="flex-1 relative bg-black flex items-center justify-center overflow-hidden">
        {hasVideo ? (
          <>
            {/* Video element (used by stream URL, webcam, or piped canvas for PiP) */}
            <video ref={videoRef} src={streamUrl} autoPlay muted playsInline
              className={`absolute inset-0 w-full h-full object-cover ${liveSource === "sim" ? "opacity-0 pointer-events-none" : ""}`}
              style={filterStyle} />
            {liveSource === "sim" && <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" style={filterStyle} />}
            <Crosshair className="absolute text-cyan-500/40 h-16 w-16" strokeWidth={1} />

            <div className="absolute bottom-4 left-4 text-[10px] font-mono text-cyan-500/80 uppercase tracking-widest bg-black/60 px-2 py-1 rounded">
              CAM-{liveSource === "webcam" ? "DEV" : liveSource === "stream" ? "LIVE" : "1"} [{liveSource.toUpperCase()}] {isRecording && <span className="text-red-500 animate-pulse ml-2">● REC</span>}
            </div>

            {settings.hud && (
              <>
                <div className="absolute top-4 left-4 text-cyan-400 font-mono text-xs space-y-1 bg-black/40 px-2 py-1 rounded">
                  <div>ALT: {telemetry.altitude.toFixed(1)} m</div>
                  <div>SPD: {telemetry.groundSpeed.toFixed(1)} m/s</div>
                  <div>HDG: {Math.round(telemetry.heading)}°</div>
                  <div>DST: {telemetry.distanceCovered.toFixed(0)} m</div>
                </div>
                <div className="absolute top-4 right-4 text-cyan-400 font-mono text-xs space-y-1 text-right bg-black/40 px-2 py-1 rounded">
                  <div>BAT: {telemetry.battery.toFixed(1)}%</div>
                  <div>SIG: {telemetry.signalStrength.toFixed(0)}%</div>
                  <div>T+: {Math.floor(telemetry.flightDuration/60)}:{String(Math.floor(telemetry.flightDuration%60)).padStart(2,"0")}</div>
                  <div className={telemetry.battery < 25 ? "text-red-400" : "text-emerald-400"}>VISION ACTIVE</div>
                </div>
              </>
            )}

            {overlayDetections.length > 0 && (
              <div className="absolute bottom-16 left-4 right-4 space-y-1">
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

      <div className="h-14 bg-slate-950 border-t border-slate-800 flex items-center justify-between px-4">
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="text-slate-400 hover:text-cyan-400 hover:bg-slate-800" disabled={!hasVideo} onClick={takeScreenshot} title="Screenshot">
            <Camera className="h-5 w-5" />
          </Button>
          <Button variant="ghost" size="icon" className={`${isRecording ? "text-red-500" : "text-slate-400 hover:text-red-400"} hover:bg-slate-800`} disabled={!hasVideo} onClick={toggleRecording} title="Record">
            <Video className="h-5 w-5" />
          </Button>
          <Button variant="ghost" size="icon" className="text-slate-400 hover:text-cyan-400 hover:bg-slate-800" disabled={!hasVideo} onClick={enterPiP} title="Picture-in-Picture">
            <PictureInPicture2 className="h-5 w-5" />
          </Button>
          <Button variant="ghost" size="icon" className={`hover:bg-slate-800 ${useWebcam ? "text-emerald-400" : "text-slate-400 hover:text-cyan-400"}`} disabled={!hasVideo} onClick={() => setUseWebcam((v) => !v)} title="Use Device Camera">
            {useWebcam ? <CameraOff className="h-5 w-5" /> : <Cctv className="h-5 w-5" />}
          </Button>
          {useWebcam && (
            <Button variant="ghost" size="sm" className="text-[10px] font-mono text-cyan-300 hover:bg-slate-800" onClick={() => setFacing((f) => f === "environment" ? "user" : "environment")} title="Switch Camera">
              {facing === "environment" ? "REAR" : "FRONT"}
            </Button>
          )}
        </div>

        <div className="flex items-center gap-4 font-mono text-xs text-slate-400">
          <span className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${hasVideo ? "bg-emerald-500" : "bg-red-500"}`} />
            {hasVideo ? "STREAM ACTIVE" : "OFFLINE"}
          </span>
          <span>{liveSource.toUpperCase()} 720p</span>
        </div>

        <div className="flex items-center gap-1">
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="icon" className="text-slate-400 hover:text-white hover:bg-slate-800" title="Settings">
                <Settings className="h-5 w-5" />
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="bg-slate-950 border-slate-800 text-slate-200 w-64 space-y-3 font-mono text-xs">
              <div className="flex items-center justify-between"><span>HUD Overlay</span><Switch checked={settings.hud} onCheckedChange={(v) => setSettings({ ...settings, hud: v })} /></div>
              <div className="flex items-center justify-between"><span>Reference Grid</span><Switch checked={settings.grid} onCheckedChange={(v) => setSettings({ ...settings, grid: v })} /></div>
              <div className="flex items-center justify-between"><span>Artificial Horizon</span><Switch checked={settings.horizon} onCheckedChange={(v) => setSettings({ ...settings, horizon: v })} /></div>
              <div className="space-y-1"><div className="flex justify-between"><span>Brightness</span><span>{settings.brightness}%</span></div><Slider value={[settings.brightness]} min={50} max={150} step={5} onValueChange={(v) => setSettings({ ...settings, brightness: v[0] })} /></div>
              <div className="space-y-1"><div className="flex justify-between"><span>Contrast</span><span>{settings.contrast}%</span></div><Slider value={[settings.contrast]} min={50} max={150} step={5} onValueChange={(v) => setSettings({ ...settings, contrast: v[0] })} /></div>
            </PopoverContent>
          </Popover>
          <Button variant="ghost" size="icon" className="text-slate-400 hover:text-white hover:bg-slate-800" onClick={toggleFullscreen} title="Fullscreen">
            {isFullscreen ? <Minimize2 className="h-5 w-5" /> : <Maximize2 className="h-5 w-5" />}
          </Button>
        </div>
      </div>
    </div>
  );
}
