import React, { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plane, Plus, Trash2, History, ChevronDown, ChevronUp } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { SUPPORTED_PROTOCOLS } from "@/lib/drone/connectionManager";
import { getConnectionEvents, type ConnectionEvent } from "@/lib/drone/eventLog";

const AIRCRAFT_TYPES = [
  "drone", "helicopter", "fixed_wing", "air_ambulance", "cargo", "evtol", "survey", "maritime_patrol", "custom",
];

interface Aircraft {
  id: string; name: string; model: string; protocol: string; status: string;
  aircraft_type?: string; manufacturer?: string; operator?: string; home_base?: string;
  last_handshake_at?: string; last_seen_at?: string;
}

export function AircraftRegistry() {
  const { toast } = useToast();
  const [list, setList] = useState<Aircraft[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ name: "", model: "", manufacturer: "", aircraft_type: "drone", protocol: "aih", operator: "", home_base: "" });
  const [adding, setAdding] = useState(false);

  const refresh = async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }
    const { data } = await supabase.from("drones").select("*").eq("user_id", user.id).order("created_at", { ascending: false });
    setList((data || []) as any);
    setLoading(false);
  };
  useEffect(() => { refresh(); }, []);

  const register = async () => {
    if (!form.name.trim()) { toast({ title: "Aircraft name required", variant: "destructive" }); return; }
    setAdding(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Sign in to register aircraft");
      const { error } = await supabase.from("drones").insert({ ...form, user_id: user.id, status: "offline" } as any);
      if (error) throw error;
      toast({ title: "Aircraft registered" });
      setForm({ name: "", model: "", manufacturer: "", aircraft_type: "drone", protocol: "aih", operator: "", home_base: "" });
      refresh();
    } catch (e: any) {
      toast({ title: "Could not register", description: e.message, variant: "destructive" });
    } finally { setAdding(false); }
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from("drones").delete().eq("id", id);
    if (error) toast({ title: "Delete failed", description: error.message, variant: "destructive" });
    else refresh();
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <Card className="bg-slate-900 border-slate-800 text-slate-100 lg:col-span-1">
        <CardHeader className="py-3 border-b border-slate-800">
          <CardTitle className="text-xs font-mono uppercase tracking-widest text-cyan-400 flex items-center gap-2">
            <Plus className="h-3.5 w-3.5" /> Register Aircraft
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4 space-y-3">
          <Field label="Aircraft name" v={form.name} on={(v) => setForm({ ...form, name: v })} />
          <Field label="Model" v={form.model} on={(v) => setForm({ ...form, model: v })} />
          <Field label="Manufacturer" v={form.manufacturer} on={(v) => setForm({ ...form, manufacturer: v })} />
          <div className="space-y-1">
            <Label className="text-[10px] uppercase font-mono text-slate-400">Type</Label>
            <Select value={form.aircraft_type} onValueChange={(v) => setForm({ ...form, aircraft_type: v })}>
              <SelectTrigger className="bg-slate-950 border-slate-800 text-slate-100 h-9 font-mono"><SelectValue /></SelectTrigger>
              <SelectContent className="bg-slate-900 border-slate-800 text-slate-100 font-mono">
                {AIRCRAFT_TYPES.map((t) => <SelectItem key={t} value={t}>{t.replace("_", " ").toUpperCase()}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-[10px] uppercase font-mono text-slate-400">Protocol</Label>
            <Select value={form.protocol} onValueChange={(v) => setForm({ ...form, protocol: v })}>
              <SelectTrigger className="bg-slate-950 border-slate-800 text-slate-100 h-9 font-mono"><SelectValue /></SelectTrigger>
              <SelectContent className="bg-slate-900 border-slate-800 text-slate-100 font-mono">
                {SUPPORTED_PROTOCOLS.map((p) => <SelectItem key={p.id} value={p.id}>{p.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <Field label="Operator" v={form.operator} on={(v) => setForm({ ...form, operator: v })} />
          <Field label="Home base" v={form.home_base} on={(v) => setForm({ ...form, home_base: v })} />
          <Button onClick={register} disabled={adding} className="w-full bg-cyan-600 hover:bg-cyan-500 text-white font-mono">
            <Plus className="h-3.5 w-3.5 mr-2" /> Register
          </Button>
        </CardContent>
      </Card>

      <Card className="bg-slate-900 border-slate-800 text-slate-100 lg:col-span-2">
        <CardHeader className="py-3 border-b border-slate-800">
          <CardTitle className="text-xs font-mono uppercase tracking-widest text-slate-300 flex items-center gap-2">
            <Plane className="h-3.5 w-3.5" /> Aircraft Registry
            <Badge variant="outline" className="border-slate-700 text-slate-400 text-[10px]">{list.length}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-3 space-y-2 max-h-[560px] overflow-y-auto">
          {loading && <p className="text-xs text-slate-500 font-mono">Loading…</p>}
          {!loading && list.length === 0 && <p className="text-xs text-slate-500 font-mono">No aircraft registered. Add your first above.</p>}
          {list.map((a) => (
            <div key={a.id} className="rounded-lg border border-slate-800 bg-slate-950 p-3 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-mono font-bold text-cyan-300 truncate">{a.name}</span>
                  <Badge variant="outline" className="text-[9px] border-slate-700 text-slate-400 uppercase">{a.aircraft_type || "drone"}</Badge>
                  <Badge variant="outline" className="text-[9px] border-slate-700 text-slate-400">{a.protocol}</Badge>
                </div>
                <div className="text-[10px] font-mono text-slate-500 uppercase mt-1 grid grid-cols-2 gap-x-3">
                  <span>MODEL: {a.model || "—"}</span>
                  <span>MFR: {a.manufacturer || "—"}</span>
                  <span>OPERATOR: {a.operator || "—"}</span>
                  <span>BASE: {a.home_base || "—"}</span>
                  <span className="col-span-2 flex items-center gap-1"><History className="h-3 w-3" /> LAST SEEN: {a.last_seen_at ? new Date(a.last_seen_at).toLocaleString() : "never"}</span>
                </div>
              </div>
              <Button size="sm" variant="ghost" className="text-red-400 hover:bg-red-950/40" onClick={() => remove(a.id)}>
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

function Field({ label, v, on }: { label: string; v: string; on: (v: string) => void }) {
  return (
    <div className="space-y-1">
      <Label className="text-[10px] uppercase font-mono text-slate-400">{label}</Label>
      <Input value={v} onChange={(e) => on(e.target.value)} className="h-9 bg-slate-950 border-slate-800 text-slate-100 font-mono" />
    </div>
  );
}
