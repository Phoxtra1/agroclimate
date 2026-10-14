import { useEffect, useRef, useState } from "react";
import {
  Camera, Upload, ScanLine, FlaskConical, ShieldAlert, ArrowRight, RotateCcw,
  Loader2, Clock3, Download, Trash2, Leaf, ImagePlus, AlertTriangle, X,
  CheckCircle2, AlertCircle, Info, Settings, Beaker, FileSpreadsheet, Plus,
  Timer, ExternalLink, HelpCircle, Eye, ChevronRight
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { CameraCapture } from "./CameraCapture";
import {
  prepareScanImage, scanResultSchema, analyzeCardImageColor,
  DEFAULT_TEST_CONFIGS, SUPPORTED_PRODUCE_TYPES, compatibilityStateBadges,
  primaryOutcomeLabels, primaryOutcomeDescriptions,
  type ScanMode, type ScanRecord, type ScanResult, type PrimaryOutcome,
  type TestCardConfig, type CompatibilityState, type EvaluationRecord, type SupportedProduceId
} from "@/lib/produceSafety";
import mangoes from "@/assets/produce-scan-mangoes.jpg";

export function ProduceSafety() {
  const { user } = useAuth();
  const [mode, setMode] = useState<ScanMode>("visual");
  const [produceType, setProduceType] = useState<SupportedProduceId>("mango");
  const [image, setImage] = useState("");
  const [reference, setReference] = useState("");
  const [camera, setCamera] = useState(false);
  const [cameraTarget, setCameraTarget] = useState<"sample" | "reference" | "unfamiliar">("sample");
  const [label, setLabel] = useState("");

  // Level 2 Test Configuration state
  const [testConfigs, setTestConfigs] = useState<TestCardConfig[]>(DEFAULT_TEST_CONFIGS);
  const [selectedConfigId, setSelectedConfigId] = useState<string>(DEFAULT_TEST_CONFIGS[0].id);
  const selectedConfig = testConfigs.find((c) => c.id === selectedConfigId) || testConfigs[0];

  // Unfamiliar card capture
  const [unfamiliarCardImage, setUnfamiliarCardImage] = useState("");
  const [unfamiliarCardNotes, setUnfamiliarCardNotes] = useState("");

  // Custom Test Config Creator Modal
  const [adminDialogOpen, setAdminDialogOpen] = useState(false);
  const [newConfig, setNewConfig] = useState<Partial<TestCardConfig>>({
    name: "",
    manufacturer: "",
    targetSubstance: "",
    substanceClass: "",
    supportedProduce: ["Mangoes", "Bananas"],
    samplePrepInstructions: ["Extract sample", "Apply 2 drops", "Wait for incubation"],
    requiredReactionTimeSeconds: 60,
    cardLayoutDescription: "",
    interpretationRules: "",
    detectionLimits: "",
    knownLimitations: [],
    validationStatus: "experimental",
    compatibilityState: "NOT_YET_VALIDATED",
  });

  // Reaction Timer
  const [timerSecondsLeft, setTimerSecondsLeft] = useState<number | null>(null);
  const [isTimerRunning, setIsTimerRunning] = useState(false);

  // General form controls
  const [instructions, setInstructions] = useState(selectedConfig.samplePrepInstructions.join("\n"));
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [preparing, setPreparing] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<ScanRecord | null>(null);
  const [history, setHistory] = useState<ScanRecord[]>([]);
  const [storageError, setStorageError] = useState("");

  // Developer Testing & Calibration Studio State
  const [evaluations, setEvaluations] = useState<EvaluationRecord[]>([]);
  const [evalExpectedResult, setEvalExpectedResult] = useState("");
  const [evalNotes, setEvalNotes] = useState("");

  const fileRef = useRef<HTMLInputElement>(null);
  const refFileRef = useRef<HTMLInputElement>(null);
  const unfamiliarFileRef = useRef<HTMLInputElement>(null);
  const controller = useRef<AbortController>();

  const storageKey = user ? `agc-produce-scans:${user.id}` : "agc-produce-scans:guest";
  const evalStorageKey = user ? `agc-evaluations:${user.id}` : "agc-evaluations:guest";

  // Load history & evaluation records
  useEffect(() => {
    try {
      const savedHistory = JSON.parse(localStorage.getItem(storageKey) || "[]");
      if (Array.isArray(savedHistory)) {
        setHistory(savedHistory.filter((item) => item && typeof item === "object" && typeof item.id === "string"));
      }
      const savedEvals = JSON.parse(localStorage.getItem(evalStorageKey) || "[]");
      if (Array.isArray(savedEvals)) {
        setEvaluations(savedEvals);
      }
    } catch {
      setStorageError("Saved scan history could not be loaded on this device.");
    }
  }, [storageKey, evalStorageKey]);

  // Sync test config instructions when selection changes
  useEffect(() => {
    if (selectedConfig) {
      setInstructions(selectedConfig.samplePrepInstructions.join("\n"));
      setConfirmed(false);
      setTimerSecondsLeft(null);
      setIsTimerRunning(false);
    }
  }, [selectedConfigId]);

  // Reaction countdown timer
  useEffect(() => {
    if (!isTimerRunning || timerSecondsLeft === null) return;
    if (timerSecondsLeft <= 0) {
      setIsTimerRunning(false);
      return;
    }
    const interval = setInterval(() => {
      setTimerSecondsLeft((prev) => (prev !== null && prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(interval);
  }, [isTimerRunning, timerSecondsLeft]);

  useEffect(() => () => controller.current?.abort(), []);

  function saveScans(items: ScanRecord[]) {
    setHistory(items);
    try {
      localStorage.setItem(storageKey, JSON.stringify(items));
    } catch {
      setStorageError("Device storage full. Export results to keep history.");
    }
  }

  function saveEvaluations(items: EvaluationRecord[]) {
    setEvaluations(items);
    try {
      localStorage.setItem(evalStorageKey, JSON.stringify(items));
    } catch {
      /* ignore */
    }
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>, target: "sample" | "reference" | "unfamiliar") {
    const selected = e.target.files?.[0];
    e.target.value = "";
    if (!selected) return;
    setPreparing(true);
    setError("");
    setResult(null);
    try {
      const photo = await prepareScanImage(selected);
      if (target === "reference") setReference(photo);
      else if (target === "unfamiliar") setUnfamiliarCardImage(photo);
      else setImage(photo);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to process uploaded photo.");
    } finally {
      setPreparing(false);
    }
  }

  function changeMode(next: string) {
    controller.current?.abort();
    setBusy(false);
    setMode(next as ScanMode);
    setImage("");
    setReference("");
    setUnfamiliarCardImage("");
    setResult(null);
    setError("");
    setConfirmed(false);
  }

  // Client-side Color extraction & DeltaE matching for Level 2 chemical cards
  async function performClientColorAnalysis(
    imageDataUrl: string,
    config: TestCardConfig
  ): Promise<{
    matchedLabel: string;
    valueString: string;
    deltaE: number;
    category: string;
    quality: string;
    qualityMsg: string;
  }> {
    return new Promise((resolve) => {
      const img = new Image();
      img.src = imageDataUrl;
      img.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = img.naturalWidth || 800;
        canvas.height = img.naturalHeight || 600;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          resolve({
            matchedLabel: "Unknown",
            valueString: "Analysis error",
            deltaE: 999,
            category: "inconclusive",
            quality: "invalid_card",
            qualityMsg: "Canvas non-responsive.",
          });
          return;
        }
        ctx.drawImage(img, 0, 0);
        const analysis = analyzeCardImageColor(ctx, canvas.width, canvas.height, config);
        resolve({
          matchedLabel: analysis.matchedSwatch?.label || "Unmapped Swatch",
          valueString: analysis.matchedSwatch?.valueString || "Inconclusive concentration",
          deltaE: analysis.deltaE,
          category: analysis.matchedSwatch?.category || "inconclusive",
          quality: analysis.quality,
          qualityMsg: analysis.qualityMessage,
        });
      };
      img.onerror = () => {
        resolve({
          matchedLabel: "Error",
          valueString: "Failed to render card",
          deltaE: 999,
          category: "inconclusive",
          quality: "invalid_card",
          qualityMsg: "Unreadable card image.",
        });
      };
    });
  }

  async function executeAnalysis() {
    setError("");
    setResult(null);

    if (mode === "strip" && selectedConfig.compatibilityState === "UNSUPPORTED") {
      setError("This chemical test card format is UNSUPPORTED for automated reading. You can photograph it for documentation purposes below.");
      return;
    }

    if (!image) {
      setError("Capture or upload a photo first.");
      return;
    }

    if (mode === "strip" && !confirmed) {
      setError("Please confirm that sample preparation was performed according to the manufacturer instructions.");
      return;
    }

    if (!navigator.onLine) {
      setError("Device is offline. Keep this photo and reconnect before sending for AI visual screening.");
      return;
    }

    setBusy(true);
    const abort = new AbortController();
    controller.current = abort;

    try {
      let clientColorData: { matchedLabel: string; valueString: string; deltaE: number; category: string; quality: string; qualityMsg: string } | null = null;

      if (mode === "strip" && selectedConfig.compatibilityState === "SUPPORTED") {
        clientColorData = await performClientColorAnalysis(image, selectedConfig);
      }

      // Invoke Supabase produce-safety edge function
      const { data, error: invokeError } = await supabase.functions.invoke("produce-safety", {
        body: {
          mode,
          image,
          reference: mode === "strip" ? reference : null,
          label: label.trim() || `${SUPPORTED_PRODUCE_TYPES.find((p) => p.id === produceType)?.label || "Produce"} Sample`,
          kit: mode === "strip" ? selectedConfig.name : produceType,
          instructions: mode === "strip" ? instructions : "",
          confirmed,
        },
        signal: abort.signal,
      });

      if (abort.signal.aborted) return;

      if (invokeError) {
        let msg = "Photo analysis server did not respond. Your photo remains captured.";
        if (invokeError.context instanceof Response) {
          const details = await invokeError.context.json().catch(() => null);
          if (typeof details?.error === "string") msg = details.error;
        }
        throw new Error(msg);
      }

      if (data?.error) throw new Error(data.error);

      // Map backend outcome to standard primary outcomes
      let mappedOutcome: PrimaryOutcome = "inconclusive";
      const rawOutcome = data?.result?.outcome;

      if (rawOutcome === "looks_fresh" || rawOutcome === "no_visible_concern") {
        mappedOutcome = "looks_fresh";
      } else if (rawOutcome === "caution" || rawOutcome === "concern") {
        mappedOutcome = "caution";
      } else if (rawOutcome === "do_not_eat") {
        mappedOutcome = "do_not_eat";
      } else if (rawOutcome === "reference_match") {
        mappedOutcome = clientColorData?.category === "safe" ? "looks_fresh" : clientColorData?.category === "caution" ? "caution" : clientColorData?.category === "danger" ? "do_not_eat" : "inconclusive";
      }

      const produceName = SUPPORTED_PRODUCE_TYPES.find((p) => p.id === produceType)?.label || "Produce";

      const finalResult: ScanResult = {
        outcome: mappedOutcome,
        confidence: data?.result?.confidence || "moderate",
        produce: data?.result?.produce || produceName,
        summary: data?.result?.summary || primaryOutcomeDescriptions[mappedOutcome],
        observations: data?.result?.observations || ["Visible surface inspection completed."],
        actions: data?.result?.actions || ["Store in cool, dry conditions."],
        referenceReading: data?.result?.referenceReading || (clientColorData ? `Color match: ${clientColorData.matchedLabel} (${clientColorData.valueString}, ΔE = ${clientColorData.deltaE})` : null),
        ripenessStage: mode === "visual" ? "Maturity assessed visually from skin tone." : undefined,
        visibleDefects: mode === "visual" ? ["Surface discoloration / blemishes checked"] : undefined,
        distinctions: {
          visibleEvidence: [
            `Surface camera color and skin geometry checked for ${produceName}.`,
            mode === "strip" ? `Test strip reaction pad analyzed against ${selectedConfig.name} reference scale.` : "Visible peel integrity and mold growth evaluated."
          ],
          inferredConclusions: [
            "Visual skin state does not indicate or rule out chemical pesticide residues.",
            "Laboratory confirmation required for food compliance certificates."
          ]
        },
        testCardId: mode === "strip" ? selectedConfig.id : undefined,
        testCardName: mode === "strip" ? selectedConfig.name : undefined,
        compatibilityState: mode === "strip" ? selectedConfig.compatibilityState : undefined,
        detectedSubstance: mode === "strip" ? selectedConfig.targetSubstance : undefined,
        interpretedValue: clientColorData?.valueString || undefined,
        deltaE: clientColorData?.deltaE,
        readingQuality: clientColorData?.qualityMsg || "Image clear",
        chemicalDisclaimer: "NOTICE: Visual appearance and chemical card rapid screening do NOT establish absence of invisible pesticides, heavy metals, or bacterial pathogens."
      };

      const record: ScanRecord = {
        id: crypto.randomUUID(),
        mode,
        at: new Date().toISOString(),
        label: label.trim() || `${produceName} - ${primaryOutcomeLabels[mappedOutcome]}`,
        produceType,
        result: finalResult,
        imageSnippet: image.slice(0, 500) + "...",
      };

      setResult(record);
      saveScans([record, ...history].slice(0, 30));
    } catch (err) {
      if (!abort.signal.aborted) {
        setError(err instanceof Error ? err.message : "Analysis service unavailable. Try again shortly.");
      }
    } finally {
      if (!abort.signal.aborted) setBusy(false);
    }
  }

  // Developer calibration studio: Record evaluation
  function recordDeveloperEvaluation() {
    if (!result || !evalExpectedResult.trim()) return;
    const newEval: EvaluationRecord = {
      id: crypto.randomUUID(),
      testConfigId: selectedConfig.id,
      testConfigName: selectedConfig.name,
      timestamp: new Date().toISOString(),
      expectedResult: evalExpectedResult.trim(),
      actualResult: `${primaryOutcomeLabels[result.result.outcome as PrimaryOutcome] || result.result.outcome} (${result.result.interpretedValue || "Visual"})`,
      deltaE: result.result.deltaE || 0,
      match: evalExpectedResult.trim().toLowerCase() === (result.result.interpretedValue || "").toLowerCase(),
      notes: evalNotes.trim(),
      validationStatus: selectedConfig.validationStatus,
      imageDataUrl: image ? image.slice(0, 200) + "..." : undefined,
    };
    saveEvaluations([newEval, ...evaluations]);
    setEvalExpectedResult("");
    setEvalNotes("");
  }

  function exportEvaluationsJson() {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(evaluations, null, 2));
    const downloadAnchor = document.createElement("a");
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `agroclimate-card-evaluations-${new Date().toISOString().slice(0, 10)}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  }

  function downloadScanRecord(record: ScanRecord) {
    const content = `AGROCLIMATE PRODUCE INTELLIGENCE & SAFETY REPORT
==================================================
Record ID: ${record.id}
Date: ${new Date(record.at).toLocaleString()}
Inspection Mode: ${record.mode === "visual" ? "Level 1 Visual Produce Scan" : "Level 2 Chemical Test-Card Reader"}
Target Produce / Batch: ${record.label}
Produce Type: ${record.produceType || "General"}

PRIMARY CATEGORY RESULT: ${primaryOutcomeLabels[record.result.outcome as PrimaryOutcome] || record.result.outcome}
Confidence Calibration: ${record.result.confidence.toUpperCase()}

SUMMARY OF FINDINGS:
${record.result.summary}

VISIBLE EVIDENCE OBSERVED:
${record.result.observations.map((o) => `• ${o}`).join("\n")}

INFERRED CONCLUSIONS vs VISIBLE EVIDENCE:
Evidence:
${record.result.distinctions?.visibleEvidence.map((e) => ` - ${e}`).join("\n") || "N/A"}
Inferred:
${record.result.distinctions?.inferredConclusions.map((i) => ` - ${i}`).join("\n") || "N/A"}

${record.mode === "strip" ? `TEST CARD DETAILS:
Test Product: ${record.result.testCardName || "N/A"}
Target Substance: ${record.result.detectedSubstance || "N/A"}
Compatibility State: ${record.result.compatibilityState || "N/A"}
Interpreted Value: ${record.result.interpretedValue || "N/A"}
DeltaE Match Deviation: ${record.result.deltaE !== undefined ? record.result.deltaE : "N/A"}
` : ""}

RECOMMENDED NEXT STEPS:
${record.result.actions.map((a) => `• ${a}`).join("\n")}

IMPORTANT REGULATORY DISCLAIMER:
This rapid screening inspection is provided for produce quality sorting and preliminary awareness only. Visual inspection and chemical test-card reading DO NOT replace official laboratory testing (LC-MS/MS or GC-MS). Never label produce as "pesticide-free" or "certified organic" based solely on visual or test strip screening.
`;

    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `Produce-Scan-${record.id.slice(0, 8)}.txt`;
    link.click();
    URL.revokeObjectURL(url);
  }

  const renderBadgeForOutcome = (outcome: string) => {
    switch (outcome) {
      case "looks_fresh":
        return <Badge className="bg-emerald-600 text-white gap-1"><CheckCircle2 className="h-3.5 w-3.5" /> Looks Fresh</Badge>;
      case "caution":
        return <Badge className="bg-amber-600 text-white gap-1"><AlertCircle className="h-3.5 w-3.5" /> Caution</Badge>;
      case "do_not_eat":
        return <Badge className="bg-rose-600 text-white gap-1"><ShieldAlert className="h-3.5 w-3.5" /> Do Not Eat</Badge>;
      default:
        return <Badge variant="outline" className="gap-1"><HelpCircle className="h-3.5 w-3.5" /> Inconclusive</Badge>;
    }
  };

  return (
    <div className="space-y-6 text-foreground max-w-6xl mx-auto pb-12">
      {/* Header */}
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-border pb-4">
        <div>
          <div className="mb-1 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-primary">
            <Leaf className="h-4 w-4" /> AgroClimate Intelligence <span className="text-muted-foreground">/</span> Produce Safety &amp; Quality
          </div>
          <h1 className="text-2xl font-bold sm:text-3xl tracking-tight">Produce &amp; Chemical Safety Scanner</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Level 1 Visual Produce Inspection &amp; Level 2 Chemical Test-Card Reader.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setAdminDialogOpen(true)} className="gap-1.5 text-xs">
            <Settings className="h-3.5 w-3.5" /> Calibration &amp; Test Admin
          </Button>
          <Badge variant="outline" className="gap-1.5 py-1.5 text-xs font-medium">
            <ShieldAlert className="h-3.5 w-3.5 text-amber-500" /> Screening, Not Lab Certification
          </Badge>
        </div>
      </header>

      {/* Primary Mode Tabs */}
      <Tabs value={mode} onValueChange={changeMode} className="space-y-6">
        <TabsList className="grid h-auto w-full grid-cols-2 rounded-xl bg-muted p-1 sm:max-w-md">
          <TabsTrigger value="visual" disabled={busy || preparing} className="gap-2 rounded-lg py-2.5 font-medium">
            <ScanLine className="h-4 w-4 shrink-0" />
            <span>Visual Produce <span className="text-xs text-muted-foreground">· Level 1</span></span>
          </TabsTrigger>
          <TabsTrigger value="strip" disabled={busy || preparing} className="gap-2 rounded-lg py-2.5 font-medium">
            <FlaskConical className="h-4 w-4 shrink-0" />
            <span>Chemical Test Card <span className="text-xs text-muted-foreground">· Level 2</span></span>
          </TabsTrigger>
        </TabsList>

        <div className="grid gap-6 xl:grid-cols-[1.1fr_1fr]">
          {/* Left Column: Image Viewport & Camera Trigger */}
          <section className="space-y-4" aria-label="Camera & Image Viewport">
            <Card className="border-border overflow-hidden">
              <CardHeader className="py-3 px-4 bg-muted/40 border-b border-border flex flex-row items-center justify-between">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  {mode === "visual" ? <Eye className="h-4 w-4 text-primary" /> : <Beaker className="h-4 w-4 text-primary" />}
                  {mode === "visual" ? "Produce Capture Viewport" : "Test Card Scan Area"}
                </CardTitle>
                {image && (
                  <Button variant="ghost" size="sm" onClick={() => { setImage(""); setResult(null); }} disabled={busy} className="h-7 text-xs text-destructive hover:text-destructive">
                    <X className="h-3.5 w-3.5 mr-1" /> Clear Image
                  </Button>
                )}
              </CardHeader>
              <CardContent className="p-4 space-y-4">
                <div className="relative aspect-[4/3] w-full overflow-hidden rounded-lg border border-border bg-slate-900/90 flex items-center justify-center">
                  <img
                    src={image || mangoes}
                    alt={image ? "Captured produce or chemical card for analysis" : "Placeholder mangoes showing scanning framing"}
                    className={`h-full w-full object-contain transition-opacity ${image ? "opacity-100" : "opacity-60"}`}
                  />

                  {!image && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center p-4 text-center bg-black/40 backdrop-blur-[2px]">
                      <Badge className="mb-2 bg-primary/90 text-primary-foreground font-medium">
                        {mode === "visual" ? "Level 1 Visual Camera Ready" : "Level 2 Test-Card Alignment"}
                      </Badge>
                      <p className="text-xs text-white/80 max-w-xs mb-3">
                        {mode === "visual"
                          ? "Place produce on a clean background under bright neutral light."
                          : "Align the chemical reaction pad and color chart scale inside camera frame."}
                      </p>
                      <div className="pointer-events-none w-3/4 h-3/4 border-2 border-dashed border-primary/80 rounded-xl" />
                    </div>
                  )}
                </div>

                {/* Primary Action Buttons */}
                <div className="grid grid-cols-2 gap-3">
                  <Button
                    disabled={busy || preparing}
                    onClick={() => { setCameraTarget("sample"); setCamera(true); }}
                    className="gap-2 font-semibold"
                  >
                    <Camera className="h-4 w-4" />
                    {image ? "Retake Photo" : "Open Camera"}
                  </Button>
                  <Button
                    variant="outline"
                    disabled={busy || preparing}
                    onClick={() => fileRef.current?.click()}
                    className="gap-2"
                  >
                    <Upload className="h-4 w-4" />
                    Upload Image
                  </Button>
                </div>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={(e) => void handleFileUpload(e, "sample")}
                />

                {/* Framing & Lighting Hints */}
                <div className="text-xs text-muted-foreground flex items-center justify-between bg-muted/40 p-2.5 rounded-md border border-border">
                  <span>{preparing ? "Processing photo details..." : mode === "visual" ? "Natural light · full skin surface visible" : "Focus on test pad & reference chart"}</span>
                  <span className="font-mono text-[10px] text-primary">JPG / PNG / WebP &lt; 12MB</span>
                </div>
              </CardContent>
            </Card>

            {/* Produce Type Selector for Level 1 */}
            {mode === "visual" && (
              <Card className="border-border">
                <CardHeader className="py-3 px-4 border-b border-border">
                  <CardTitle className="text-sm font-semibold">Select Produce Target</CardTitle>
                  <CardDescription className="text-xs">Supported initial produce models for visual quality assessment</CardDescription>
                </CardHeader>
                <CardContent className="p-4 space-y-3">
                  <div className="grid grid-cols-3 gap-2">
                    {SUPPORTED_PRODUCE_TYPES.map((type) => (
                      <button
                        key={type.id}
                        type="button"
                        onClick={() => setProduceType(type.id as SupportedProduceId)}
                        className={`flex flex-col items-center justify-center p-3 rounded-lg border text-center transition-all ${
                          produceType === type.id
                            ? "border-primary bg-primary/10 font-semibold text-primary shadow-sm"
                            : "border-border bg-card hover:bg-muted text-muted-foreground"
                        }`}
                      >
                        <span className="text-2xl mb-1">{type.icon}</span>
                        <span className="text-xs">{type.label}</span>
                      </button>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground bg-muted p-2 rounded">
                    {SUPPORTED_PRODUCE_TYPES.find((p) => p.id === produceType)?.description}
                  </p>
                </CardContent>
              </Card>
            )}
          </section>

          {/* Right Column: Scan Configuration, Controls & Execution */}
          <section className="space-y-4" aria-label="Scan Controls">
            <TabsContent value="visual" className="mt-0 space-y-4">
              <Card className="border-border">
                <CardHeader className="py-3 px-4 border-b border-border">
                  <div className="flex items-center gap-2 text-primary font-semibold text-xs uppercase">
                    <ScanLine className="h-4 w-4" /> Level 1 · Visual Produce Inspection
                  </div>
                  <CardTitle className="text-lg font-bold">Surface Quality &amp; Physical Assessment</CardTitle>
                  <CardDescription className="text-xs">
                    Evaluates ripeness maturity, bruising, mechanical cuts, rot, and mould-like growths.
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-4 space-y-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="batch-label" className="text-xs font-semibold">Batch / Lot Identifier <span className="text-muted-foreground font-normal">(Optional)</span></Label>
                    <Input
                      id="batch-label"
                      value={label}
                      onChange={(e) => setLabel(e.target.value)}
                      placeholder="e.g. Keitt Mango Lot #A42 - Techiman Market"
                      disabled={busy}
                      className="text-sm"
                    />
                  </div>

                  {/* Level 1 Safety Warning */}
                  <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 flex items-start gap-2.5 text-xs text-amber-800 dark:text-amber-200">
                    <ShieldAlert className="h-4 w-4 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
                    <div>
                      <p className="font-semibold">Visual Inspection Limitation</p>
                      <p className="text-[11px] mt-0.5 opacity-90">
                        Visual scanning assesses physical peel surface defects only. It <strong>NEVER</strong> establishes whether produce contains invisible chemical pesticide residues, bacterial contamination, or heavy metals. Never label produce chemically safe based solely on appearance.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="strip" className="mt-0 space-y-4">
              <Card className="border-border">
                <CardHeader className="py-3 px-4 border-b border-border">
                  <div className="flex items-center gap-2 text-primary font-semibold text-xs uppercase">
                    <FlaskConical className="h-4 w-4" /> Level 2 · Chemical Test-Card Reader
                  </div>
                  <CardTitle className="text-lg font-bold">Rapid Colorimetric Test Integration</CardTitle>
                  <CardDescription className="text-xs">
                    Select a supported rapid chemical card configuration, follow incubation timing, and photograph reaction pad.
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-4 space-y-4">
                  {/* Select Test Configuration */}
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">Select Supported Chemical Test Product</Label>
                    <Select value={selectedConfigId} onValueChange={setSelectedConfigId} disabled={busy}>
                      <SelectTrigger className="w-full text-sm">
                        <SelectValue placeholder="Select chemical test card product" />
                      </SelectTrigger>
                      <SelectContent>
                        {testConfigs.map((cfg) => {
                          const badge = compatibilityStateBadges[cfg.compatibilityState];
                          return (
                            <SelectItem key={cfg.id} value={cfg.id}>
                              <div className="flex items-center justify-between w-full gap-2">
                                <span>{cfg.name} ({cfg.manufacturer})</span>
                                <Badge variant={badge.variant} className="text-[10px] ml-2">
                                  {badge.label}
                                </Badge>
                              </div>
                            </SelectItem>
                          );
                        })}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Selected Test Configuration Information Card */}
                  <div className="rounded-lg border border-border bg-muted/40 p-3 text-xs space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-foreground">{selectedConfig.name}</span>
                      <Badge variant={compatibilityStateBadges[selectedConfig.compatibilityState].variant}>
                        {selectedConfig.compatibilityState}
                      </Badge>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-[11px] text-muted-foreground">
                      <div><span className="font-semibold text-foreground">Target Substance:</span> {selectedConfig.targetSubstance}</div>
                      <div><span className="font-semibold text-foreground">Substance Class:</span> {selectedConfig.substanceClass}</div>
                      <div><span className="font-semibold text-foreground">Required Timing:</span> {selectedConfig.requiredReactionTimeSeconds} seconds</div>
                      <div><span className="font-semibold text-foreground">Validation Status:</span> {selectedConfig.validationStatus.toUpperCase()}</div>
                    </div>
                  </div>

                  {/* Reaction Countdown Timer Widget */}
                  <div className="flex items-center justify-between bg-primary/5 border border-primary/20 rounded-lg p-3">
                    <div className="flex items-center gap-2">
                      <Timer className="h-5 w-5 text-primary" />
                      <div>
                        <p className="text-xs font-semibold">Reaction Incubation Timer</p>
                        <p className="text-[11px] text-muted-foreground">Required: {selectedConfig.requiredReactionTimeSeconds}s</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-lg font-bold text-primary">
                        {timerSecondsLeft !== null ? `${timerSecondsLeft}s` : `${selectedConfig.requiredReactionTimeSeconds}s`}
                      </span>
                      {!isTimerRunning ? (
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => {
                            setTimerSecondsLeft(selectedConfig.requiredReactionTimeSeconds);
                            setIsTimerRunning(true);
                          }}
                          className="text-xs h-8"
                        >
                          Start Timer
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => setIsTimerRunning(false)}
                          className="text-xs h-8"
                        >
                          Reset
                        </Button>
                      )}
                    </div>
                  </div>

                  {/* Instructions Checklist */}
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">Sample Preparation Instructions</Label>
                    <ol className="list-decimal list-inside space-y-1 text-xs text-muted-foreground bg-muted p-2.5 rounded-md border border-border">
                      {selectedConfig.samplePrepInstructions.map((step, idx) => (
                        <li key={idx} className="leading-relaxed">{step}</li>
                      ))}
                    </ol>
                  </div>

                  {/* Confirmation Checkbox */}
                  <label className="flex items-start gap-2.5 text-xs leading-relaxed text-muted-foreground border-t border-border pt-3 cursor-pointer">
                    <Checkbox
                      checked={confirmed}
                      onCheckedChange={(val) => setConfirmed(val === true)}
                      disabled={busy}
                      className="mt-0.5"
                    />
                    <span>
                      I confirm sample extraction and incubation timer were performed according to manufacturer instructions.
                    </span>
                  </label>

                  {/* External Unfamiliar Card Documentation Option */}
                  <Accordion type="single" collapsible className="w-full">
                    <AccordionItem value="unfamiliar" className="border-border">
                      <AccordionTrigger className="text-xs font-semibold py-2">
                        Unrecognized / Unvalidated External Card? (Documentation Mode)
                      </AccordionTrigger>
                      <AccordionContent className="space-y-3 pt-2">
                        <p className="text-xs text-muted-foreground">
                          Photograph an unfamiliar chemical test card to document its layout and submit it for compatibility assessment. AgroClimate does not claim automatic interpretation for unvalidated card formats.
                        </p>
                        <div className="flex gap-2 items-center">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => unfamiliarFileRef.current?.click()}
                            className="text-xs gap-1.5"
                          >
                            <Upload className="h-3.5 w-3.5" /> Upload Unfamiliar Card
                          </Button>
                          {unfamiliarCardImage && <Badge variant="secondary">Photo Attached</Badge>}
                        </div>
                        <input
                          ref={unfamiliarFileRef}
                          type="file"
                          accept="image/jpeg,image/png,image/webp"
                          className="hidden"
                          onChange={(e) => void handleFileUpload(e, "unfamiliar")}
                        />
                        <Textarea
                          value={unfamiliarCardNotes}
                          onChange={(e) => setUnfamiliarCardNotes(e.target.value)}
                          placeholder="Note manufacturer name, target chemical, and reference color scale printed on card..."
                          className="text-xs min-h-16"
                        />
                      </AccordionContent>
                    </AccordionItem>
                  </Accordion>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Error Message Display */}
            {error && (
              <div role="alert" className="p-3 rounded-lg bg-destructive/10 border border-destructive/30 flex items-start gap-2 text-xs text-destructive">
                <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                <p>{error}</p>
              </div>
            )}

            {/* Execute Analysis Button */}
            <Button
              className="w-full gap-2 font-bold py-6 text-sm"
              disabled={!image || busy || preparing || (mode === "strip" && !confirmed)}
              onClick={() => void executeAnalysis()}
            >
              {busy ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Analyzing produce image &amp; color spectrum...
                </>
              ) : (
                <>
                  {mode === "visual" ? "Run Visual Produce Inspection" : "Analyze Test Card Color Response"}
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </Button>
          </section>
        </div>
      </Tabs>

      {/* Results Display Section */}
      {result && (
        <Card className="border-2 border-primary/30 shadow-md">
          <CardHeader className="py-4 px-6 bg-primary/5 border-b border-border flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 mb-1">
                {renderBadgeForOutcome(result.result.outcome)}
                <Badge variant="outline" className="text-xs">
                  Confidence: {result.result.confidence.toUpperCase()}
                </Badge>
              </div>
              <CardTitle className="text-xl font-bold">{primaryOutcomeLabels[result.result.outcome as PrimaryOutcome] || result.result.outcome}</CardTitle>
              <CardDescription className="text-xs mt-0.5">
                {result.label} · Inspection Date: {new Date(result.at).toLocaleString()}
              </CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={() => downloadScanRecord(result)} className="gap-1.5 text-xs">
              <Download className="h-3.5 w-3.5" /> Download Report
            </Button>
          </CardHeader>

          <CardContent className="p-6 space-y-6">
            {/* Outcome Summary */}
            <div className="space-y-2">
              <h3 className="text-xs font-semibold uppercase text-muted-foreground tracking-wider">Assessment Summary</h3>
              <p className="text-sm font-medium leading-relaxed bg-muted/30 p-3 rounded-lg border border-border">
                {result.result.summary}
              </p>
            </div>

            {/* Level 2 Chemical Card Results details */}
            {mode === "strip" && result.result.testCardName && (
              <div className="p-4 rounded-xl border border-sky-500/30 bg-sky-500/5 space-y-3">
                <h3 className="text-xs font-bold uppercase text-sky-700 dark:text-sky-300 flex items-center gap-1.5">
                  <FlaskConical className="h-4 w-4" /> Chemical Test Card Spectrum Analysis
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                  <div><span className="text-muted-foreground block">Test Product:</span> <span className="font-semibold">{result.result.testCardName}</span></div>
                  <div><span className="text-muted-foreground block">Target Substance:</span> <span className="font-semibold">{result.result.detectedSubstance}</span></div>
                  <div><span className="text-muted-foreground block">Interpreted Reading:</span> <span className="font-bold text-sky-600 dark:text-sky-400">{result.result.interpretedValue || "N/A"}</span></div>
                  <div><span className="text-muted-foreground block">Match Deviation (ΔE):</span> <span className="font-mono">{result.result.deltaE !== undefined ? result.result.deltaE : "N/A"}</span></div>
                </div>
              </div>
            )}

            {/* Findings & Actions Grid */}
            <div className="grid gap-6 sm:grid-cols-2">
              <div className="space-y-2">
                <h3 className="text-xs font-semibold uppercase text-muted-foreground tracking-wider flex items-center gap-1.5">
                  <CheckCircle2 className="h-4 w-4 text-emerald-500" /> Observed Visual &amp; Technical Findings
                </h3>
                <ul className="space-y-1.5 text-xs text-foreground bg-muted/40 p-3 rounded-lg border border-border">
                  {result.result.observations.map((item, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      <ChevronRight className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="space-y-2">
                <h3 className="text-xs font-semibold uppercase text-muted-foreground tracking-wider flex items-center gap-1.5">
                  <ArrowRight className="h-4 w-4 text-primary" /> Recommended Next Handling Steps
                </h3>
                <ul className="space-y-1.5 text-xs text-foreground bg-muted/40 p-3 rounded-lg border border-border">
                  {result.result.actions.map((item, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      <ChevronRight className="h-3.5 w-3.5 text-emerald-500 shrink-0 mt-0.5" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Distinguishing Visible Evidence from Inferred Conclusions */}
            {result.result.distinctions && (
              <div className="p-4 rounded-xl border border-border bg-card space-y-3">
                <h3 className="text-xs font-bold uppercase text-foreground flex items-center gap-1.5">
                  <Info className="h-4 w-4 text-primary" /> Visual Evidence vs Inferred Conclusions
                </h3>
                <div className="grid gap-4 sm:grid-cols-2 text-xs">
                  <div className="bg-emerald-500/5 p-3 rounded-lg border border-emerald-500/20">
                    <p className="font-semibold text-emerald-700 dark:text-emerald-300 mb-1">Directly Observed Evidence:</p>
                    <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                      {result.result.distinctions.visibleEvidence.map((ev, i) => <li key={i}>{ev}</li>)}
                    </ul>
                  </div>
                  <div className="bg-amber-500/5 p-3 rounded-lg border border-amber-500/20">
                    <p className="font-semibold text-amber-700 dark:text-amber-300 mb-1">Inferred Quality Boundaries:</p>
                    <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                      {result.result.distinctions.inferredConclusions.map((inf, i) => <li key={i}>{inf}</li>)}
                    </ul>
                  </div>
                </div>
              </div>
            )}

            {/* Mandatory Regulatory Warning */}
            <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 text-xs text-amber-800 dark:text-amber-200">
              <p className="font-semibold">Notice on Chemical Safety &amp; Certification:</p>
              <p className="mt-0.5 opacity-90">
                Visual produce screening and rapid chemical card reading are preliminary screening tools. They do NOT constitute laboratory confirmation or official food safety certification. For formal export compliance or safety disputes, laboratory testing (e.g. HPLC/GC-MS) is required.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Inspection Records History */}
      <Card className="border-border">
        <CardHeader className="py-3 px-4 border-b border-border flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base font-bold flex items-center gap-2">
              <Clock3 className="h-4 w-4 text-primary" /> Saved Inspection Records
            </CardTitle>
            <CardDescription className="text-xs">
              Stored locally on this device ({history.length} records)
            </CardDescription>
          </div>
          {history.length > 0 && (
            <Button variant="ghost" size="sm" onClick={() => saveScans([])} className="h-8 text-xs text-destructive hover:text-destructive">
              <Trash2 className="h-3.5 w-3.5 mr-1" /> Clear History
            </Button>
          )}
        </CardHeader>
        <CardContent className="p-4">
          {history.length === 0 ? (
            <p className="text-xs text-muted-foreground py-4 text-center">No inspection records saved yet.</p>
          ) : (
            <div className="divide-y divide-border">
              {history.map((record) => (
                <div key={record.id} className="py-3 flex flex-wrap items-center justify-between gap-3 text-xs">
                  <div>
                    <p className="font-semibold text-foreground">{record.label}</p>
                    <p className="text-muted-foreground text-[11px]">
                      {record.mode === "visual" ? "Level 1 Visual" : "Level 2 Test Card"} · {new Date(record.at).toLocaleString()}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {renderBadgeForOutcome(record.result.outcome)}
                    <Button variant="outline" size="sm" onClick={() => downloadScanRecord(record)} className="h-7 text-[11px] gap-1">
                      <Download className="h-3 w-3" /> Report
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Camera Modal Component */}
      <CameraCapture
        open={camera}
        onClose={() => setCamera(false)}
        mode={mode}
        selectedProduce={produceType}
        testCardName={selectedConfig.name}
        onCapture={(photo) => {
          if (cameraTarget === "reference") setReference(photo);
          else if (cameraTarget === "unfamiliar") setUnfamiliarCardImage(photo);
          else setImage(photo);
          setResult(null);
          setError("");
        }}
      />

      {/* Administration & Developer Calibration Studio Dialog */}
      <Dialog open={adminDialogOpen} onOpenChange={setAdminDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold flex items-center gap-2">
              <Settings className="h-5 w-5 text-primary" />
              Administration &amp; Developer Calibration Studio
            </DialogTitle>
            <DialogDescription className="text-xs">
              Manage reusable test card configurations and run accuracy evaluation datasets for external test cards.
            </DialogDescription>
          </DialogHeader>

          <Tabs defaultValue="configs" className="space-y-4">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="configs" className="text-xs font-semibold">Test Card Configurations</TabsTrigger>
              <TabsTrigger value="developer" className="text-xs font-semibold">Developer Testing Studio</TabsTrigger>
            </TabsList>

            {/* Test Configs Admin */}
            <TabsContent value="configs" className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold">Registered Test Cards</h3>
                <Badge variant="outline">{testConfigs.length} Registered Configurations</Badge>
              </div>

              <div className="rounded-md border border-border overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50 text-[11px]">
                      <TableHead>Test Card Name</TableHead>
                      <TableHead>Manufacturer</TableHead>
                      <TableHead>Target Substance</TableHead>
                      <TableHead>Validation Status</TableHead>
                      <TableHead>Compatibility</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {testConfigs.map((cfg) => (
                      <TableRow key={cfg.id} className="text-xs">
                        <TableCell className="font-semibold">{cfg.name}</TableCell>
                        <TableCell>{cfg.manufacturer}</TableCell>
                        <TableCell>{cfg.targetSubstance}</TableCell>
                        <TableCell>
                          <Badge variant={cfg.validationStatus === "operational" ? "default" : "secondary"} className="text-[10px]">
                            {cfg.validationStatus}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant={compatibilityStateBadges[cfg.compatibilityState].variant} className="text-[10px]">
                            {cfg.compatibilityState}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </TabsContent>

            {/* Developer Testing & Evaluation Studio */}
            <TabsContent value="developer" className="space-y-4">
              <Card className="border-border">
                <CardHeader className="py-3 px-4 border-b border-border">
                  <CardTitle className="text-sm font-semibold">Record Evaluation Result against Reference Standard</CardTitle>
                </CardHeader>
                <CardContent className="p-4 space-y-3 text-xs">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs">Current Target Test Card:</Label>
                      <Input value={selectedConfig.name} disabled className="text-xs" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Expected Reference Result (Lab / Manual):</Label>
                      <Input
                        value={evalExpectedResult}
                        onChange={(e) => setEvalExpectedResult(e.target.value)}
                        placeholder="e.g. Looks Fresh or < 0.01 mg/kg"
                        className="text-xs"
                      />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Developer Evaluation Notes:</Label>
                    <Textarea
                      value={evalNotes}
                      onChange={(e) => setEvalNotes(e.target.value)}
                      placeholder="Record camera model, ambient lux lighting, color deviation notes..."
                      className="text-xs min-h-16"
                    />
                  </div>
                  <Button size="sm" disabled={!result || !evalExpectedResult} onClick={recordDeveloperEvaluation} className="gap-1.5 text-xs">
                    <Plus className="h-3.5 w-3.5" /> Log Evaluation Entry
                  </Button>
                </CardContent>
              </Card>

              {/* Evaluation Dataset Table */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold uppercase text-muted-foreground">Logged Developer Evaluation Dataset ({evaluations.length})</h4>
                  {evaluations.length > 0 && (
                    <Button size="sm" variant="outline" onClick={exportEvaluationsJson} className="h-7 text-xs gap-1">
                      <FileSpreadsheet className="h-3.5 w-3.5" /> Export JSON Evaluation Dataset
                    </Button>
                  )}
                </div>

                <div className="rounded-md border border-border overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/50 text-[11px]">
                        <TableHead>Timestamp</TableHead>
                        <TableHead>Test Config</TableHead>
                        <TableHead>Expected</TableHead>
                        <TableHead>AgroClimate Reading</TableHead>
                        <TableHead>DeltaE</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {evaluations.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={5} className="text-center text-xs text-muted-foreground py-4">
                            No evaluations logged yet.
                          </TableCell>
                        </TableRow>
                      ) : (
                        evaluations.map((ev) => (
                          <TableRow key={ev.id} className="text-xs">
                            <TableCell>{new Date(ev.timestamp).toLocaleTimeString()}</TableCell>
                            <TableCell className="font-medium">{ev.testConfigName}</TableCell>
                            <TableCell>{ev.expectedResult}</TableCell>
                            <TableCell>{ev.actualResult}</TableCell>
                            <TableCell className="font-mono">{ev.deltaE}</TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </TabsContent>
          </Tabs>

          <DialogFooter>
            <Button size="sm" variant="outline" onClick={() => setAdminDialogOpen(false)} className="text-xs">
              Close Studio
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
