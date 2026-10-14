import { useEffect, useRef, useState } from "react";
import { Camera, Upload, ScanLine, FlaskConical, ShieldAlert, ArrowRight, RotateCcw, Loader2, Clock3, Download, Trash2, Leaf, ImagePlus, AlertTriangle, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { CameraCapture } from "./CameraCapture";
import { outcomeLabels, prepareScanImage, scanResultSchema, type ScanMode, type ScanRecord } from "@/lib/produceSafety";
import mangoes from "@/assets/produce-scan-mangoes.jpg";

export function ProduceSafety() {
  const { user } = useAuth();
  const [mode, setMode] = useState<ScanMode>("visual");
  const [image, setImage] = useState("");
  const [reference, setReference] = useState("");
  const [camera, setCamera] = useState(false);
  const [cameraTarget, setCameraTarget] = useState<"sample" | "reference">("sample");
  const [label, setLabel] = useState("");
  const [kit, setKit] = useState("");
  const [instructions, setInstructions] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [preparing, setPreparing] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<ScanRecord | null>(null);
  const [history, setHistory] = useState<ScanRecord[]>([]);
  const [storageError, setStorageError] = useState("");
  const file = useRef<HTMLInputElement>(null);
  const refFile = useRef<HTMLInputElement>(null);
  const controller = useRef<AbortController>();
  const key = user ? `agc-produce-scans:${user.id}` : null;
  useEffect(() => {
    setHistory([]);
    if (!key) return;
    try {
      const items: unknown = JSON.parse(localStorage.getItem(key) || "[]");
      if (Array.isArray(items)) setHistory(items.filter((item): item is ScanRecord => !!item && typeof item === "object" && ["visual", "strip"].includes(item.mode) && typeof item.id === "string" && typeof item.at === "string" && typeof item.label === "string" && scanResultSchema.safeParse(item.result).success).slice(0, 20));
    } catch { setStorageError("Saved scans could not be opened on this device."); }
  }, [key]);
  useEffect(() => () => controller.current?.abort(), []);
  function save(items: ScanRecord[]) {
    setHistory(items);
    if (key) try { localStorage.setItem(key, JSON.stringify(items)); } catch { setStorageError("Device storage is full. Download your result to keep a copy."); }
  }
  async function upload(event: React.ChangeEvent<HTMLInputElement>, target: "sample" | "reference") {
    const selected = event.target.files?.[0]; event.target.value = "";
    if (!selected) return;
    setPreparing(true); setError(""); setResult(null);
    try { const photo = await prepareScanImage(selected); if (target === "reference") setReference(photo); else setImage(photo); }
    catch (err) { setError(err instanceof Error ? err.message : "Unable to open photo."); }
    finally { setPreparing(false); }
  }
  function changeMode(next: string) {
    controller.current?.abort(); setBusy(false); setMode(next as ScanMode); setImage(""); setReference(""); setResult(null); setError(""); setConfirmed(false);
  }
  async function analyse() {
    setError(""); setResult(null);
    if (!image) { setError("Capture or upload a photo first."); return; }
    if (mode === "strip" && (!reference || !kit.trim() || !instructions.trim() || !confirmed)) { setError("Add the kit name, reference photo and reading instructions, then confirm the test was prepared correctly."); return; }
    if (!navigator.onLine) { setError("You are offline. Keep this photo and reconnect before analysing."); return; }
    setBusy(true);
    const abort = new AbortController(); controller.current = abort;
    try {
      const { data, error: invokeError } = await supabase.functions.invoke("produce-safety", {
        body: { mode, image, reference: mode === "strip" ? reference : null, label: label.trim(), kit: kit.trim(), instructions: instructions.trim(), confirmed },
        signal: abort.signal,
      });
      if (abort.signal.aborted) return;
      if (invokeError) {
        let message = "The scan could not be completed. Your photos are still here.";
        if (invokeError.context instanceof Response) {
          const details = await invokeError.context.json().catch(() => null);
          if (typeof details?.error === "string") message = details.error;
        }
        throw new Error(message);
      }
      if (data?.error) throw new Error(data.error);
      const parsed = scanResultSchema.safeParse(data?.result);
      if (!parsed.success) throw new Error("The scan returned an unreadable result. No assessment has been saved.");
      const record: ScanRecord = { id: crypto.randomUUID(), mode, at: new Date().toISOString(), label: label.trim() || parsed.data.produce || (mode === "strip" ? kit : "Produce"), result: parsed.data };
      setResult(record); save([record, ...history].slice(0, 20));
    } catch (err) { if (!abort.signal.aborted) setError(err instanceof Error ? err.message : "Analysis unavailable. Try again later."); }
    finally { if (!abort.signal.aborted) setBusy(false); }
  }
  function download(record: ScanRecord) {
    const content = `AgroClimate | Produce & Safety\n${record.label}\n${new Date(record.at).toLocaleString()}\n${record.mode === "visual" ? "Visual Scan" : "Test-Strip Reader"}\n\n${outcomeLabels[record.result.outcome]}\nObservation confidence: ${record.result.confidence}\n${record.result.summary}\n\nObservations\n${record.result.observations.join("\n")}\n${record.result.referenceReading || ""}\n\nNext steps\n${record.result.actions.join("\n")}\n\nScreening only. Not a food-safety certificate. Photos cannot rule out chemical, microbial or internal contamination. Strip comparisons are not calibrated measurements or laboratory confirmation.`;
    const url = URL.createObjectURL(new Blob([content], { type: "text/plain" }));
    const link = document.createElement("a"); link.href = url; link.download = `AgroClimate-scan-${record.id.slice(0, 8)}.txt`; link.click(); URL.revokeObjectURL(url);
  }
  return <div className="space-y-6 text-foreground">
    <header className="flex flex-wrap items-start justify-between gap-3">
      <div><div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase text-primary"><Leaf className="h-4 w-4" />AgroClimate <span className="text-muted-foreground">/</span> Produce intelligence</div>
        <h1 className="text-2xl font-bold sm:text-3xl">Produce &amp; Safety</h1>
        <p className="mt-2 text-sm text-muted-foreground">A closer look. A better-informed decision.</p>
      </div><Badge variant="outline" className="gap-1.5 rounded-md py-1.5"><ShieldAlert className="h-3.5 w-3.5" />Screening, not certification</Badge>
    </header>
    <Tabs value={mode} onValueChange={changeMode} className="space-y-5">
      <TabsList className="grid h-auto w-full grid-cols-2 rounded-lg bg-muted p-1 sm:max-w-md">
        <TabsTrigger value="visual" disabled={busy || preparing} className="gap-2 rounded-md px-2 py-3"><ScanLine className="h-4 w-4 shrink-0" /><span>Visual Scan <span className="hidden sm:inline text-muted-foreground">· Level 1</span></span></TabsTrigger>
        <TabsTrigger value="strip" disabled={busy || preparing} className="gap-2 rounded-md px-2 py-3"><FlaskConical className="h-4 w-4 shrink-0" /><span>Test-Strip Reader <span className="hidden sm:inline text-muted-foreground">· Level 2</span></span></TabsTrigger>
      </TabsList>
      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
        <section className="min-w-0 space-y-4" aria-label="Scan workspace">
          <div className="relative aspect-[4/3] overflow-hidden rounded-lg border border-border bg-muted">
            <img src={image || mangoes} alt={image ? "Your photo for screening" : "Mangoes illustrating produce capture, not a scan result"} width={1024} height={768} className={`h-full w-full object-contain ${image ? "" : "opacity-80"}`} />
            {!image && <><Badge className="absolute left-4 top-4 rounded-md bg-card text-card-foreground">{mode === "visual" ? "Ready for your produce" : "Ready for your test strip"}</Badge><div className="pointer-events-none absolute inset-[15%] rounded-lg border-2 border-primary/70" /><span className="absolute bottom-4 right-4 rounded bg-card/95 px-2 py-1 text-xs text-muted-foreground">Illustration · not analysed</span></>}
            {image && <Button variant="secondary" size="icon" aria-label="Remove photo" className="absolute right-3 top-3" disabled={busy} onClick={() => { setImage(""); setResult(null); }}><X className="h-4 w-4" /></Button>}
          </div>
          <div className="grid grid-cols-2 gap-3"><Button disabled={busy || preparing} className="gap-2" onClick={() => { setCameraTarget("sample"); setCamera(true); }}><Camera className="h-4 w-4" />{image ? "Retake photo" : "Open camera"}</Button><Button variant="outline" disabled={busy || preparing} className="gap-2" onClick={() => file.current?.click()}><Upload className="h-4 w-4" />Upload photo</Button></div>
          <input ref={file} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" aria-label="Upload sample photo" onChange={event => void upload(event, "sample")} />
          <p className="text-xs text-muted-foreground">{preparing ? "Preparing photo…" : mode === "visual" ? "Natural light · whole product in frame · capture another side if needed" : "Include the test area and control. Photograph within the kit’s reading window."}</p>
        </section>
        <section className="min-w-0 space-y-5">
          <TabsContent value="visual" className="mt-0 space-y-3"><div className="flex items-center gap-2 text-primary"><ScanLine className="h-5 w-5" /><span className="text-xs font-semibold uppercase">Level 1 · Visual screening</span></div><h2 className="text-xl font-semibold">What can you see?</h2><p className="text-sm leading-relaxed text-muted-foreground">Check visible mould, bruising, damage and ripeness. Hidden contamination cannot be ruled out.</p></TabsContent>
          <TabsContent value="strip" className="mt-0 space-y-3"><div className="flex items-center gap-2 text-primary"><FlaskConical className="h-5 w-5" /><span className="text-xs font-semibold uppercase">Level 2 · Kit reference comparison</span></div><h2 className="text-xl font-semibold">Read the test. Not just the colour.</h2><p className="text-sm leading-relaxed text-muted-foreground">Compare a prepared test with its own manufacturer’s reference. Different kits detect different substances.</p></TabsContent>
          <div className="space-y-2"><Label htmlFor="produce-label">Produce or batch <span className="text-muted-foreground font-normal">(optional)</span></Label><Input id="produce-label" value={label} maxLength={120} disabled={busy} onChange={event => { setLabel(event.target.value); setResult(null); }} placeholder="e.g. Mango · Market lot 24" /></div>
          {mode === "strip" && <div className="space-y-4">
            <div className="space-y-2"><Label htmlFor="kit-name">Test kit name / model</Label><Input id="kit-name" value={kit} maxLength={160} disabled={busy} onChange={event => { setKit(event.target.value); setResult(null); }} placeholder="Name printed on the packaging" /></div>
            <div className="space-y-2"><Label>Manufacturer’s colour chart &amp; instructions</Label><div className="flex flex-wrap items-center gap-2"><Button size="sm" variant="outline" disabled={busy || preparing} onClick={() => refFile.current?.click()}><ImagePlus className="mr-2 h-4 w-4" />{reference ? "Replace reference" : "Upload reference"}</Button><Button size="sm" variant="ghost" disabled={busy} onClick={() => { setCameraTarget("reference"); setCamera(true); }}><Camera className="mr-2 h-4 w-4" />Photograph</Button>{reference && <img src={reference} alt="Manufacturer reference chart" className="h-14 w-20 rounded border object-contain" />}</div><input ref={refFile} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" aria-label="Upload kit reference" onChange={event => void upload(event, "reference")} /></div>
            <div className="space-y-2"><Label htmlFor="kit-instructions">Kit reading instructions &amp; test timing</Label><Textarea id="kit-instructions" value={instructions} maxLength={2000} disabled={busy} onChange={event => { setInstructions(event.target.value); setResult(null); }} placeholder="Target substance, control appearance, reading time, and when you took this photo. Copy from your kit." className="min-h-24" /></div>
            <label className="flex items-start gap-3 text-xs leading-relaxed text-muted-foreground"><Checkbox checked={confirmed} disabled={busy} onCheckedChange={value => { setConfirmed(value === true); setResult(null); }} className="mt-0.5" />I followed this kit’s preparation instructions, checked its expiry and photographed it within the stated reading time.</label>
          </div>}
          <div className="flex items-start gap-3 border-l-2 border-warning bg-warning/10 px-4 py-3"><ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-foreground" /><p className="text-xs leading-relaxed">{mode === "visual" ? "A fresh appearance does not mean safe to eat. Photos cannot detect pesticide residues, bacteria or chemical ripening." : "Photo comparison is not a calibrated chemical measurement. An unclear control, expired kit or missing reference makes the result inconclusive."}</p></div>
          {error && <p role="alert" className="flex items-start gap-2 text-sm text-destructive"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />{error}</p>}
          <Button className="w-full gap-2" disabled={!image || busy || preparing || (mode === "strip" && (!reference || !kit.trim() || !instructions.trim() || !confirmed))} onClick={() => void analyse()}>{busy ? <><Loader2 className="h-4 w-4 animate-spin" />Examining your photos…</> : <>{mode === "visual" ? "Analyse produce" : "Compare test strip"}<ArrowRight className="h-4 w-4" /></>}</Button>
          {busy && <Button variant="ghost" className="w-full" onClick={() => { controller.current?.abort(); setBusy(false); }}><X className="mr-2 h-4 w-4" />Stop analysis</Button>}
          <p className="text-xs text-muted-foreground">Photos are sent for analysis, not saved to your scan history. Results stay on this device.</p>
        </section>
      </div>
    </Tabs>
    {result && <section aria-label="Scan result" aria-live="polite" className="space-y-4 border-y border-border py-6">
      <div className="flex flex-wrap items-start justify-between gap-3"><div><Badge variant="outline" className="mb-2">{result.mode === "visual" ? "Visual observation" : "Uncalibrated reference comparison"}</Badge><h2 className="text-xl font-semibold">{outcomeLabels[result.result.outcome]}</h2><p className="mt-1 text-xs text-muted-foreground">{result.label} · {new Date(result.at).toLocaleString()} · Observation confidence: {result.result.confidence}</p></div><Button variant="outline" size="sm" onClick={() => download(result)}><Download className="mr-2 h-4 w-4" />Download</Button></div>
      <p className="text-sm leading-relaxed">{result.result.summary}</p>
      <div className="grid gap-5 sm:grid-cols-2"><div><h3 className="mb-2 text-sm font-semibold">Visible findings</h3><ul className="list-disc space-y-2 pl-4 text-sm text-muted-foreground">{result.result.observations.map((item, i) => <li key={i}>{item}</li>)}</ul></div><div><h3 className="mb-2 text-sm font-semibold">Recommended next steps</h3><ul className="list-disc space-y-2 pl-4 text-sm text-muted-foreground">{result.result.actions.map((item, i) => <li key={i}>{item}</li>)}</ul></div></div>
      {result.result.referenceReading && <p className="text-sm">{result.result.referenceReading}</p>}
      <p className="text-xs font-medium text-muted-foreground">Not a food-safety certificate. Laboratory testing is needed to confirm contamination or compliance.</p>
      <Button variant="ghost" size="sm" onClick={() => { setImage(""); setResult(null); setConfirmed(false); }}><RotateCcw className="mr-2 h-4 w-4" />Start another scan</Button>
    </section>}
    <section className="border-t border-border pt-5" aria-label="Recent scans"><div className="mb-4 flex flex-wrap items-center justify-between gap-2"><h2 className="flex items-center gap-2 text-base font-semibold"><Clock3 className="h-4 w-4 text-primary" />Recent scans <span className="text-xs font-normal text-muted-foreground">On this device</span></h2>{history.length > 0 && <Button variant="ghost" size="sm" disabled={busy} onClick={() => { save([]); setResult(null); }}><Trash2 className="mr-2 h-3.5 w-3.5" />Clear history</Button>}</div>
      {storageError && <p role="alert" className="mb-3 text-xs text-destructive">{storageError}</p>}
      {history.length === 0 ? <p className="py-4 text-sm text-muted-foreground">No scans yet.</p> : <div className="divide-y divide-border">{history.map(record => <div key={record.id} className="flex flex-wrap items-center justify-between gap-3 py-3"><div className="min-w-0"><p className="break-words text-sm font-medium">{record.label}</p><p className="mt-1 text-xs text-muted-foreground">{record.mode === "visual" ? "Visual" : "Test strip"} · {new Date(record.at).toLocaleString()}</p><p className="mt-1 text-xs">{outcomeLabels[record.result.outcome]}</p></div><div className="flex gap-1"><Button variant="ghost" size="sm" onClick={() => { setResult(record); document.querySelector('[aria-label="Scan result"]')?.scrollIntoView({ behavior: "smooth", block: "center" }); }}>View result</Button><Button variant="ghost" size="icon" aria-label={`Download ${record.label}`} onClick={() => download(record)}><Download className="h-4 w-4" /></Button></div></div>)}</div>}
    </section>
    <CameraCapture open={camera} onClose={() => setCamera(false)} onCapture={photo => { if (cameraTarget === "reference") setReference(photo); else setImage(photo); setResult(null); setError(""); }} />
  </div>;
}
