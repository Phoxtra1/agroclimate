import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Layers, Activity, Zap, ScrollText, Bell, Save, Download, Filter } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAiModel } from "@/hooks/useAiModel";
import { supabase } from "@/integrations/supabase/client";
import { DipaMonitoringConsole } from "@/components/admin/DipaMonitoringConsole";

interface UsageRow { id: string; model: string; action: string; latency_ms: number | null; ok: boolean; error: string | null; created_at: string; }

export default function AIEngine() {
  const { toast } = useToast();
  const { model, models, setActiveModel, loading } = useAiModel();

  const [systemPrompt, setSystemPrompt] = useState("");
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [predictionsEnabled, setPredictionsEnabled] = useState(true);
  const [logs, setLogs] = useState<UsageRow[]>([]);
  const [savingPrompt, setSavingPrompt] = useState(false);
  const [savingToggles, setSavingToggles] = useState(false);

  // Load persisted admin toggles + prompt
  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("system_settings").select("key,value")
        .in("key", ["ai_system_prompt", "ai_notifications_enabled", "ai_predictions_enabled"]);
      for (const row of data || []) {
        if (row.key === "ai_system_prompt") setSystemPrompt(((row.value as any)?.text) || "");
        if (row.key === "ai_notifications_enabled") setNotificationsEnabled(!!((row.value as any)?.enabled));
        if (row.key === "ai_predictions_enabled") setPredictionsEnabled(!!((row.value as any)?.enabled));
      }
    })();
  }, []);

  // Live usage logs
  useEffect(() => {
    const load = async () => {
      const { data } = await supabase.from("ai_usage_logs").select("*").order("created_at", { ascending: false }).limit(50);
      setLogs((data as any) || []);
    };
    load();
    const ch = supabase.channel("ai_usage_live")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "ai_usage_logs" },
        (payload) => setLogs((p) => [payload.new as any, ...p].slice(0, 50)))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  const savePrompt = async () => {
    setSavingPrompt(true);
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from("system_settings").upsert(
      { key: "ai_system_prompt", value: { text: systemPrompt } as any, updated_by: user?.id ?? null },
      { onConflict: "key" }
    );
    setSavingPrompt(false);
    toast({ title: error ? "Save failed" : "System prompt saved", description: error?.message, variant: error ? "destructive" : "default" });
  };

  const saveToggles = async () => {
    setSavingToggles(true);
    const { data: { user } } = await supabase.auth.getUser();
    await supabase.from("system_settings").upsert(
      { key: "ai_notifications_enabled", value: { enabled: notificationsEnabled } as any, updated_by: user?.id ?? null },
      { onConflict: "key" }
    );
    await supabase.from("system_settings").upsert(
      { key: "ai_predictions_enabled", value: { enabled: predictionsEnabled } as any, updated_by: user?.id ?? null },
      { onConflict: "key" }
    );
    setSavingToggles(false);
    toast({ title: "AI controls saved" });
  };

  const chooseModel = async (id: string) => {
    const m = models.find((x) => x.id === id);
    if (!m) return;
    await setActiveModel(m);
    toast({ title: `Active AI model: ${m.label}`, description: "Every AgroClimate component will use this engine on the next request." });
  };

  const totalCalls = logs.length;
  const ok = logs.filter((l) => l.ok).length;
  const avgMs = logs.length ? Math.round(logs.reduce((s, l) => s + (l.latency_ms || 0), 0) / logs.length) : 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Layers className="h-6 w-6 text-primary" />
        <div>
          <h2 className="text-xl font-bold">AI Layer — Operations Center</h2>
          <p className="text-xs text-muted-foreground">Centralized intelligence for Weather, Alerts, Flight Advisory, AgroRisk, Handlers, Inventory, Post-Harvest, Market Link, AGNav & Environmental modules.</p>
        </div>
      </div>

      {/* Model Manager */}
      <Card>
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><Zap className="h-4 w-4" /> Active AI Model</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-2">
            <Label>Model powering all AgroClimate AI components</Label>
            <Select value={model.id} onValueChange={chooseModel} disabled={loading}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {models.map((m) => (
                  <SelectItem key={m.id} value={m.id}>{m.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">{models.find((m) => m.id === model.id)?.description}</p>
            <div className="text-xs text-muted-foreground">Gateway route: <code>{model.gatewayModel}</code></div>
          </div>
        </CardContent>
      </Card>

      {/* Dipa Health & Feedback Monitoring Console */}
      <DipaMonitoringConsole />

      {/* Usage snapshot with filters + CSV export */}
      <AiLogsPanel logs={logs} models={models} totalCalls={totalCalls} ok={ok} avgMs={avgMs} />


      {/* Prompt manager */}
      <Card>
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><ScrollText className="h-4 w-4" /> Global System Prompt</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <Textarea rows={5} value={systemPrompt} onChange={(e) => setSystemPrompt(e.target.value)} placeholder="Guidance appended to every AI call across AgroClimate modules." />
          <Button onClick={savePrompt} disabled={savingPrompt}><Save className="mr-2 h-4 w-4" />{savingPrompt ? "Saving…" : "Save Prompt"}</Button>
        </CardContent>
      </Card>

      {/* Notification + prediction controls */}
      <Card>
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><Bell className="h-4 w-4" /> AI Controls</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label>Intelligent notifications</Label>
              <p className="text-xs text-muted-foreground">Allow the AI Layer to trigger cross-module alerts.</p>
            </div>
            <Switch checked={notificationsEnabled} onCheckedChange={setNotificationsEnabled} />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <Label>Predictive insights</Label>
              <p className="text-xs text-muted-foreground">Enable forecasts, risk scoring, and correlations.</p>
            </div>
            <Switch checked={predictionsEnabled} onCheckedChange={setPredictionsEnabled} />
          </div>
          <Button onClick={saveToggles} disabled={savingToggles}><Save className="mr-2 h-4 w-4" />{savingToggles ? "Saving…" : "Save Controls"}</Button>
        </CardContent>
      </Card>
    </div>
  );
}

function AiLogsPanel({ logs, models, totalCalls, ok, avgMs }: { logs: UsageRow[]; models: any[]; totalCalls: number; ok: number; avgMs: number; }) {
  const [from, setFrom] = useState<string>("");
  const [to, setTo] = useState<string>("");
  const [action, setAction] = useState<string>("all");
  const [modelFilter, setModelFilter] = useState<string>("all");
  const [status, setStatus] = useState<string>("all");

  const actions = useMemo(() => Array.from(new Set(logs.map(l => l.action))).sort(), [logs]);
  const modelIds = useMemo(() => Array.from(new Set(logs.map(l => l.model))).sort(), [logs]);

  const filtered = useMemo(() => logs.filter(l => {
    const t = new Date(l.created_at).getTime();
    if (from && t < new Date(from).getTime()) return false;
    if (to && t > new Date(to).getTime() + 86400000) return false;
    if (action !== "all" && l.action !== action) return false;
    if (modelFilter !== "all" && l.model !== modelFilter) return false;
    if (status === "ok" && !l.ok) return false;
    if (status === "err" && l.ok) return false;
    return true;
  }), [logs, from, to, action, modelFilter, status]);

  const exportCsv = () => {
    const rows = [["timestamp", "action", "model", "status", "latency_ms", "error"]];
    filtered.forEach(l => rows.push([
      l.created_at, l.action, l.model, l.ok ? "ok" : "err",
      String(l.latency_ms ?? ""), (l.error || "").replace(/\n/g, " "),
    ]));
    const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `agroclimate-ai-logs-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
  };

  const fok = filtered.filter(l => l.ok).length;
  const favg = filtered.length ? Math.round(filtered.reduce((s, l) => s + (l.latency_ms || 0), 0) / filtered.length) : 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Activity className="h-4 w-4" /> AI Usage Logs
          <Badge variant="outline" className="ml-2 text-[10px]">{filtered.length} / {logs.length}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 md:grid-cols-6 gap-2 items-end">
          <div><Label className="text-[10px]">From</Label><Input type="date" value={from} onChange={e => setFrom(e.target.value)} className="h-8" /></div>
          <div><Label className="text-[10px]">To</Label><Input type="date" value={to} onChange={e => setTo(e.target.value)} className="h-8" /></div>
          <div>
            <Label className="text-[10px]">Component / Action</Label>
            <Select value={action} onValueChange={setAction}>
              <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                {actions.map(a => <SelectItem key={a} value={a}>{a}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-[10px]">Model</Label>
            <Select value={modelFilter} onValueChange={setModelFilter}>
              <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                {modelIds.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-[10px]">Status</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="ok">OK</SelectItem>
                <SelectItem value="err">Errors</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button size="sm" variant="outline" onClick={exportCsv}><Download className="h-4 w-4 mr-1" /> CSV</Button>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div className="p-2 rounded border text-center"><p className="text-[10px] text-muted-foreground">Filtered calls</p><p className="text-lg font-bold">{filtered.length}</p></div>
          <div className="p-2 rounded border text-center"><p className="text-[10px] text-muted-foreground">Success</p><p className="text-lg font-bold">{filtered.length ? Math.round((fok / filtered.length) * 100) : 0}%</p></div>
          <div className="p-2 rounded border text-center"><p className="text-[10px] text-muted-foreground">Avg latency</p><p className="text-lg font-bold">{favg} ms</p></div>
        </div>

        <div className="border rounded max-h-80 overflow-auto text-xs">
          {filtered.length === 0 && <p className="p-4 text-muted-foreground">No AI calls match the filters.</p>}
          {filtered.map((l) => (
            <div key={l.id} className="flex items-center gap-2 p-2 border-b last:border-0">
              <Badge variant={l.ok ? "default" : "destructive"} className="text-[10px]">{l.ok ? "OK" : "ERR"}</Badge>
              <span className="font-mono">{l.action}</span>
              <span className="text-muted-foreground truncate">{l.model}</span>
              <span className="ml-auto text-muted-foreground">{l.latency_ms ?? "—"}ms</span>
              <span className="text-muted-foreground">{new Date(l.created_at).toLocaleString()}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

