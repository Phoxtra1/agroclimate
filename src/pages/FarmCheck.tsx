import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Camera, Loader2, QrCode, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { farmCodeFromInput } from "@/lib/farmCheck";
import { z } from "zod";

const farmSchema = z.object({ farm_name: z.string(), farm_location: z.string().nullable(), scans: z.array(z.object({
  produce: z.string(), outcome: z.string(), confidence: z.string(), summary: z.string().nullable(),
  place_label: z.string().nullable(), scanned_at: z.string(),
})) });
export default function FarmCheck() {
  const [params] = useSearchParams();
  const [code, setCode] = useState(params.get("code") || "");
  const [farm, setFarm] = useState<z.infer<typeof farmSchema> | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [camera, setCamera] = useState(false);
  const video = useRef<HTMLVideoElement>(null);
  async function lookup(value: string) {
    const token = farmCodeFromInput(value);
    if (!token) { setError("Enter a farm QR code or farm-check link."); return; }
    setBusy(true); setError(""); setFarm(null);
    const { data, error: failure } = await supabase.rpc("get_farm_scan_record", { p_code: token });
    const parsed = farmSchema.safeParse(data);
    if (failure) setError("Farm records are unavailable. Please try again.");
    else if (!parsed.success) setError("No farm matches this QR code.");
    else setFarm(parsed.data);
    setBusy(false);
  }
  useEffect(() => { if (params.get("code")) void lookup(params.get("code") || ""); }, []);
  useEffect(() => {
    if (!camera) return;
    let stopped = false;
    let stream: MediaStream | undefined;
    let timer: ReturnType<typeof setTimeout>;
    const start = async () => {
      try {
        const { BrowserQRCodeReader } = await import("@zxing/browser");
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" }, audio: false });
        if (stopped) { stream.getTracks().forEach(t => t.stop()); return; }
        const element = video.current;
        if (!element) return;
        element.srcObject = stream; await element.play();
        const reader = new BrowserQRCodeReader();
        const scan = async () => {
          if (stopped) return;
          const canvas = document.createElement("canvas"); canvas.width = element.videoWidth; canvas.height = element.videoHeight;
          canvas.getContext("2d")?.drawImage(element, 0, 0);
          try {
            const result = reader.decodeFromCanvas(canvas);
            setCode(result.getText()); setCamera(false); void lookup(result.getText()); return;
          } catch { timer = setTimeout(scan, 300); }
        };
        void scan();
      } catch { setError("Camera unavailable. Paste the farm QR code or link instead."); setCamera(false); }
    };
    void start();
    return () => { stopped = true; clearTimeout(timer); stream?.getTracks().forEach(t => t.stop()); };
  }, [camera]);
  return <main className="min-h-screen bg-background text-foreground p-5">
    <div className="mx-auto max-w-2xl space-y-6">
      <Link to="/" className="text-primary font-semibold">AgroClimate</Link>
      <h1 className="text-2xl font-bold flex items-center gap-2"><QrCode /> Farm QR check</h1>
      <form className="flex flex-wrap gap-2" onSubmit={e => { e.preventDefault(); void lookup(code); }}>
        <Input aria-label="Farm QR code or link" value={code} onChange={e => setCode(e.target.value)} className="flex-1 min-w-0" placeholder="Farm QR code or link" />
        <Button disabled={busy}>{busy ? <Loader2 className="animate-spin" /> : "Check farm"}</Button>
        <Button type="button" variant="outline" onClick={() => setCamera(v => !v)}><Camera className="mr-2 h-4 w-4" />{camera ? "Close camera" : "Scan QR"}</Button>
      </form>
      {camera && <video ref={video} autoPlay muted playsInline className="w-full aspect-square object-cover rounded-lg" />}
      {error && <p role="alert" className="text-destructive">{error}</p>}
      <div className="border-y py-4 text-sm text-muted-foreground flex gap-2"><ShieldAlert className="shrink-0 h-5 w-5" />Visual screening is not a food-safety certificate and cannot rule out pesticides or invisible contamination.</div>
      {farm && <section className="space-y-4"><h2 className="text-xl font-semibold">{farm.farm_name}</h2><p className="text-muted-foreground">{farm.farm_location || "Farm location not supplied"}</p>
        {!farm.scans.length && <p>No linked scans recorded yet.</p>}
        {farm.scans.map((scan, i) => <article key={`${scan.scanned_at}-${i}`} className="border-b py-4 space-y-2"><h3 className="font-semibold">{scan.produce}</h3><p className="text-sm">{scan.outcome.replace(/_/g, " ")} · {scan.confidence} confidence</p><p className="text-sm">{scan.summary}</p><p className="text-xs text-muted-foreground">{new Date(scan.scanned_at).toLocaleString()} · {scan.place_label || "Scan location unavailable"}</p></article>)}
      </section>}
    </div>
  </main>;
}