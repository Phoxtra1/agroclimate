import { useEffect, useRef, useState } from "react";
import { Camera, Loader2, X, RefreshCw, CheckCircle2, AlertTriangle, Lightbulb } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { frameQuality, SUPPORTED_PRODUCE_TYPES } from "@/lib/produceSafety";

interface CameraCaptureProps {
  open: boolean;
  onClose: () => void;
  onCapture: (image: string) => void;
  mode?: "visual" | "strip";
  selectedProduce?: string;
  testCardName?: string;
}

export function CameraCapture({
  open,
  onClose,
  onCapture,
  mode = "visual",
  selectedProduce = "mango",
  testCardName,
}: CameraCaptureProps) {
  const video = useRef<HTMLVideoElement>(null);
  const stream = useRef<MediaStream>();
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  const [auto, setAuto] = useState(true);
  const [facingMode, setFacingMode] = useState<"environment" | "user">("environment");
  const [hint, setHint] = useState("Starting camera…");
  const [qualityStats, setQualityStats] = useState<{ lit: boolean; steady: boolean; detail: boolean; lightScore: number }>({
    lit: false,
    steady: false,
    detail: false,
    lightScore: 0,
  });
  const captured = useRef(false);

  const produceInfo = SUPPORTED_PRODUCE_TYPES.find((p) => p.id === selectedProduce) || SUPPORTED_PRODUCE_TYPES[0];

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
    stream.current?.getTracks().forEach((track) => track.stop());
    onCapture(canvas.toDataURL("image/jpeg", 0.85));
    onClose();
  };

  const captureRef = useRef(capture);
  captureRef.current = capture;

  // Initialize camera stream
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    captured.current = false;
    setReady(false);
    setError("");
    setHint("Starting camera…");

    if (!navigator.mediaDevices?.getUserMedia) {
      setError("Camera API unavailable on this device. Close this window and upload a photo file instead.");
      return;
    }

    navigator.mediaDevices
      .getUserMedia({
        video: { facingMode: { ideal: facingMode }, width: { ideal: 1280 } },
        audio: false,
      })
      .then((media) => {
        if (cancelled) {
          media.getTracks().forEach((track) => track.stop());
          return;
        }
        stream.current = media;
        if (video.current) {
          video.current.srcObject = media;
          void video.current.play().catch(() => setError("Camera preview could not start. Try uploading a photo."));
        }
      })
      .catch(() => setError("Camera access was denied or no camera was found. Allow camera access or upload a photo file."));

    return () => {
      cancelled = true;
      stream.current?.getTracks().forEach((track) => track.stop());
    };
  }, [open, facingMode]);

  // Frame analysis loop for auto-capture
  useEffect(() => {
    if (!open || !ready) return;
    let previous: Uint8ClampedArray | undefined;
    let stable = 0;
    const canvas = document.createElement("canvas");
    canvas.width = 96;
    canvas.height = 72;

    const timer = window.setInterval(() => {
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      if (!ctx || !video.current?.videoWidth) return;
      ctx.drawImage(video.current, 0, 0, 96, 72);
      const pixels = ctx.getImageData(0, 0, 96, 72).data;
      const quality = frameQuality(pixels, previous);
      previous = pixels;

      setQualityStats(quality);

      const good = quality.lit && quality.steady && quality.detail;
      stable = good ? stable + 1 : 0;

      if (!quality.lit) {
        setHint("Move into even, clear lighting (avoid heavy shadows or extreme glare)");
      } else if (!quality.detail) {
        setHint(
          mode === "visual"
            ? `Fill frame with ${produceInfo.label} and focus closely on peel surface`
            : "Align chemical test card pads inside target reticle"
        );
      } else if (!quality.steady) {
        setHint("Hold camera steady...");
      } else if (auto) {
        setHint(`Optimal clarity detected! Auto-capturing in ${Math.max(1, 3 - Math.floor(stable / 2))}s...`);
      } else {
        setHint("Image clear & framed. Click 'Capture now' when ready.");
      }

      if (auto && stable >= 5) {
        captureRef.current();
      }
    }, 350);

    return () => window.clearInterval(timer);
  }, [open, ready, auto, mode, produceInfo]);

  const toggleFacing = () => {
    stream.current?.getTracks().forEach((t) => t.stop());
    setFacingMode((prev) => (prev === "environment" ? "user" : "environment"));
  };

  return (
    <Dialog open={open} onOpenChange={(val) => { if (!val) onClose(); }}>
      <DialogContent className="max-w-2xl bg-card border-border text-card-foreground p-5 sm:p-6">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="text-lg font-bold flex items-center gap-2">
              <Camera className="h-5 w-5 text-primary" />
              {mode === "visual"
                ? `Position ${produceInfo.label} in Frame`
                : testCardName
                ? `Capture ${testCardName}`
                : "Capture Chemical Test Card"}
            </DialogTitle>
            <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close camera">
              <X className="h-4 w-4" />
            </Button>
          </div>
          <DialogDescription className="text-xs text-muted-foreground mt-1">
            {mode === "visual"
              ? `Ensure whole ${produceInfo.label.toLowerCase().slice(0, -1)} peel is illuminated under daylight or neutral white indoor light.`
              : "Align test pad and manufacturer reference chart within the guide marks."}
          </DialogDescription>
        </DialogHeader>

        {error ? (
          <div role="alert" className="py-8 text-center space-y-3">
            <AlertTriangle className="h-10 w-10 text-destructive mx-auto" />
            <p className="text-sm font-medium text-destructive">{error}</p>
            <p className="text-xs text-muted-foreground">You can close this scanner and upload a clear photo from your gallery instead.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Viewport Frame */}
            <div className="relative aspect-[4/3] overflow-hidden rounded-xl bg-slate-900 border border-border shadow-inner">
              <video
                ref={video}
                autoPlay
                playsInline
                muted
                onLoadedData={() => setReady(true)}
                className="h-full w-full object-cover"
                aria-label="Live camera preview"
              />

              {!ready && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-background/80 text-foreground gap-2">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  <span className="text-xs font-medium">Initializing camera sensor...</span>
                </div>
              )}

              {ready && (
                <>
                  {/* Framing Overlay for Produce / Test Card */}
                  {mode === "visual" ? (
                    <div className="pointer-events-none absolute inset-6 sm:inset-10 border-2 border-dashed border-emerald-400/80 rounded-2xl flex flex-col justify-between p-3">
                      <div className="flex justify-between items-start">
                        <Badge className="bg-emerald-600/90 text-white text-[10px] uppercase tracking-wider backdrop-blur-sm">
                          {produceInfo.icon} {produceInfo.label} Scanner Area
                        </Badge>
                        <span className="text-[10px] bg-black/60 text-emerald-300 px-2 py-0.5 rounded backdrop-blur-sm font-mono">
                          Framing Active
                        </span>
                      </div>
                      <div className="text-center">
                        <p className="text-[11px] text-white/90 bg-black/60 px-3 py-1 rounded-full inline-block backdrop-blur-sm">
                          Keep skin surface 15-30cm from lens
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="pointer-events-none absolute inset-6 sm:inset-10 border-2 border-sky-400 rounded-lg flex flex-col justify-between p-3">
                      <div className="flex justify-between items-start">
                        <Badge className="bg-sky-600/90 text-white text-[10px] uppercase backdrop-blur-sm">
                          Reaction Area
                        </Badge>
                        <Badge className="bg-indigo-600/90 text-white text-[10px] uppercase backdrop-blur-sm">
                          Reference Scale Area
                        </Badge>
                      </div>
                      <div className="grid grid-cols-2 gap-4 h-full my-2">
                        <div className="border border-sky-400/50 bg-sky-500/10 rounded flex items-center justify-center">
                          <span className="text-[10px] font-mono text-sky-200 bg-black/50 px-1.5 py-0.5 rounded">Test Pad</span>
                        </div>
                        <div className="border border-indigo-400/50 bg-indigo-500/10 rounded flex items-center justify-center">
                          <span className="text-[10px] font-mono text-indigo-200 bg-black/50 px-1.5 py-0.5 rounded">Color Chart</span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Realtime Sensor HUD indicators */}
                  <div className="absolute top-2 right-2 flex gap-1.5">
                    <Badge
                      variant="outline"
                      className={`text-[10px] backdrop-blur-md ${
                        qualityStats.lit ? "bg-emerald-950/80 text-emerald-300 border-emerald-500/50" : "bg-amber-950/80 text-amber-300 border-amber-500/50"
                      }`}
                    >
                      Lighting: {qualityStats.lit ? "Good" : "Adjust"}
                    </Badge>
                    <Badge
                      variant="outline"
                      className={`text-[10px] backdrop-blur-md ${
                        qualityStats.steady ? "bg-emerald-950/80 text-emerald-300 border-emerald-500/50" : "bg-amber-950/80 text-amber-300 border-amber-500/50"
                      }`}
                    >
                      Stability: {qualityStats.steady ? "Steady" : "Hold still"}
                    </Badge>
                  </div>
                </>
              )}
            </div>

            {/* Dynamic Guidance Banner */}
            <div className="rounded-lg border border-border bg-muted/60 p-3 flex items-start gap-2.5 text-xs text-foreground">
              <Lightbulb className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
              <div className="space-y-0.5">
                <p className="font-semibold text-primary">{hint}</p>
                <p className="text-[11px] text-muted-foreground">
                  {mode === "visual"
                    ? "Visual inspection checks visible peel discoloration, cuts, sap burn, and mold spots."
                    : "Ensure reaction pad is fully developed according to the manufacturer's incubation timer."}
                </p>
              </div>
            </div>

            {/* Controls Bar */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 text-xs font-medium cursor-pointer">
                  <Switch checked={auto} onCheckedChange={setAuto} />
                  <span>Auto-capture when ready</span>
                </label>
                <Button variant="ghost" size="sm" onClick={toggleFacing} className="text-xs h-8 gap-1.5 text-muted-foreground">
                  <RefreshCw className="h-3.5 w-3.5" /> Flip Camera
                </Button>
              </div>

              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={onClose} className="text-xs">
                  Cancel
                </Button>
                <Button disabled={!ready} onClick={capture} size="sm" className="gap-1.5 text-xs font-semibold">
                  <CheckCircle2 className="h-4 w-4 text-emerald-400" /> Capture Now
                </Button>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
