import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Bot, ShieldAlert, Zap, Wind, RefreshCw, Loader2, Eye, ShieldCheck } from "lucide-react";
import type { TelemetryData, EnvironmentData, DroneStatus } from "@/hooks/useDroneState";
import { useFlightAdvisor } from "@/hooks/useFlightAdvisor";
import { Button } from "@/components/ui/button";

const SEVERITY_CLS: Record<string, string> = {
  info: "bg-slate-950/50 border-slate-800 text-slate-300",
  warning: "bg-amber-950/30 border-amber-900/50 text-amber-300",
  critical: "bg-red-950/30 border-red-900/50 text-red-300",
};

const STATUS_LABEL: Record<string, { label: string; color: string }> = {
  safe: { label: "AIRSPACE SAFE", color: "text-emerald-400" },
  caution: { label: "PROCEED WITH CAUTION", color: "text-amber-400" },
  return_home: { label: "RETURN TO BASE ADVISED", color: "text-blue-400" },
  emergency_land: { label: "DEVIATE / LAND IMMEDIATELY", color: "text-red-400" },
};

export function DipaAiAdvisory({
  telemetry, environment, status = "flying",
}: { telemetry: TelemetryData; environment: EnvironmentData; status?: DroneStatus }) {
  const { advisory, loading, evaluate, error } = useFlightAdvisor({
    telemetry, environment, status,
  });

  const activeType = localStorage.getItem("aih_active_type") || "drone";
  const isMannedCommercial = [
    "helicopter",
    "fixed_wing",
    "air_ambulance",
    "cargo",
    "maritime_patrol"
  ].includes(activeType);

  // Local fast alerts (instant)
  const localAlerts = (() => {
    const a: { type: string; severity: keyof typeof SEVERITY_CLS; message: string; icon: any }[] = [];
    if (environment?.windSpeed > 25) {
      a.push({ type: "high_wind", severity: "warning", message: `High wind: ${environment.windSpeed.toFixed(0)} km/h`, icon: Wind });
    }
    if (telemetry.battery < 25) {
      a.push({ type: "low_battery", severity: "critical", message: `Energy critical: ${telemetry.battery.toFixed(0)}%`, icon: Zap });
    }
    if (telemetry.signalStrength < 50 && telemetry.signalStrength > 0) {
      a.push({ type: "signal_loss", severity: "warning", message: `Weak signal: ${telemetry.signalStrength.toFixed(0)}%`, icon: ShieldAlert });
    }
    return a;
  })();

  const statusInfo = advisory ? STATUS_LABEL[advisory.status] : null;

  return (
    <Card className="bg-slate-900 border-slate-800 text-slate-100">
      <CardHeader className="py-3 border-b border-slate-800 flex flex-row items-center justify-between">
        <CardTitle className="text-xs font-mono uppercase tracking-widest text-cyan-400 flex items-center gap-2">
          <Bot className="h-4 w-4 text-cyan-400" /> Air Control Advisory
        </CardTitle>
        <Button size="sm" variant="ghost" className="h-7 text-cyan-400 hover:bg-slate-800 font-mono text-[9px]" onClick={evaluate} disabled={loading}>
          {loading ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <RefreshCw className="h-3 w-3 mr-1" />} EVALUATE
        </Button>
      </CardHeader>
      <CardContent className="p-4 space-y-3">
        {/* Dynamic Manned vs Unmanned Safety Rules */}
        {isMannedCommercial ? (
          <div className="bg-amber-950/20 border border-amber-900/60 rounded p-2.5 flex items-start gap-2">
            <Eye className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
            <div className="font-mono text-[9px] leading-tight">
              <span className="text-amber-400 font-bold block mb-0.5">COMMERCIAL TRAFFIC LINKED</span>
              Manned aviation safeguards are active. Telemetry data is read-only.
            </div>
          </div>
        ) : (
          <div className="bg-emerald-950/25 border border-emerald-900/50 rounded p-2.5 flex items-start gap-2">
            <ShieldCheck className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
            <div className="font-mono text-[9px] leading-tight">
              <span className="text-emerald-400 font-bold block mb-0.5">UNMANNED AUTO-PILOT ACTIVE</span>
              Full digital flight authority granted. Collision avoidance system armed.
            </div>
          </div>
        )}

        {advisory && statusInfo && (
          <div className="bg-slate-950 border border-slate-800 rounded p-3">
            <div className={`text-xs font-mono font-bold ${statusInfo.color}`}>{statusInfo.label}</div>
            <div className="text-[11px] text-slate-300 mt-1">{advisory.summary}</div>
            <div className="text-[10px] text-cyan-400 mt-2 font-mono">▶ {advisory.primary_recommendation}</div>
          </div>
        )}

        {/* Live local alerts */}
        {localAlerts.map((a) => (
          <div key={a.type} className={`p-2 rounded border flex items-start gap-2 font-mono text-[11px] ${SEVERITY_CLS[a.severity]}`}>
            <a.icon className="h-3 w-3 mt-0.5" /> {a.message}
          </div>
        ))}

        {/* AI alerts */}
        {advisory?.alerts?.map((a, i) => (
          <div key={`ai-${i}`} className={`p-2 rounded border font-mono text-[11px] ${SEVERITY_CLS[a.severity] || SEVERITY_CLS.info}`}>
            <div className="font-bold uppercase mb-0.5">{a.type.replace(/_/g, " ")}</div>
            <div>{a.message}</div>
          </div>
        ))}

        {!advisory && !localAlerts.length && !loading && (
          <div className="text-[11px] font-mono text-slate-500 italic">Telemetry nominal. Click EVALUATE for full AI assessment.</div>
        )}

        {error && <div className="text-[10px] font-mono text-red-400">⚠ {error}</div>}

        <div className="mt-3 pt-3 border-t border-slate-800 grid grid-cols-2 gap-3 text-[10px] font-mono">
          <div>
            <div className="text-slate-500 mb-1">SAFETY SCORE</div>
            <div className={`text-2xl font-bold ${(advisory?.safety_score ?? 100) >= 70 ? "text-emerald-400" : (advisory?.safety_score ?? 0) >= 40 ? "text-amber-400" : "text-red-400"}`}>
              {advisory?.safety_score?.toFixed(0) ?? "—"}<span className="text-xs text-slate-600">/100</span>
            </div>
          </div>
          <div>
            <div className="text-slate-500 mb-1">AIRSPACE ADVISORY</div>
            <div className="text-cyan-400 text-[10px] leading-tight">{advisory?.route_optimization || "Clear corridor flight pattern"}</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
export default DipaAiAdvisory;
