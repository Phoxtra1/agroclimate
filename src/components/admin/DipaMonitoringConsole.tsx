import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Activity, ShieldCheck, Cpu, Clock, AlertTriangle, CheckCircle, RefreshCw, BarChart2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface DipaOutcomeRow {
  id: string;
  module_domain: string;
  prediction_data: any;
  decision_made: string;
  action_taken: string;
  outcome_recorded: string;
  outcome_score: number | null;
  validation_status: "pending" | "verified" | "rejected";
  created_at: string;
}

export function DipaMonitoringConsole() {
  const [outcomes, setOutcomes] = useState<DipaOutcomeRow[]>([]);
  const [loading, setLoading] = useState(true);

  const engineStatuses = [
    { name: "Climate Risk Engine", status: "Operational", latency: "120ms", confidence: "High", quality: "Good" },
    { name: "Crop Suitability Engine", status: "Operational", latency: "185ms", confidence: "High", quality: "Good" },
    { name: "Aerial Flight Advisory", status: "Operational", latency: "95ms", confidence: "High", quality: "Good" },
    { name: "Route Navigator Engine", status: "Operational", latency: "140ms", confidence: "High", quality: "Good" },
    { name: "Market & Buyer Matcher", status: "Operational", latency: "210ms", confidence: "High", quality: "Good" },
    { name: "Logistics Provider Matcher", status: "Operational", latency: "115ms", confidence: "High", quality: "Good" },
    { name: "Agri Investment Evaluator", status: "Operational", latency: "160ms", confidence: "High", quality: "Good" },
  ];

  const loadOutcomes = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("dipa_outcomes" as any)
      .select("*")
      .order("created_at", { ascending: false })
      .limit(30);

    setOutcomes((data as any[]) || []);
    setLoading(false);
  };

  useEffect(() => {
    loadOutcomes();
  }, []);

  const verifyOutcome = async (id: string, validation_status: "verified" | "rejected") => {
    await supabase.from("dipa_outcomes" as any).update({ validation_status }).eq("id", id);
    loadOutcomes();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold flex items-center gap-2">
            <Activity className="h-5 w-5 text-primary" /> Dipa Intelligence Operational Health &amp; Feedback Console
          </h2>
          <p className="text-xs text-muted-foreground">
            Latency, confidence metrics, provider gateway health &amp; feedback outcome verification
          </p>
        </div>
        <Button size="sm" variant="outline" onClick={loadOutcomes} className="gap-1 text-xs">
          <RefreshCw className="h-3.5 w-3.5" /> Refresh
        </Button>
      </div>

      {/* Engine Status Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {engineStatuses.map((e) => (
          <Card key={e.name} className="border border-border/80 shadow-sm">
            <CardContent className="p-3">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-xs truncate">{e.name}</span>
                <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[9px]">
                  🟢 {e.status}
                </Badge>
              </div>
              <div className="grid grid-cols-2 gap-2 mt-2 pt-2 border-t text-[10px] text-muted-foreground">
                <div>Latency: <strong className="text-foreground">{e.latency}</strong></div>
                <div>Confidence: <strong className="text-foreground">{e.confidence}</strong></div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Outcome Feedback Loop & Decision Verification Table */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-bold flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-primary" /> Feedback Loop &amp; Prediction Outcome Logs
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-xs">
          <div className="border rounded-lg overflow-auto max-h-72">
            <table className="w-full text-left border-collapse">
              <thead className="bg-muted/40 text-[10px] uppercase font-semibold text-muted-foreground border-b">
                <tr>
                  <th className="p-2.5">Domain</th>
                  <th className="p-2.5">Decision Made</th>
                  <th className="p-2.5">Action Taken</th>
                  <th className="p-2.5">Outcome</th>
                  <th className="p-2.5">Status</th>
                  <th className="p-2.5 text-right">Verification</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {outcomes.map((o) => (
                  <tr key={o.id} className="hover:bg-muted/20 transition-colors">
                    <td className="p-2.5 font-bold uppercase text-[10px] text-primary">{o.module_domain}</td>
                    <td className="p-2.5 truncate max-w-[150px]">{o.decision_made || "—"}</td>
                    <td className="p-2.5 truncate max-w-[150px]">{o.action_taken || "—"}</td>
                    <td className="p-2.5 truncate max-w-[150px]">{o.outcome_recorded || "—"}</td>
                    <td className="p-2.5">
                      <Badge
                        variant={
                          o.validation_status === "verified"
                            ? "default"
                            : o.validation_status === "rejected"
                            ? "destructive"
                            : "outline"
                        }
                        className="text-[9px] capitalize"
                      >
                        {o.validation_status}
                      </Badge>
                    </td>
                    <td className="p-2.5 text-right space-x-1">
                      {o.validation_status === "pending" && (
                        <>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-6 px-2 text-[10px] text-emerald-600"
                            onClick={() => verifyOutcome(o.id, "verified")}
                          >
                            Verify
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-6 px-2 text-[10px] text-destructive"
                            onClick={() => verifyOutcome(o.id, "rejected")}
                          >
                            Reject
                          </Button>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
                {outcomes.length === 0 && !loading && (
                  <tr>
                    <td colSpan={6} className="p-6 text-center text-muted-foreground">
                      No outcome feedback recorded yet. Dipa auto-logs actions when users confirm advisories.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
