import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Download,
  FileSpreadsheet,
  FileCode,
  ShieldCheck,
  Filter,
  Layers,
  Database,
  RefreshCw,
  Copy,
  Check,
  Sparkles,
  Link as LinkIcon,
  CloudRain,
  UserCheck,
  Compass,
  Store,
  Truck,
  Archive,
  Boxes,
  Sprout
} from "lucide-react";
import { toast } from "sonner";
import { APP_VERSION_LABEL } from "@/config/version";
import {
  ExportModule,
  AnonymizationLevel,
  fetchExportDataset,
  generateExportFile,
  downloadExportFile,
  ExportResult
} from "@/lib/export/datasetExporter";

const MODULE_OPTIONS: { value: ExportModule; label: string; icon: any; description: string }[] = [
  {
    value: "unified_lifecycle",
    label: "Unified Linked Lifecycle Chain",
    icon: LinkIcon,
    description: "Linked flow: Weather → Farm activity → Inputs → Crop condition → Harvest → Market → Transport → Outcome"
  },
  {
    value: "agroclimate",
    label: "1. AgroClimate (Weather & Risks)",
    icon: CloudRain,
    description: "Weather forecasts, environmental alerts, hazard severity, AI advisory inference logs"
  },
  {
    value: "handler",
    label: "2. Handler Operations",
    icon: UserCheck,
    description: "Assignments, clock-in/out, completed tasks, area covered (ha), input usage"
  },
  {
    value: "agnav",
    label: "3. AGNav Navigation & Maritime",
    icon: Compass,
    description: "Routes, distances, travel times, vessel telemetry, SOS emergency incidents"
  },
  {
    value: "market_link",
    label: "4. Market Link Trade",
    icon: Store,
    description: "Supply listings, buyer demand orders, market contracts, commodity price intelligence"
  },
  {
    value: "agtrans",
    label: "5. AGTrans Partners Logistics",
    icon: Truck,
    description: "Transport requests, vehicle capacity (kg), trip distances, driver agreements, delivery outcomes"
  },
  {
    value: "post_harvest",
    label: "6. Post-Harvest Tracker",
    icon: Archive,
    description: "Harvest volumes, storage conditions, temperature/humidity, spoilage risk ratings"
  },
  {
    value: "agro_inventory",
    label: "7. Agro Inventory & Stock",
    icon: Boxes,
    description: "Warehouse stock levels, stock movement logs, input usage thresholds"
  },
  {
    value: "crops_livestock_aquaculture",
    label: "8. Crops, Livestock & Aquaculture",
    icon: Sprout,
    description: "Farm production batches, animal/crop health, growth stages, pond pH/feeding schedules"
  }
];

const GHANA_REGIONS = [
  { value: "all", label: "All Regions (National)" },
  { value: "Ashanti", label: "Ashanti Region" },
  { value: "Greater Accra", label: "Greater Accra Region" },
  { value: "Northern", label: "Northern Region" },
  { value: "Eastern", label: "Eastern Region" },
  { value: "Western", label: "Western Region" },
  { value: "Volta", label: "Volta Region" },
  { value: "Brong Ahafo", label: "Bono / Brong Ahafo Region" },
  { value: "Upper East", label: "Upper East Region" },
  { value: "Upper West", label: "Upper West Region" },
  { value: "Central", label: "Central Region" },
];

export default function DataExporterPanel() {
  const [selectedModule, setSelectedModule] = useState<ExportModule>("unified_lifecycle");
  const [startDate, setStartDate] = useState<string>("2026-01-01");
  const [endDate, setEndDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [selectedRegion, setSelectedRegion] = useState<string>("all");
  const [anonymizationLevel, setAnonymizationLevel] = useState<AnonymizationLevel>("standard");

  const [previewData, setPreviewData] = useState<Record<string, any>[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [exporting, setExporting] = useState<"csv" | "json" | null>(null);
  const [copied, setCopied] = useState<boolean>(false);

  // Load preview data when filters change
  const loadPreview = async () => {
    setLoading(true);
    try {
      const data = await fetchExportDataset({
        module: selectedModule,
        startDate,
        endDate,
        region: selectedRegion,
        anonymizationLevel,
      });
      setPreviewData(data);
    } catch (err: any) {
      toast.error(err?.message || "Failed to query operational dataset.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPreview();
  }, [selectedModule, startDate, endDate, selectedRegion, anonymizationLevel]);

  // Handle export execution
  const handleExport = async (format: "csv" | "json") => {
    setExporting(format);
    try {
      const exportFile: ExportResult = await generateExportFile(
        {
          module: selectedModule,
          startDate,
          endDate,
          region: selectedRegion,
          anonymizationLevel,
        },
        format
      );

      downloadExportFile(exportFile);
      toast.success(`Exported ${exportFile.recordCount} records to ${exportFile.filename}`);
    } catch (err: any) {
      toast.error(err?.message || "Failed to generate export file.");
    } finally {
      setExporting(null);
    }
  };

  // Handle quick preset range buttons
  const setRangePreset = (days: number) => {
    const end = new Date();
    const start = new Date();
    start.setDate(end.getDate() - days);
    setStartDate(start.toISOString().slice(0, 10));
    setEndDate(end.toISOString().slice(0, 10));
  };

  // Copy preview JSON to clipboard
  const handleCopyJson = () => {
    if (!previewData.length) return;
    navigator.clipboard.writeText(JSON.stringify(previewData.slice(0, 10), null, 2));
    setCopied(true);
    toast.success("Copied top 10 anonymized records to clipboard");
    setTimeout(() => setCopied(false), 2000);
  };

  // Columns for preview table
  const previewHeaders = useMemo(() => {
    if (!previewData.length) return [];
    return Object.keys(previewData[0]).slice(0, 8); // show first 8 key columns
  }, [previewData]);

  const activeModuleMeta = useMemo(() => {
    return MODULE_OPTIONS.find((m) => m.value === selectedModule) || MODULE_OPTIONS[0];
  }, [selectedModule]);

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-gradient-to-r from-emerald-900/30 via-card to-card border border-emerald-500/20 p-5 rounded-xl">
        <div className="flex items-start gap-3">
          <div className="p-3 bg-emerald-500/10 rounded-xl border border-emerald-500/30 text-emerald-500">
            <Database className="h-7 w-7" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-foreground">Agro-Climate Dataset Export Hub</h1>
              <Badge variant="outline" className="text-[10px] font-mono border-emerald-500/40 text-emerald-600 dark:text-emerald-400">
                {APP_VERSION_LABEL}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-1 max-w-2xl">
              Centralized, standardized & PII-sanitized operational data extraction across all 8 AgroClimate domain modules, featuring complete multi-module Linked Lifecycle Chain exports.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Button
            variant="outline"
            size="sm"
            onClick={loadPreview}
            disabled={loading}
            className="text-xs"
          >
            <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${loading ? "animate-spin" : ""}`} />
            Refresh Dataset
          </Button>
        </div>
      </div>

      {/* Overview Stat Badges */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="border-emerald-500/20 bg-card">
          <CardContent className="pt-4 pb-3 flex items-center justify-between">
            <div>
              <p className="text-[11px] text-muted-foreground font-medium">Available Records</p>
              <p className="text-xl font-bold text-foreground mt-0.5">{previewData.length.toLocaleString()}</p>
            </div>
            <Layers className="h-5 w-5 text-emerald-500/70" />
          </CardContent>
        </Card>

        <Card className="border-emerald-500/20 bg-card">
          <CardContent className="pt-4 pb-3 flex items-center justify-between">
            <div>
              <p className="text-[11px] text-muted-foreground font-medium">Selected Module</p>
              <p className="text-sm font-bold text-foreground mt-0.5 truncate max-w-[120px]">
                {activeModuleMeta.label.replace(/^\d+\.\s*/, "")}
              </p>
            </div>
            <activeModuleMeta.icon className="h-5 w-5 text-emerald-500/70" />
          </CardContent>
        </Card>

        <Card className="border-emerald-500/20 bg-card">
          <CardContent className="pt-4 pb-3 flex items-center justify-between">
            <div>
              <p className="text-[11px] text-muted-foreground font-medium">Privacy Status</p>
              <p className="text-xs font-bold text-emerald-600 dark:text-emerald-400 mt-0.5 flex items-center gap-1">
                <ShieldCheck className="h-3.5 w-3.5" /> PII Sanitized
              </p>
            </div>
            <ShieldCheck className="h-5 w-5 text-emerald-500/70" />
          </CardContent>
        </Card>

        <Card className="border-emerald-500/20 bg-card">
          <CardContent className="pt-4 pb-3 flex items-center justify-between">
            <div>
              <p className="text-[11px] text-muted-foreground font-medium">Export Formats</p>
              <p className="text-xs font-bold text-foreground mt-0.5">CSV & JSON (RFC4180)</p>
            </div>
            <FileSpreadsheet className="h-5 w-5 text-emerald-500/70" />
          </CardContent>
        </Card>
      </div>

      {/* Filter Controls Panel */}
      <Card className="border-border shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Filter className="h-4 w-4 text-emerald-500" /> Export Configuration & Filters
          </CardTitle>
          <CardDescription className="text-xs">
            Select the operational domain or Linked Lifecycle Chain, target date range, region, and privacy level.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* 1. Module Selector */}
            <div className="space-y-1.5 md:col-span-2">
              <Label className="text-xs font-semibold">Domain Module / Dataset Type</Label>
              <Select value={selectedModule} onValueChange={(v) => setSelectedModule(v as ExportModule)}>
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue placeholder="Select dataset module" />
                </SelectTrigger>
                <SelectContent className="max-h-72">
                  {MODULE_OPTIONS.map((mod) => (
                    <SelectItem key={mod.value} value={mod.value} className="text-xs">
                      <div className="flex items-center gap-2">
                        <mod.icon className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                        <span className="font-medium">{mod.label}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-[11px] text-muted-foreground">{activeModuleMeta.description}</p>
            </div>

            {/* 2. Region Filter */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Region / Location Filter</Label>
              <Select value={selectedRegion} onValueChange={setSelectedRegion}>
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue placeholder="Select region" />
                </SelectTrigger>
                <SelectContent>
                  {GHANA_REGIONS.map((reg) => (
                    <SelectItem key={reg.value} value={reg.value} className="text-xs">
                      {reg.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* 3. Privacy Anonymization */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Anonymization Level</Label>
              <Select
                value={anonymizationLevel}
                onValueChange={(v) => setAnonymizationLevel(v as AnonymizationLevel)}
              >
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="standard" className="text-xs">
                    Standard (Strip PII & Hash IDs)
                  </SelectItem>
                  <SelectItem value="strict" className="text-xs">
                    Strict Pseudonymized (Full Masking)
                  </SelectItem>
                  <SelectItem value="aggregated" className="text-xs">
                    De-identified Operational Aggregate
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Date Range Controls & Presets */}
          <div className="pt-2 border-t border-border flex flex-col sm:flex-row sm:items-end justify-between gap-3">
            <div className="grid grid-cols-2 gap-3 flex-1 max-w-md">
              <div className="space-y-1">
                <Label className="text-[11px] text-muted-foreground">Start Date</Label>
                <Input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="h-8 text-xs"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-[11px] text-muted-foreground">End Date</Label>
                <Input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="h-8 text-xs"
                />
              </div>
            </div>

            <div className="flex items-center gap-1.5 self-end flex-wrap">
              <span className="text-[11px] text-muted-foreground mr-1">Presets:</span>
              <Button variant="outline" size="sm" onClick={() => setRangePreset(7)} className="h-7 text-[11px] px-2">
                7 Days
              </Button>
              <Button variant="outline" size="sm" onClick={() => setRangePreset(30)} className="h-7 text-[11px] px-2">
                30 Days
              </Button>
              <Button variant="outline" size="sm" onClick={() => setRangePreset(90)} className="h-7 text-[11px] px-2">
                90 Days
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setStartDate("2026-01-01");
                  setEndDate(new Date().toISOString().slice(0, 10));
                }}
                className="h-7 text-[11px] px-2"
              >
                All Time
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Standardized Preset Export Packages */}
      <Card className="border-emerald-500/20 bg-emerald-950/10">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-emerald-500" /> Standardized One-Click Export Packages
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <Button
              variant="outline"
              className="h-auto p-3 text-left justify-start flex-col items-start border-emerald-500/30 hover:bg-emerald-500/10"
              onClick={() => {
                setSelectedModule("unified_lifecycle");
                setSelectedRegion("all");
                setRangePreset(90);
              }}
            >
              <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-600 dark:text-emerald-400 mb-1">
                <LinkIcon className="h-3.5 w-3.5" /> Full Lifecycle Chain
              </div>
              <p className="text-[11px] text-muted-foreground">
                Weather → Farm → Harvest → Market → Transport → Outcome
              </p>
            </Button>

            <Button
              variant="outline"
              className="h-auto p-3 text-left justify-start flex-col items-start border-emerald-500/30 hover:bg-emerald-500/10"
              onClick={() => {
                setSelectedModule("agroclimate");
                setRangePreset(30);
              }}
            >
              <div className="flex items-center gap-1.5 text-xs font-bold text-foreground mb-1">
                <CloudRain className="h-3.5 w-3.5 text-blue-500" /> Weather & Risk Intelligence
              </div>
              <p className="text-[11px] text-muted-foreground">
                Hazard severity, advisories & AI inference logs
              </p>
            </Button>

            <Button
              variant="outline"
              className="h-auto p-3 text-left justify-start flex-col items-start border-emerald-500/30 hover:bg-emerald-500/10"
              onClick={() => {
                setSelectedModule("agtrans");
                setRangePreset(30);
              }}
            >
              <div className="flex items-center gap-1.5 text-xs font-bold text-foreground mb-1">
                <Truck className="h-3.5 w-3.5 text-amber-500" /> AGTrans Logistics & Trips
              </div>
              <p className="text-[11px] text-muted-foreground">
                Distances, vehicle capacities & delivery outcomes
              </p>
            </Button>

            <Button
              variant="outline"
              className="h-auto p-3 text-left justify-start flex-col items-start border-emerald-500/30 hover:bg-emerald-500/10"
              onClick={() => {
                setSelectedModule("post_harvest");
                setRangePreset(90);
              }}
            >
              <div className="flex items-center gap-1.5 text-xs font-bold text-foreground mb-1">
                <Archive className="h-3.5 w-3.5 text-purple-500" /> Post-Harvest Storage & Losses
              </div>
              <p className="text-[11px] text-muted-foreground">
                Harvest quantities, humidity/temp & spoilage risk
              </p>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Live Dataset Preview & Download Actions */}
      <Card className="border-border">
        <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <Database className="h-4 w-4 text-emerald-500" /> Dataset Live Preview
              <Badge variant="secondary" className="text-[10px] font-mono">
                {previewData.length} Records
              </Badge>
            </CardTitle>
            <CardDescription className="text-xs">
              Previewing anonymized data sample for {activeModuleMeta.label}. All credentials and personal names are sanitized.
            </CardDescription>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleCopyJson}
              disabled={!previewData.length}
              className="text-xs h-8"
            >
              {copied ? <Check className="h-3.5 w-3.5 mr-1 text-emerald-500" /> : <Copy className="h-3.5 w-3.5 mr-1" />}
              {copied ? "Copied" : "Copy JSON"}
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={() => handleExport("json")}
              disabled={exporting !== null || !previewData.length}
              className="text-xs h-8 border-emerald-500/40"
            >
              <FileCode className="h-3.5 w-3.5 mr-1 text-emerald-500" />
              Export JSON
            </Button>

            <Button
              size="sm"
              onClick={() => handleExport("csv")}
              disabled={exporting !== null || !previewData.length}
              className="text-xs h-8 bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              <FileSpreadsheet className="h-3.5 w-3.5 mr-1" />
              {exporting === "csv" ? "Generating CSV..." : "Export CSV"}
            </Button>
          </div>
        </CardHeader>

        <CardContent>
          {loading ? (
            <div className="py-12 text-center text-muted-foreground text-xs flex flex-col items-center gap-2">
              <RefreshCw className="h-6 w-6 animate-spin text-emerald-500" />
              Building operational dataset across AgroClimate domain tables...
            </div>
          ) : !previewData.length ? (
            <div className="py-12 text-center text-muted-foreground text-xs">
              No operational records match the selected filters. Try broadening the date range or selecting 'All Regions'.
            </div>
          ) : (
            <div className="border rounded-lg overflow-x-auto max-h-96">
              <table className="w-full text-xs text-left">
                <thead className="bg-muted text-muted-foreground font-semibold uppercase sticky top-0 text-[10px]">
                  <tr>
                    <th className="p-2 border-b">#</th>
                    {previewHeaders.map((header) => (
                      <th key={header} className="p-2 border-b whitespace-nowrap">
                        {header.replace(/_/g, " ")}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {previewData.slice(0, 15).map((row, idx) => (
                    <tr key={idx} className="hover:bg-muted/50 transition-colors font-mono text-[11px]">
                      <td className="p-2 text-muted-foreground font-sans text-[10px]">{idx + 1}</td>
                      {previewHeaders.map((header) => {
                        const val = row[header];
                        return (
                          <td key={header} className="p-2 whitespace-nowrap max-w-[200px] truncate">
                            {val === null || val === undefined ? (
                              <span className="text-muted-foreground/50">—</span>
                            ) : typeof val === "boolean" ? (
                              <Badge variant={val ? "default" : "secondary"} className="text-[9px] py-0">
                                {String(val)}
                              </Badge>
                            ) : String(val).startsWith("LIFECYCLE_") || String(val).includes("_#") ? (
                              <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                                {String(val)}
                              </span>
                            ) : (
                              String(val)
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
              {previewData.length > 15 && (
                <div className="p-2 bg-muted/40 text-[11px] text-center text-muted-foreground border-t font-sans">
                  Showing top 15 of {previewData.length} records. The exported CSV/JSON file will contain all {previewData.length} matching rows.
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
