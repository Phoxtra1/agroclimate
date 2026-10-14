import { useEffect, useRef, useState } from "react";
import { Camera, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { frameQuality } from "@/lib/produceSafety";

export function CameraCapture({ open, onClose, onCapture }: { open: boolean; onClose: () => void; onCapture: (image: string) => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const stream = useRef<MediaStream>();
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  const [auto, setAuto] = useState(true);
  const [hint, setHint] = useState("Starting camera…");
  const captured = useRef(false);
  const capture = () => {
    const source = video.current;
    if (!source?.videoWidth || captured.current) return;
    captured.current = true;
    const canvas = document.createElement("canvas");
    const scale = Math.min(1, 1400 / Math.max(source.videoWidth, source.videoHeight));
    canvas.width = Math.round(source.videoWidth * scale);
    canvas.height = Math.round(source.videoHeight * scale);
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
    stream.current?.getTracks().forEach(track => track.stop());
    onCapture(canvas.toDataURL("image/jpeg", 0.85));
    onClose();
  };
  const captureRef = useRef(capture);
  captureRef.current = capture;
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    captured.current = false;
    setReady(false); setError(""); setHint("Starting camera…");
    if (!navigator.mediaDevices?.getUserMedia) { setError("Camera unavailable. Close this window and upload a photo instead."); return; }
    navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 } }, audio: false }).then(media => {
      if (cancelled) { media.getTracks().forEach(track => track.stop()); return; }
      stream.current = media;
      if (video.current) { video.current.srcObject = media; void video.current.play().catch(() => setError("Camera could not start. Try uploading a photo.")); }
    }).catch(() => setError("Camera access was denied or no camera was found. Allow camera access or upload a photo."));
    return () => { cancelled = true; stream.current?.getTracks().forEach(track => track.stop()); };
  }, [open]);
  useEffect(() => {
    if (!open || !ready) return;
    let previous: Uint8ClampedArray | undefined;
    let stable = 0;
    const canvas = document.createElement("canvas"); canvas.width = 96; canvas.height = 72;
    const timer = window.setInterval(() => {
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      if (!ctx || !video.current?.videoWidth) return;
      ctx.drawImage(video.current, 0, 0, 96, 72);
      const pixels = ctx.getImageData(0, 0, 96, 72).data;
      const quality = frameQuality(pixels, previous); previous = pixels;
      const good = quality.lit && quality.steady && quality.detail;
      stable = good ? stable + 1 : 0;
      setHint(!quality.lit ? "Move into even, natural light" : !quality.detail ? "Move closer and bring the subject into focus" : !quality.steady ? "Hold your camera steady" : auto ? "Hold still · capturing shortly…" : "Ready to capture");
      if (auto && stable >= 6) captureRef.current();
    }, 400);
    return () => window.clearInterval(timer);
  }, [open, ready, auto]);
  return <Dialog open={open} onOpenChange={value => { if (!value) onClose(); }}><DialogContent className="max-w-xl"><DialogHeader><DialogTitle>Capture a clear photo</DialogTitle></DialogHeader>
    {error ? <p role="alert" className="text-sm text-destructive py-8">{error}</p> : <>
      <div className="relative aspect-[4/3] overflow-hidden rounded-lg bg-muted">
        <video ref={video} autoPlay playsInline muted onLoadedData={() => setReady(true)} className="h-full w-full object-cover" aria-label="Live camera preview" />
        <div className="pointer-events-none absolute inset-8 rounded-lg border-2 border-primary" />
        {!ready && <Loader2 className="absolute left-1/2 top-1/2 h-6 w-6 animate-spin text-primary" />}
      </div>
      <p className="text-sm text-center text-muted-foreground" aria-live="polite">{hint}</p>
      <div className="flex items-center justify-between gap-3"><label className="flex items-center gap-2 text-sm"><Switch checked={auto} onCheckedChange={setAuto} />Auto-capture</label><Button disabled={!ready} onClick={capture}><Camera className="mr-2 h-4 w-4" />Capture now</Button></div>
    </>}
    <Button variant="ghost" onClick={onClose}><X className="mr-2 h-4 w-4" />Close camera</Button>
  </DialogContent></Dialog>;
}