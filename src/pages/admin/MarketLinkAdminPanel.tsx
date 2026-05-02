import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Store, Trash2, AlertTriangle, Loader2 } from "lucide-react";
import { useMarketLink } from "@/hooks/useMarketLink";

export default function MarketLinkAdminPanel() {
  const m = useMarketLink();
  const [crop, setCrop] = useState("");
  const [region, setRegion] = useState("");
  const [current, setCurrent] = useState("");
  const [suggested, setSuggested] = useState("");
  const [trend, setTrend] = useState<"rising" | "falling" | "stable">("stable");
  const [unit, setUnit] = useState("kg");
  const [busy, setBusy] = useState(false);

  const [alertTitle, setAlertTitle] = useState("");
  const [alertDesc, setAlertDesc] = useState("");
  const [alertSev, setAlertSev] = useState<"info" | "warning" | "danger">("warning");
  const [alertBusy, setAlertBusy] = useState(false);

  const upsertPrice = async () => {
    if (!crop) return toast.error("Crop required");
    setBusy(true);
    const { error } = await supabase.from("price_intelligence" as any).insert({
      crop_name: crop, region: region || null,
      current_price: Number(current || 0), suggested_price: Number(suggested || 0),
      trend, unit,
    } as any);
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Price reference added");
    setCrop(""); setRegion(""); setCurrent(""); setSuggested("");
  };

  const removePrice = async (id: string) => {
    await supabase.from("price_intelligence" as any).delete().eq("id", id);
  };

  const issueAlert = async () => {
    if (!alertTitle) return toast.error("Title required");
    setAlertBusy(true);
    const { error } = await supabase.from("disaster_alerts").insert({
      title: alertTitle, description: alertDesc, severity: alertSev,
      alert_type: "market", active: true,
    });
    setAlertBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Market alert issued");
    setAlertTitle(""); setAlertDesc("");
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 mb-2">
        <Store className="h-6 w-6 text-primary" />
        <h1 className="text-xl font-bold">Market Link Control</h1>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card><CardContent className="pt-4 text-center"><p className="text-2xl font-bold">{m.totalSupply.toLocaleString()}</p><p className="text-xs text-muted-foreground">Supply units</p></CardContent></Card>
        <Card><CardContent className="pt-4 text-center"><p className="text-2xl font-bold">{m.totalDemand.toLocaleString()}</p><p className="text-xs text-muted-foreground">Demand units</p></CardContent></Card>
        <Card><CardContent className="pt-4 text-center"><p className="text-2xl font-bold">{m.contracts.length}</p><p className="text-xs text-muted-foreground">Contracts</p></CardContent></Card>
        <Card><CardContent className="pt-4 text-center"><p className="text-2xl font-bold capitalize">{m.balance}</p><p className="text-xs text-muted-foreground">Market balance</p></CardContent></Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Adjust price intelligence</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 lg:grid-cols-6 gap-2">
            <div><Label>Crop</Label><Input value={crop} onChange={(e) => setCrop(e.target.value)} /></div>
            <div><Label>Region</Label><Input value={region} onChange={(e) => setRegion(e.target.value)} /></div>
            <div><Label>Current</Label><Input type="number" value={current} onChange={(e) => setCurrent(e.target.value)} /></div>
            <div><Label>Suggested</Label><Input type="number" value={suggested} onChange={(e) => setSuggested(e.target.value)} /></div>
            <div><Label>Trend</Label>
              <Select value={trend} onValueChange={(v) => setTrend(v as any)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="rising">Rising</SelectItem>
                  <SelectItem value="falling">Falling</SelectItem>
                  <SelectItem value="stable">Stable</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div><Label>Unit</Label><Input value={unit} onChange={(e) => setUnit(e.target.value)} /></div>
          </div>
          <Button onClick={upsertPrice} disabled={busy}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Add price reference"}
          </Button>

          <div className="space-y-1 mt-3">
            {m.prices.map((p) => (
              <div key={p.id} className="flex items-center justify-between border rounded p-2 text-sm">
                <span>{p.crop_name} {p.region ? `· ${p.region}` : ""} — {p.current_price}/{p.unit} → {p.suggested_price}/{p.unit} <Badge variant="outline" className="capitalize ml-2">{p.trend}</Badge></span>
                <Button size="sm" variant="ghost" className="text-red-500" onClick={() => removePrice(p.id)}><Trash2 className="h-3 w-3" /></Button>
              </div>
            ))}
            {m.prices.length === 0 && <p className="text-xs text-muted-foreground">No price entries.</p>}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><AlertTriangle className="h-4 w-4" /> Issue market risk alert</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          <Input placeholder="Alert title" value={alertTitle} onChange={(e) => setAlertTitle(e.target.value)} />
          <Input placeholder="Description" value={alertDesc} onChange={(e) => setAlertDesc(e.target.value)} />
          <Select value={alertSev} onValueChange={(v) => setAlertSev(v as any)}>
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="info">Info</SelectItem>
              <SelectItem value="warning">Warning</SelectItem>
              <SelectItem value="danger">Danger</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={issueAlert} disabled={alertBusy}>
            {alertBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Broadcast alert"}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Latest contracts</CardTitle></CardHeader>
        <CardContent>
          {m.contracts.slice(0, 10).map((c) => (
            <div key={c.id} className="text-sm border-b py-2 flex items-center gap-2 flex-wrap">
              <span className="font-medium">{c.crop_name}</span>
              <span className="text-muted-foreground">{Number(c.quantity).toLocaleString()} {c.unit} @ {c.locked_price}/{c.unit}</span>
              <Badge variant="outline" className="capitalize">{c.state}</Badge>
              <Badge variant="outline" className="capitalize">{c.logistics_status}</Badge>
            </div>
          ))}
          {m.contracts.length === 0 && <p className="text-xs text-muted-foreground">No contracts yet.</p>}
        </CardContent>
      </Card>
    </div>
  );
}
