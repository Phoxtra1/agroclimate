import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import {
  ShieldCheck, Camera, Activity, FileCheck, AlertTriangle, Info, Plus,
  CheckCircle2, XCircle, Search, Sparkles, Smartphone, Cpu, FileText, Upload
} from "lucide-react";
import { toast } from "sonner";

export interface BatchAssessment {
  batchId: string;
  produceName: string;
  variety?: string;
  quantity: number;
  unit: string;
  harvestDate: string;
  region: string;

  // Tier 1: Supplier-declared
  declaredGrade: "A" | "B" | "C";
  pesticideUsed?: string;
  pesticideApplicationDate?: string;
  phiDaysRequired?: number;
  phiCompliant: boolean;

  // Tier 2: Visual assessment
  visualPhotos: string[];
  colorScore: string;
  sizeUniformity: string;
  ripenessStage: string;
  visibleDefectPct: number;

  // Tier 3: Sensor-assisted
  sensorMethod?: "digital_moisture" | "brix_refractometer" | "nir_scanner" | "rapid_strip_reader" | "none";
  sensorDeviceName?: string;
  sensorDeviceId?: string;
  sensorTarget?: string;
  sensorValue?: number;
  sensorUnit?: string;
  sensorDetectionLimit?: string;
  sensorTimestamp?: string;
  sensorStatus: "active_reading" | "manual_entry" | "not_connected";

  // Tier 4: Laboratory-confirmed
  labConfirmed: boolean;
  labName?: string;
  labCertificateNo?: string;
  labResidueMrlCompliant?: boolean;

  // Verification outcome
  verificationStatus: "Declared" | "Visual Passed" | "Sensor Screened" | "Lab Verified";
  notes?: string;
}

const DEFAULT_BATCHES: BatchAssessment[] = [
  {
    batchId: "LOT-2025-MZ-001",
    produceName: "Yellow Maize",
    variety: "SAMMAZ-52 Drought Resistant",
    quantity: 5000,
    unit: "kg",
    harvestDate: "2025-02-10",
    region: "Bono East (Techiman)",
    declaredGrade: "A",
    pesticideUsed: "Mancozeb 80% WP",
    pesticideApplicationDate: "2025-01-15",
    phiDaysRequired: 14,
    phiCompliant: true,
    visualPhotos: [],
    colorScore: "Golden Yellow (Uniform)",
    sizeUniformity: "High (>90% uniform grain size)",
    ripenessStage: "Fully Mature Dried",
    visibleDefectPct: 1.5,
    sensorMethod: "digital_moisture",
    sensorDeviceName: "AgroSense Handheld Probe",
    sensorDeviceId: "DEV-MS-8820",
    sensorTarget: "Grain Moisture Content",
    sensorValue: 12.4,
    sensorUnit: "%",
    sensorDetectionLimit: "0.1% accuracy",
    sensorTimestamp: "2025-02-12 09:30 AM",
    sensorStatus: "active_reading",
    labConfirmed: false,
    verificationStatus: "Sensor Screened",
    notes: "Ideal moisture for long-term hermetic storage and aflatoxin prevention."
  },
  {
    batchId: "LOT-2025-TM-042",
    produceName: "Fresh Tomatoes",
    variety: "Roma VF",
    quantity: 1200,
    unit: "crates",
    harvestDate: "2025-02-14",
    region: "Ashanti (Mampong)",
    declaredGrade: "A",
    pesticideUsed: "Cypermethrin 10EC",
    pesticideApplicationDate: "2025-02-01",
    phiDaysRequired: 7,
    phiCompliant: true,
    visualPhotos: [],
    colorScore: "Deep Red (Firm Skin)",
    sizeUniformity: "Medium-Large (Grade A)",
    ripenessStage: "Firm Ripened",
    visibleDefectPct: 3.0,
    sensorMethod: "rapid_strip_reader",
    sensorDeviceName: "RapidStrip OptiReader",
    sensorDeviceId: "RS-901",
    sensorTarget: "Pyrethroid Residue Screening",
    sensorValue: 0.05,
    sensorUnit: "ppm",
    sensorDetectionLimit: "< 0.01 ppm",
    sensorTimestamp: "2025-02-14 02:15 PM",
    sensorStatus: "manual_entry",
    labConfirmed: true,
    labName: "Ghana Standards Authority Agrochemical Lab",
    labCertificateNo: "GSA-COA-2025-9912",
    labResidueMrlCompliant: true,
    verificationStatus: "Lab Verified",
    notes: "Certified compliant with West Africa Regional Food MRL Standards."
  }
];

export function ProduceSafety() {
  const [batches, setBatches] = useState<BatchAssessment[]>(DEFAULT_BATCHES);
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState("overview");

  // Create new batch form state
  const [openCreate, setOpenCreate] = useState(false);
  const [batchId, setBatchId] = useState(`LOT-${Date.now().toString().slice(-6)}`);
  const [produceName, setProduceName] = useState("");
  const [variety, setVariety] = useState("");
  const [quantity, setQuantity] = useState("");
  const [unit, setUnit] = useState("kg");
  const [harvestDate, setHarvestDate] = useState(new Date().toISOString().slice(0, 10));
  const [region, setRegion] = useState("Bono Region");
  const [declaredGrade, setDeclaredGrade] = useState<"A" | "B" | "C">("A");

  // Pesticide & PHI
  const [pesticideUsed, setPesticideUsed] = useState("");
  const [pesticideDate, setPesticideDate] = useState("");
  const [phiDays, setPhiDays] = useState("14");

  // Visual
  const [colorScore, setColorScore] = useState("Bright Uniform Color");
  const [sizeUniformity, setSizeUniformity] = useState("High Uniformity");
  const [ripenessStage, setRipenessStage] = useState("Optimal Ripeness");
  const [defectPct, setDefectPct] = useState("2.0");

  // Sensor
  const [sensorMethod, setSensorMethod] = useState<BatchAssessment["sensorMethod"]>("digital_moisture");
  const [sensorDevice, setSensorDevice] = useState("AgroSense Mobile Probe");
  const [sensorTarget, setSensorTarget] = useState("Moisture %");
  const [sensorValue, setSensorValue] = useState("12.5");
  const [sensorUnit, setSensorUnit] = useState("%");
  const [sensorStatus, setSensorStatus] = useState<BatchAssessment["sensorStatus"]>("active_reading");

  // Lab
  const [labConfirmed, setLabConfirmed] = useState(false);
  const [labName, setLabName] = useState("");
  const [labCertNo, setLabCertNo] = useState("");

  const filteredBatches = useMemo(() => {
    return batches.filter(b =>
      `${b.batchId} ${b.produceName} ${b.region} ${b.verificationStatus}`
        .toLowerCase()
        .includes(search.toLowerCase())
    );
  }, [batches, search]);

  const handleCreateBatch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!produceName || !quantity) {
      toast.error("Produce name and quantity are required.");
      return;
    }

    // Calculate PHI compliance
    let phiCompliant = true;
    if (pesticideDate && harvestDate && phiDays) {
      const pDate = new Date(pesticideDate);
      const hDate = new Date(harvestDate);
      const diffDays = Math.round((hDate.getTime() - pDate.getTime()) / (1000 * 3600 * 24));
      phiCompliant = diffDays >= Number(phiDays);
    }

    let verificationStatus: BatchAssessment["verificationStatus"] = "Declared";
    if (labConfirmed && labCertNo) {
      verificationStatus = "Lab Verified";
    } else if (sensorMethod !== "none" && sensorValue) {
      verificationStatus = "Sensor Screened";
    } else if (colorScore) {
      verificationStatus = "Visual Passed";
    }

    const newBatch: BatchAssessment = {
      batchId: batchId || `LOT-${Date.now().toString().slice(-6)}`,
      produceName,
      variety,
      quantity: Number(quantity),
      unit,
      harvestDate,
      region,
      declaredGrade,
      pesticideUsed,
      pesticideApplicationDate: pesticideDate,
      phiDaysRequired: Number(phiDays) || 0,
      phiCompliant,
      visualPhotos: [],
      colorScore,
      sizeUniformity,
      ripenessStage,
      visibleDefectPct: Number(defectPct) || 0,
      sensorMethod,
      sensorDeviceName: sensorDevice,
      sensorDeviceId: `DEV-${Math.random().toString(36).substring(2, 7).toUpperCase()}`,
      sensorTarget,
      sensorValue: Number(sensorValue) || 0,
      sensorUnit,
      sensorDetectionLimit: "Standard Calibration Limit",
      sensorTimestamp: new Date().toLocaleString(),
      sensorStatus,
      labConfirmed,
      labName,
      labCertificateNo: labCertNo,
      labResidueMrlCompliant: labConfirmed,
      verificationStatus,
    };

    setBatches([newBatch, ...batches]);
    toast.success(`Batch ${newBatch.batchId} created and verified as ${verificationStatus}`);
    setOpenCreate(false);

    // Reset form
    setProduceName("");
    setQuantity("");
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-extrabold flex items-center gap-2">
            <ShieldCheck className="h-6 w-6 text-primary" /> Produce &amp; Safety Hub
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Credible produce verification for buyers and suppliers — reducing travel and sample shipping costs.
          </p>
        </div>

        <Dialog open={openCreate} onOpenChange={setOpenCreate}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-1.5">
              <Plus className="h-4 w-4" /> Register New Batch
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Register Produce Batch for Safety Verification</DialogTitle>
            </DialogHeader>

            <form onSubmit={handleCreateBatch} className="space-y-4 text-xs pt-2">
              {/* Batch Identification */}
              <div className="grid grid-cols-2 gap-3 p-3 bg-muted/40 rounded-lg border">
                <div className="col-span-2 font-bold text-foreground">1. Batch Identification</div>
                <div>
                  <Label className="text-xs">Batch / Lot ID</Label>
                  <Input value={batchId} onChange={e => setBatchId(e.target.value)} className="h-8 text-xs font-mono" />
                </div>
                <div>
                  <Label className="text-xs">Produce Name</Label>
                  <Input value={produceName} onChange={e => setProduceName(e.target.value)} placeholder="e.g. Maize, Tomato, Cocoa" required className="h-8 text-xs" />
                </div>
                <div>
                  <Label className="text-xs">Variety / Cultivar</Label>
                  <Input value={variety} onChange={e => setVariety(e.target.value)} placeholder="e.g. SAMMAZ-52" className="h-8 text-xs" />
                </div>
                <div>
                  <Label className="text-xs">Quantity &amp; Unit</Label>
                  <div className="flex gap-2">
                    <Input type="number" value={quantity} onChange={e => setQuantity(e.target.value)} placeholder="5000" required className="h-8 text-xs flex-1" />
                    <Select value={unit} onValueChange={setUnit}>
                      <SelectTrigger className="h-8 w-24 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="kg">kg</SelectItem>
                        <SelectItem value="bags">bags</SelectItem>
                        <SelectItem value="crates">crates</SelectItem>
                        <SelectItem value="tons">tons</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div>
                  <Label className="text-xs">Harvest Date</Label>
                  <Input type="date" value={harvestDate} onChange={e => setHarvestDate(e.target.value)} className="h-8 text-xs" />
                </div>
                <div>
                  <Label className="text-xs">Origin Region</Label>
                  <Input value={region} onChange={e => setRegion(e.target.value)} className="h-8 text-xs" />
                </div>
              </div>

              {/* Pesticide & PHI Log */}
              <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg space-y-2">
                <div className="font-bold text-amber-900 dark:text-amber-300 flex items-center gap-1.5">
                  <Info className="h-4 w-4 text-amber-600" />
                  2. Pesticide Application Log &amp; Pre-Harvest Interval (PHI)
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <Label className="text-[11px]">Pesticide Used</Label>
                    <Input value={pesticideUsed} onChange={e => setPesticideUsed(e.target.value)} placeholder="Product Name" className="h-8 text-xs bg-background" />
                  </div>
                  <div>
                    <Label className="text-[11px]">Application Date</Label>
                    <Input type="date" value={pesticideDate} onChange={e => setPesticideDate(e.target.value)} className="h-8 text-xs bg-background" />
                  </div>
                  <div>
                    <Label className="text-[11px]">Required PHI (Days)</Label>
                    <Input type="number" value={phiDays} onChange={e => setPhiDays(e.target.value)} placeholder="14" className="h-8 text-xs bg-background" />
                  </div>
                </div>
                <p className="text-[10px] text-amber-800 dark:text-amber-400 font-semibold italic">
                  Important: Pesticide-use records alone must never be treated as proof that produce is residue-free or safe.
                </p>
              </div>

              {/* Visual Assessment */}
              <div className="p-3 bg-muted/40 rounded-lg border space-y-2">
                <div className="font-bold flex items-center gap-1.5">
                  <Camera className="h-4 w-4 text-primary" />
                  3. Smartphone Visual Quality Assessment
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-[11px]">Color Characteristics</Label>
                    <Input value={colorScore} onChange={e => setColorScore(e.target.value)} className="h-8 text-xs" />
                  </div>
                  <div>
                    <Label className="text-[11px]">Size &amp; Uniformity</Label>
                    <Input value={sizeUniformity} onChange={e => setSizeUniformity(e.target.value)} className="h-8 text-xs" />
                  </div>
                  <div>
                    <Label className="text-[11px]">Ripeness Stage</Label>
                    <Input value={ripenessStage} onChange={e => setRipenessStage(e.target.value)} className="h-8 text-xs" />
                  </div>
                  <div>
                    <Label className="text-[11px]">Visible Defects (%)</Label>
                    <Input type="number" step="0.1" value={defectPct} onChange={e => setDefectPct(e.target.value)} className="h-8 text-xs" />
                  </div>
                </div>
                <p className="text-[10px] text-muted-foreground italic">
                  Disclaimer: Smartphone visual capture evaluates physical dimensions and appearance, but does NOT establish chemical or toxicological safety.
                </p>
              </div>

              {/* Sensor Screening */}
              <div className="p-3 bg-muted/40 rounded-lg border space-y-2">
                <div className="font-bold flex items-center gap-1.5">
                  <Activity className="h-4 w-4 text-cyan-600" />
                  4. Sensor-Assisted / Test Kit Screening
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-[11px]">Test Method</Label>
                    <Select value={sensorMethod} onValueChange={(v: any) => setSensorMethod(v)}>
                      <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="digital_moisture">Digital Moisture Probe</SelectItem>
                        <SelectItem value="brix_refractometer">Optical Brix Refractometer</SelectItem>
                        <SelectItem value="nir_scanner">NIR Spectrometer Scanner</SelectItem>
                        <SelectItem value="rapid_strip_reader">Rapid Test Strip Reader</SelectItem>
                        <SelectItem value="none">None / Not Screened</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-[11px]">Sensor Integration Status</Label>
                    <Select value={sensorStatus} onValueChange={(v: any) => setSensorStatus(v)}>
                      <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="active_reading">Connected Hardware Input</SelectItem>
                        <SelectItem value="manual_entry">Manual Test Kit Entry</SelectItem>
                        <SelectItem value="not_connected">Future Sensor Integration</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-[11px]">Target Parameter</Label>
                    <Input value={sensorTarget} onChange={e => setSensorTarget(e.target.value)} className="h-8 text-xs" />
                  </div>
                  <div>
                    <Label className="text-[11px]">Measured Reading &amp; Unit</Label>
                    <div className="flex gap-2">
                      <Input type="number" step="any" value={sensorValue} onChange={e => setSensorValue(e.target.value)} className="h-8 text-xs flex-1" />
                      <Input value={sensorUnit} onChange={e => setSensorUnit(e.target.value)} className="h-8 w-20 text-xs" />
                    </div>
                  </div>
                </div>
              </div>

              {/* Lab Certification */}
              <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg space-y-2">
                <div className="flex items-center justify-between">
                  <div className="font-bold text-emerald-900 dark:text-emerald-300 flex items-center gap-1.5">
                    <FileCheck className="h-4 w-4 text-emerald-600" />
                    5. Accredited Laboratory Confirmation
                  </div>
                  <label className="flex items-center gap-1.5 text-xs font-semibold cursor-pointer">
                    <input type="checkbox" checked={labConfirmed} onChange={e => setLabConfirmed(e.target.checked)} className="rounded" />
                    Lab Verified
                  </label>
                </div>
                {labConfirmed && (
                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <div>
                      <Label className="text-[11px]">Accredited Lab Name</Label>
                      <Input value={labName} onChange={e => setLabName(e.target.value)} placeholder="e.g. Ghana Standards Authority" className="h-8 text-xs bg-background" />
                    </div>
                    <div>
                      <Label className="text-[11px]">Certificate of Analysis (COA) #</Label>
                      <Input value={labCertNo} onChange={e => setLabCertNo(e.target.value)} placeholder="e.g. COA-2025-1082" className="h-8 text-xs bg-background" />
                    </div>
                  </div>
                )}
              </div>

              <Button type="submit" className="w-full h-10 text-xs font-bold">
                Publish Verified Produce Batch
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Tiers Explanation Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
        <Card className="bg-card">
          <CardContent className="pt-3 pb-3 px-3 space-y-1">
            <div className="flex items-center gap-1.5 text-xs font-bold text-muted-foreground">
              <FileText className="h-4 w-4 text-blue-500" /> Tier 1: Declared
            </div>
            <p className="text-[11px] text-muted-foreground">Supplier lot info &amp; self-logged pesticide PHI.</p>
          </CardContent>
        </Card>
        <Card className="bg-card">
          <CardContent className="pt-3 pb-3 px-3 space-y-1">
            <div className="flex items-center gap-1.5 text-xs font-bold text-muted-foreground">
              <Smartphone className="h-4 w-4 text-amber-500" /> Tier 2: Visual
            </div>
            <p className="text-[11px] text-muted-foreground">Color, defect %, ripeness &amp; size uniformity.</p>
          </CardContent>
        </Card>
        <Card className="bg-card">
          <CardContent className="pt-3 pb-3 px-3 space-y-1">
            <div className="flex items-center gap-1.5 text-xs font-bold text-muted-foreground">
              <Cpu className="h-4 w-4 text-cyan-600" /> Tier 3: Sensor
            </div>
            <p className="text-[11px] text-muted-foreground">Moisture probe, brix refractometer &amp; NIR screening.</p>
          </CardContent>
        </Card>
        <Card className="bg-card">
          <CardContent className="pt-3 pb-3 px-3 space-y-1">
            <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-600">
              <FileCheck className="h-4 w-4 text-emerald-600" /> Tier 4: Lab Certified
            </div>
            <p className="text-[11px] text-muted-foreground">Certified COA &amp; accredited MRL residue reports.</p>
          </CardContent>
        </Card>
      </div>

      {/* Search & Batches List */}
      <Card>
        <CardHeader className="pb-3 border-b">
          <div className="flex items-center justify-between gap-3">
            <CardTitle className="text-base font-bold">Verified Produce Batches ({filteredBatches.length})</CardTitle>
            <div className="relative w-64">
              <Search className="h-3.5 w-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search batch ID, produce or status…"
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-8 h-8 text-xs"
              />
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-4 space-y-4">
          {filteredBatches.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-8">No produce batches found.</p>
          ) : (
            filteredBatches.map(batch => (
              <div key={batch.batchId} className="border rounded-xl p-4 bg-card space-y-3 shadow-sm hover:border-primary/40 transition-colors">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border/50 pb-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-base text-foreground">{batch.produceName}</span>
                      {batch.variety && <span className="text-xs text-muted-foreground">({batch.variety})</span>}
                      <Badge variant="outline" className="font-mono text-[10px]">{batch.batchId}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {batch.quantity.toLocaleString()} {batch.unit} · Harvested {batch.harvestDate} · {batch.region}
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <Badge
                      className={`text-xs px-2.5 py-0.5 font-bold ${
                        batch.verificationStatus === "Lab Verified"
                          ? "bg-emerald-600 text-white"
                          : batch.verificationStatus === "Sensor Screened"
                          ? "bg-cyan-600 text-white"
                          : batch.verificationStatus === "Visual Passed"
                          ? "bg-amber-600 text-white"
                          : "bg-muted text-foreground"
                      }`}
                    >
                      {batch.verificationStatus}
                    </Badge>
                  </div>
                </div>

                {/* 4 Tiers Detail Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
                  {/* Tier 1: Declared & PHI */}
                  <div className="p-2.5 rounded-lg bg-muted/30 border space-y-1">
                    <span className="font-bold text-muted-foreground flex items-center gap-1">
                      <FileText className="h-3.5 w-3.5 text-blue-500" /> Declared &amp; PHI
                    </span>
                    <p><strong>Grade:</strong> {batch.declaredGrade}</p>
                    <p><strong>Pesticide:</strong> {batch.pesticideUsed || "None Reported"}</p>
                    {batch.pesticideApplicationDate && (
                      <p><strong>Applied:</strong> {batch.pesticideApplicationDate}</p>
                    )}
                    <div className="pt-0.5">
                      {batch.phiCompliant ? (
                        <Badge variant="outline" className="text-[9px] text-emerald-600 border-emerald-600/30 bg-emerald-50 dark:bg-emerald-950/20">
                          ✓ PHI Compliant ({batch.phiDaysRequired} days)
                        </Badge>
                      ) : (
                        <Badge variant="destructive" className="text-[9px]">
                          ⚠️ PHI Warning
                        </Badge>
                      )}
                    </div>
                  </div>

                  {/* Tier 2: Visual Assessment */}
                  <div className="p-2.5 rounded-lg bg-muted/30 border space-y-1">
                    <span className="font-bold text-muted-foreground flex items-center gap-1">
                      <Camera className="h-3.5 w-3.5 text-amber-500" /> Visual Characteristics
                    </span>
                    <p><strong>Color:</strong> {batch.colorScore}</p>
                    <p><strong>Uniformity:</strong> {batch.sizeUniformity}</p>
                    <p><strong>Ripeness:</strong> {batch.ripenessStage}</p>
                    <p><strong>Defect Rate:</strong> {batch.visibleDefectPct}%</p>
                  </div>

                  {/* Tier 3: Sensor Screening */}
                  <div className="p-2.5 rounded-lg bg-muted/30 border space-y-1">
                    <span className="font-bold text-muted-foreground flex items-center gap-1">
                      <Activity className="h-3.5 w-3.5 text-cyan-600" /> Sensor Screening
                    </span>
                    {batch.sensorMethod && batch.sensorMethod !== "none" ? (
                      <>
                        <p><strong>Target:</strong> {batch.sensorTarget}</p>
                        <p className="font-bold text-cyan-700 dark:text-cyan-400">
                          {batch.sensorValue} {batch.sensorUnit}
                        </p>
                        <p className="text-[10px] text-muted-foreground">{batch.sensorDeviceName}</p>
                        <Badge variant="outline" className="text-[9px]">
                          {batch.sensorStatus === "active_reading" ? "⚡ Live Hardware Input" : "Manual Sensor Log"}
                        </Badge>
                      </>
                    ) : (
                      <p className="text-muted-foreground italic">No sensor screening recorded.</p>
                    )}
                  </div>

                  {/* Tier 4: Lab Verified */}
                  <div className="p-2.5 rounded-lg bg-muted/30 border space-y-1">
                    <span className="font-bold text-muted-foreground flex items-center gap-1">
                      <FileCheck className="h-3.5 w-3.5 text-emerald-600" /> Lab Certification
                    </span>
                    {batch.labConfirmed ? (
                      <>
                        <p className="font-semibold text-emerald-700 dark:text-emerald-400">{batch.labName}</p>
                        <p className="font-mono text-[10px]">COA: {batch.labCertificateNo}</p>
                        <Badge variant="outline" className="text-[9px] text-emerald-600 border-emerald-600/30">
                          ✓ MRL Residue Safe
                        </Badge>
                      </>
                    ) : (
                      <p className="text-muted-foreground italic">Uncertified by laboratory.</p>
                    )}
                  </div>
                </div>

                {batch.notes && (
                  <p className="text-xs text-muted-foreground bg-muted/40 p-2 rounded border border-border/40 italic">
                    "{batch.notes}"
                  </p>
                )}
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
