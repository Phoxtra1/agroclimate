import React, { useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScanSearch, Upload, Loader2, Leaf, Droplets, Bug, Flame, Mountain, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useDroneVision, type VisionDetection } from "@/hooks/useDroneVision";
import { useToast } from "@/hooks/use-toast";

const ICONS: Record<string, any> = {
  crop_stress: Leaf, vegetation_health: Leaf, nutrient_deficiency: Leaf,
  flood: Droplets, water_accumulation: Droplets, dry_zone: Droplets,
  pest_damage: Bug, disease: Bug,
  fire_risk: Flame, erosion: Mountain, other: AlertCircle,
};

const RISK_CLS = (s: number) => s >= 70 ? "text-red-400" : s >= 40 ? "text-amber-400" : "text-emerald-400";

export function OdenehoVision({ missionId }: { missionId?: string | null }) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const { findings, loading, error, analyzeFile } = useDroneVision();
  const { toast } = useToast();

  const handleFile = async (file: File) => {
    setPreview(URL.createObjectURL(file));
    const f = await analyzeFile(file, missionId ?? undefined);
    if (f) toast({ title: "Vision analysis complete", description: `${f.detections.length} finding(s)` });
  };

  return (
    <Card className="bg-slate-900 border-slate-800 text-slate-100">
      <CardHeader className="py-4 border-b border-slate-800 flex flex-row justify-between items-center">
        <CardTitle className="text-sm font-mono uppercase tracking-widest text-cyan-400 flex items-center gap-2">
          <ScanSearch className="h-4 w-4" /> Odeneho Vision
        </CardTitle>
        <Button size="sm" variant="ghost" className="h-7 text-cyan-400 hover:bg-slate-800 font-mono text-[10px]" onClick={() => fileInputRef.current?.click()} disabled={loading}>
          {loading ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Upload className="h-3 w-3 mr-1" />} ANALYZE IMAGE
        </Button>
        <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])} />
      </CardHeader>
      <CardContent className="p-4 space-y-3">
        {preview && (
          <div className="rounded border border-slate-800 overflow-hidden bg-black aspect-video">
            <img src={preview} alt="analysis" className="w-full h-full object-contain" />
          </div>
        )}

        {!findings && !loading && (
          <p className="text-[11px] font-mono text-slate-500 italic">Upload a drone image or capture from the live feed to detect crop stress, disease, flood, pests, erosion, and fire risk.</p>
        )}

        {loading && (
          <div className="flex items-center gap-2 text-[11px] font-mono text-cyan-400">
            <Loader2 className="h-3 w-3 animate-spin" /> Odeneho is analyzing the imagery…
          </div>
        )}

        {error && <div className="text-[11px] font-mono text-red-400">⚠ {error}</div>}

        {findings && (
          <>
            <div className="bg-slate-950 border border-slate-800 rounded p-3">
              <div className="flex items-center justify-between mb-2">
                <div className="text-[10px] font-mono text-slate-500 uppercase">Overall Health</div>
                <div className={`text-xl font-mono font-bold ${RISK_CLS(100 - findings.overall_health_score)}`}>
                  {findings.overall_health_score.toFixed(0)}<span className="text-xs text-slate-600">/100</span>
                </div>
              </div>
              <p className="text-[11px] text-slate-300">{findings.summary}</p>
            </div>

            <div className="space-y-2">
              {findings.detections.map((d, i) => <DetectionRow key={i} d={d} />)}
              {findings.detections.length === 0 && (
                <div className="text-[11px] font-mono text-slate-500 italic">No risk detections — area appears nominal.</div>
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function DetectionRow({ d }: { d: VisionDetection }) {
  const Icon = ICONS[d.category] || AlertCircle;
  return (
    <div className="bg-slate-950 p-3 rounded border border-slate-800">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-2 min-w-0">
          <Icon className="h-4 w-4 mt-0.5 text-cyan-400 shrink-0" />
          <div className="min-w-0">
            <div className="text-xs font-mono text-slate-200 uppercase">{d.category.replace(/_/g, " ")}</div>
            <div className="text-[11px] text-slate-400 mt-0.5">{d.observation}</div>
            <div className="text-[10px] text-cyan-300 mt-1 font-mono">▶ {d.recommended_action}</div>
          </div>
        </div>
        <div className="text-right shrink-0">
          <Badge variant="outline" className={`font-mono text-[9px] ${d.confidence === "high" ? "border-emerald-700 text-emerald-400" : d.confidence === "moderate" ? "border-amber-700 text-amber-400" : "border-slate-700 text-slate-400"}`}>
            {d.confidence}
          </Badge>
          <div className={`text-sm font-mono font-bold mt-1 ${RISK_CLS(d.risk_score)}`}>{d.risk_score.toFixed(0)}</div>
        </div>
      </div>
    </div>
  );
}
