import React, { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Sliders, Save } from "lucide-react";
import { useFleetThresholds, type FleetThresholds } from "@/hooks/useFleetThresholds";
import { useToast } from "@/hooks/use-toast";

export function FleetThresholdsPanel() {
  const { thresholds, scope, save, loading } = useFleetThresholds();
  const [draft, setDraft] = useState<FleetThresholds>(thresholds);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => { setDraft(thresholds); }, [thresholds]);

  const update = (k: keyof FleetThresholds, v: string) => setDraft({ ...draft, [k]: Number(v) });

  const onSave = async () => {
    setSaving(true);
    try {
      await save(draft);
      toast({ title: "Fleet thresholds saved", description: "Alerts will use your custom values." });
    } catch (e: any) {
      toast({ title: "Save failed", description: e.message, variant: "destructive" });
    } finally { setSaving(false); }
  };

  return (
    <Card className="bg-slate-900 border-slate-800 text-slate-100">
      <CardHeader className="py-3 border-b border-slate-800 flex flex-row items-center justify-between">
        <CardTitle className="text-xs font-mono uppercase tracking-widest text-slate-300 flex items-center gap-2">
          <Sliders className="h-3.5 w-3.5" /> Fleet Alert Thresholds
        </CardTitle>
        <Badge variant="outline" className="text-[10px] border-slate-700 text-slate-400">
          {scope === "user" ? "Your override" : scope === "default" ? "Platform default" : "Fallback"}
        </Badge>
      </CardHeader>
      <CardContent className="p-4 space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Battery warning %" value={draft.battery_warning_pct} onChange={(v) => update("battery_warning_pct", v)} />
          <Field label="Battery critical %" value={draft.battery_critical_pct} onChange={(v) => update("battery_critical_pct", v)} />
          <Field label="Signal warning %" value={draft.signal_warning_pct} onChange={(v) => update("signal_warning_pct", v)} />
          <Field label="Signal critical %" value={draft.signal_critical_pct} onChange={(v) => update("signal_critical_pct", v)} />
          <Field label="Stale timeout (s)" value={draft.stale_timeout_sec} onChange={(v) => update("stale_timeout_sec", v)} />
        </div>
        <Button onClick={onSave} disabled={saving || loading} className="w-full bg-cyan-600 hover:bg-cyan-500 text-white font-mono">
          <Save className="h-3.5 w-3.5 mr-2" /> Save Thresholds
        </Button>
        <p className="text-[10px] text-slate-500 font-mono">
          Admins can edit the platform default; every operator can override it for their own fleet.
        </p>
      </CardContent>
    </Card>
  );
}

function Field({ label, value, onChange }: { label: string; value: number; onChange: (v: string) => void }) {
  return (
    <div className="space-y-1">
      <Label className="text-[10px] uppercase font-mono text-slate-400">{label}</Label>
      <Input type="number" value={value} onChange={(e) => onChange(e.target.value)} className="h-9 bg-slate-950 border-slate-800 text-slate-100 font-mono" />
    </div>
  );
}
