import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Compass, ShieldCheck, MapPin, CheckCircle, Save, Loader2 } from "lucide-react";
import { DipaEngine, type InvestmentEvaluationResult } from "@/lib/dipaEngine";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export function InvestmentEvaluatorPanel() {
  const [projectName, setProjectName] = useState("Volta Organic Commercial Farm");
  const [locationName, setLocationName] = useState("Eastern Region / Volta");
  const [country, setCountry] = useState("Ghana");
  const [parcelSize, setParcelSize] = useState(150);
  const [cropType, setCropType] = useState("Maize & Soybean");
  const [evaluation, setEvaluation] = useState<InvestmentEvaluationResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleEvaluate = async () => {
    setLoading(true);
    const res = await DipaEngine.evaluateInvestmentProject(
      projectName,
      locationName,
      country,
      parcelSize,
      cropType
    );
    setEvaluation(res);
    setLoading(false);
  };

  const handleSaveEvaluation = async () => {
    if (!evaluation) return;
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase.from("agricultural_investment_evaluations" as any).insert({
        user_id: user?.id ?? null,
        project_name: evaluation.projectName,
        location_name: evaluation.location,
        country: evaluation.country,
        parcel_size_ha: parcelSize,
        crop_type: cropType,
        suitability_score: evaluation.suitabilityScore,
        climate_resilience_score: evaluation.climateResilienceScore,
        market_accessibility_score: evaluation.marketAccessibilityScore,
        logistics_score: evaluation.logisticsScore,
        environmental_risk_score: evaluation.environmentalRiskScore,
        overall_score: evaluation.overallProjectScore,
        analysis_summary: evaluation.executiveSummary,
      });
      if (error) throw error;
      toast.success("Investment evaluation saved");
    } catch (err: any) {
      toast.error(err.message || "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold flex items-center gap-2">
            <Compass className="h-5 w-5 text-primary" /> Agricultural Investment Intelligence Engine
          </h2>
          <p className="text-xs text-muted-foreground">
            Multi-dimensional project scoring: Suitability, Climate Resilience, Logistics &amp; Market Accessibility
          </p>
        </div>
      </div>

      <Card className="border border-border/80 bg-muted/20 shadow-none">
        <CardContent className="py-4 px-4">
          <div className="grid grid-cols-1 sm:grid-cols-5 gap-3 items-end">
            <div>
              <Label className="text-xs font-semibold">Project Name</Label>
              <Input value={projectName} onChange={(e) => setProjectName(e.target.value)} className="h-9 text-xs" />
            </div>
            <div>
              <Label className="text-xs font-semibold">Location / District</Label>
              <Input value={locationName} onChange={(e) => setLocationName(e.target.value)} className="h-9 text-xs" />
            </div>
            <div>
              <Label className="text-xs font-semibold">Country</Label>
              <Input value={country} onChange={(e) => setCountry(e.target.value)} className="h-9 text-xs" />
            </div>
            <div>
              <Label className="text-xs font-semibold">Parcel Size (Hectares)</Label>
              <Input type="number" value={parcelSize} onChange={(e) => setParcelSize(Number(e.target.value) || 1)} className="h-9 text-xs" />
            </div>
            <div>
              <Button onClick={handleEvaluate} disabled={loading} className="w-full h-9 text-xs">
                {loading ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Compass className="h-3.5 w-3.5 mr-1" />}
                Evaluate Project
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {evaluation && (
        <Card className="border-2 border-primary/30 shadow-md space-y-4">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base font-bold">{evaluation.projectName}</CardTitle>
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <MapPin className="h-3.5 w-3.5 text-primary" /> {evaluation.location}, {evaluation.country} ({parcelSize} ha)
                </p>
              </div>
              <div className="text-right">
                <p className="text-[10px] uppercase font-bold text-muted-foreground">Overall Project Score</p>
                <Badge variant="default" className="text-lg px-3 py-1 bg-primary text-primary-foreground font-black">
                  {evaluation.overallProjectScore} / 100
                </Badge>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4 text-xs">
            {/* Score Metrics Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-center">
              <div className="bg-muted/40 p-2.5 rounded-lg border">
                <p className="text-[10px] uppercase text-muted-foreground font-semibold">Suitability</p>
                <p className="text-lg font-bold text-emerald-600 mt-0.5">{evaluation.suitabilityScore}%</p>
              </div>
              <div className="bg-muted/40 p-2.5 rounded-lg border">
                <p className="text-[10px] uppercase text-muted-foreground font-semibold">Climate Resilience</p>
                <p className="text-lg font-bold text-blue-600 mt-0.5">{evaluation.climateResilienceScore}%</p>
              </div>
              <div className="bg-muted/40 p-2.5 rounded-lg border">
                <p className="text-[10px] uppercase text-muted-foreground font-semibold">Market Access</p>
                <p className="text-lg font-bold text-purple-600 mt-0.5">{evaluation.marketAccessibilityScore}%</p>
              </div>
              <div className="bg-muted/40 p-2.5 rounded-lg border">
                <p className="text-[10px] uppercase text-muted-foreground font-semibold">Logistics</p>
                <p className="text-lg font-bold text-amber-600 mt-0.5">{evaluation.logisticsScore}%</p>
              </div>
              <div className="bg-muted/40 p-2.5 rounded-lg border">
                <p className="text-[10px] uppercase text-muted-foreground font-semibold">Env. Risk Score</p>
                <p className="text-lg font-bold text-destructive mt-0.5">{evaluation.environmentalRiskScore}%</p>
              </div>
            </div>

            {/* Executive Summary */}
            <div className="bg-muted/20 p-3 rounded-lg border space-y-1">
              <p className="font-semibold text-foreground">Dipa Executive Summary</p>
              <p className="text-muted-foreground leading-relaxed">{evaluation.executiveSummary}</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="bg-emerald-50/50 p-3 rounded-lg border border-emerald-200">
                <p className="font-semibold text-emerald-900 mb-1 flex items-center gap-1">
                  <CheckCircle className="h-3.5 w-3.5 text-emerald-600" /> Key Strengths
                </p>
                <ul className="space-y-1 text-emerald-800">
                  {evaluation.keyStrengths.map((s, idx) => (
                    <li key={idx}>• {s}</li>
                  ))}
                </ul>
              </div>

              <div className="bg-amber-50/50 p-3 rounded-lg border border-amber-200">
                <p className="font-semibold text-amber-900 mb-1 flex items-center gap-1">
                  <ShieldCheck className="h-3.5 w-3.5 text-amber-600" /> Operational &amp; Risk Considerations
                </p>
                <ul className="space-y-1 text-amber-800">
                  {evaluation.keyRisks.map((r, idx) => (
                    <li key={idx}>• {r}</li>
                  ))}
                </ul>
              </div>
            </div>

            <Button onClick={handleSaveEvaluation} disabled={saving} className="w-full gap-1">
              <Save className="h-4 w-4" /> {saving ? "Saving Evaluation..." : "Save Evaluation to Record"}
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
