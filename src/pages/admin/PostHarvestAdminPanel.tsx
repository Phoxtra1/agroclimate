import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Archive, AlertTriangle, Loader2 } from "lucide-react";
import { computeRisk, type HarvestEntry, type RiskLevel } from "@/hooks/usePostHarvest";
import { toast } from "sonner";

function badge(level: RiskLevel) {
  const cls = level === "danger" ? "bg-red-500 text-white" : level === "warning" ? "bg-yellow-500 text-black" : "bg-green-600 text-white";
  return <Badge className={cls}>{level}</Badge>;
}

export default function PostHarvestAdminPanel() {
  const [entries, setEntries] = useState<HarvestEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAll = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("post_harvest_entries" as any)
      .select("*")
      .order("harvest_date", { ascending: false })
      .limit(500);
    setEntries((data || []) as unknown as HarvestEntry[]);
    setLoading(false);
  };

  useEffect(() => { fetchAll(); }, []);

  const setOverride = async (id: string, override: string | null) => {
    const { error } = await supabase
      .from("post_harvest_entries" as any)
      .update({ risk_override: override } as any)
      .eq("id", id);
    if (error) toast.error("Could not update"); else { toast.success("Risk rule updated"); fetchAll(); }
  };

  const aggregates = (() => {
    const byCrop: Record<string, { count: number; danger: number }> = {};
    entries.forEach((e) => {
      const k = e.crop_name.toLowerCase();
      byCrop[k] = byCrop[k] || { count: 0, danger: 0 };
      byCrop[k].count++;
      if (computeRisk(e).level === "danger") byCrop[k].danger++;
    });
    const top = Object.entries(byCrop).sort((a, b) => b[1].danger - a[1].danger).slice(0, 5);
    return { top, totalDanger: entries.filter((e) => computeRisk(e).level === "danger").length };
  })();

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 mb-2">
        <Archive className="h-6 w-6 text-primary" />
        <h1 className="text-xl font-bold">Post-Harvest Tracker — Admin</h1>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card><CardContent className="pt-4 text-center"><p className="text-2xl font-bold">{entries.length}</p><p className="text-xs text-muted-foreground">Total entries</p></CardContent></Card>
        <Card><CardContent className="pt-4 text-center"><p className="text-2xl font-bold text-red-500">{aggregates.totalDanger}</p><p className="text-xs text-muted-foreground">High-risk</p></CardContent></Card>
        <Card><CardContent className="pt-4 text-center"><p className="text-2xl font-bold">{new Set(entries.map((e) => e.user_id)).size}</p><p className="text-xs text-muted-foreground">Active farmers</p></CardContent></Card>
        <Card><CardContent className="pt-4 text-center"><p className="text-2xl font-bold">{aggregates.top[0]?.[0] || "—"}</p><p className="text-xs text-muted-foreground">Most-affected crop</p></CardContent></Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Spoilage trends by crop</CardTitle></CardHeader>
        <CardContent>
          {aggregates.top.length === 0 ? (
            <p className="text-sm text-muted-foreground">No data yet.</p>
          ) : (
            <div className="space-y-2">
              {aggregates.top.map(([crop, agg]) => (
                <div key={crop} className="flex items-center justify-between text-sm">
                  <span className="capitalize">{crop}</span>
                  <span className="text-muted-foreground">{agg.count} entries · <span className="text-red-500">{agg.danger} high-risk</span></span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">All harvest records</CardTitle></CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-6"><Loader2 className="h-5 w-5 animate-spin inline" /></div>
          ) : entries.length === 0 ? (
            <p className="text-sm text-muted-foreground">No entries logged yet.</p>
          ) : (
            <div className="space-y-2 max-h-[60vh] overflow-y-auto">
              {entries.map((e) => {
                const risk = computeRisk(e);
                return (
                  <div key={e.id} className="border rounded-lg p-3 flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold">{e.crop_name}</span>
                        <span className="text-xs text-muted-foreground">{Number(e.quantity)} {e.unit}</span>
                        {badge(risk.level)}
                        {e.risk_override && <Badge variant="outline" className="text-[10px]">override</Badge>}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        {risk.days}d · {e.storage_method || "—"} · {e.storage_location || "—"} · user {e.user_id.slice(0, 8)}
                      </p>
                    </div>
                    <div className="shrink-0">
                      <Select
                        value={e.risk_override ?? "auto"}
                        onValueChange={(v) => setOverride(e.id, v === "auto" ? null : v)}
                      >
                        <SelectTrigger className="w-32 h-8 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="auto">Auto</SelectItem>
                          <SelectItem value="safe">Force Safe</SelectItem>
                          <SelectItem value="warning">Force Warning</SelectItem>
                          <SelectItem value="danger">Force Danger</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-red-500" /> Trigger broadcast alert</CardTitle></CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground mb-3">Use the existing Alert Engine to publish a disaster alert to all farmers — high-risk spoilage trends should drive a region-wide warning.</p>
          <Button variant="outline" size="sm" onClick={() => toast.info("Open the Alert Engine tab to publish a new alert.")}>Go to Alert Engine</Button>
        </CardContent>
      </Card>
    </div>
  );
}
