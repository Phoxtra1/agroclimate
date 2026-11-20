import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Cpu, RefreshCw, Copy, Thermometer, Droplets, Loader2, Ban } from "lucide-react";

type StationDevice = {
  id: string; device_name: string; hardware_id: string; model: string | null;
  status: "active" | "revoked"; harvest_entry_id: string | null; last_seen_at: string | null;
  created_at: string;
};
type StationObservation = {
  id: string; device_id: string; harvest_entry_id: string | null; observed_at: string;
  received_at: string; temperature_c: number; humidity_pct: number; sequence_no: number | null;
};

export function PostHarvestStationPanel({ entries }: { entries: { id: string; crop_name: string }[] }) {
  const { user } = useAuth();
  const [devices, setDevices] = useState<StationDevice[]>([]);
  const [observations, setObservations] = useState<StationObservation[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deviceName, setDeviceName] = useState("");
  const [hardwareId, setHardwareId] = useState("");
  const [model, setModel] = useState("");
  const [harvestEntryId, setHarvestEntryId] = useState("");
  const [issuedToken, setIssuedToken] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!user) {
      setDevices([]);
      setObservations([]);
      setIssuedToken(null);
      setLoading(false);
      return;
    }
    // Do not retain a previous account's station list or one-time device credential.
    setDevices([]);
    setObservations([]);
    setIssuedToken(null);
    setLoading(true);
    const [deviceResult, observationResult] = await Promise.all([
      supabase.from("post_harvest_station_devices" as any)
        .select("id,device_name,hardware_id,model,status,harvest_entry_id,last_seen_at,created_at")
        .eq("user_id", user.id).order("created_at", { ascending: false }),
      supabase.from("post_harvest_station_observations" as any)
        .select("id,device_id,harvest_entry_id,observed_at,received_at,temperature_c,humidity_pct,sequence_no")
        .eq("user_id", user.id).order("observed_at", { ascending: false }).limit(20),
    ]);
    if (deviceResult.error) toast.error("Could not load station registry", { description: deviceResult.error.message });
    else setDevices((deviceResult.data || []) as unknown as StationDevice[]);
    if (observationResult.error) toast.error("Could not load station readings", { description: observationResult.error.message });
    else setObservations((observationResult.data || []) as unknown as StationObservation[]);
    setLoading(false);
  }, [user]);

  useEffect(() => { void refresh(); }, [refresh]);
  useEffect(() => {
    if (!user) return;
    const channel = supabase.channel("post-harvest-station-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "post_harvest_station_devices", filter: `user_id=eq.${user.id}` }, () => void refresh())
      .on("postgres_changes", { event: "*", schema: "public", table: "post_harvest_station_observations", filter: `user_id=eq.${user.id}` }, () => void refresh())
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [user, refresh]);

  const register = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!deviceName.trim() || !hardwareId.trim()) return;
    setSaving(true);
    try {
      const { data, error } = await supabase.functions.invoke("post-harvest-station", {
        body: {
          action: "register", device_name: deviceName.trim(), hardware_id: hardwareId.trim(),
          model: model.trim() || null, harvest_entry_id: harvestEntryId || null,
        },
      });
      if (error) throw error;
      if (!data?.device_token) throw new Error(data?.error || "The gateway did not return a device credential.");
      setIssuedToken(data.device_token);
      setDeviceName(""); setHardwareId(""); setModel(""); setHarvestEntryId("");
      toast.success("Station registered. Save its token now; it will not be shown again.");
      await refresh();
    } catch (error) {
      toast.error("Could not register station", { description: error instanceof Error ? error.message : "Request failed" });
    } finally { setSaving(false); }
  };

  const revokeDevice = async (device: StationDevice) => {
    if (!confirm(`Revoke access for "${device.device_name}"? The station will no longer be able to upload readings.`)) return;
    const { data, error } = await supabase.functions.invoke("post-harvest-station", {
      body: { action: "revoke", device_id: device.id },
    });
    if (error || !data?.revoked) {
      toast.error("Could not revoke station", { description: data?.error || error?.message || "Request failed" });
      return;
    }
    toast.success("Station credential revoked");
    await refresh();
  };

  const copyToken = async () => {
    if (!issuedToken) return;
    try { await navigator.clipboard.writeText(issuedToken); toast.success("Device token copied"); }
    catch { toast.error("Clipboard unavailable. Select and copy the token manually."); }
  };

  const recentFor = (deviceId: string) => observations.find((o) => o.device_id === deviceId);
  const isRecentlySeen = (lastSeen: string | null) => !!lastSeen && Date.now() - new Date(lastSeen).getTime() <= 5 * 60_000;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><Cpu className="h-4 w-4" /> Register a Post-Harvest Station</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">Register a physical storage monitor and issue its one-time device credential. Registration alone does not mean the station is connected; connection is shown only after a real reading is received.</p>
          <form onSubmit={register} className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div><Label>Station name</Label><Input value={deviceName} onChange={(e) => setDeviceName(e.target.value)} placeholder="e.g. Main Store Sensor" maxLength={100} required /></div>
            <div><Label>Hardware ID / serial</Label><Input value={hardwareId} onChange={(e) => setHardwareId(e.target.value)} placeholder="Unique device serial" maxLength={160} required /></div>
            <div><Label>Model (optional)</Label><Input value={model} onChange={(e) => setModel(e.target.value)} placeholder="Sensor model" maxLength={100} /></div>
            <div><Label>Link to harvest (optional)</Label>
              <select className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={harvestEntryId} onChange={(e) => setHarvestEntryId(e.target.value)}>
                <option value="">No specific harvest</option>
                {entries.map((entry) => <option key={entry.id} value={entry.id}>{entry.crop_name}</option>)}
              </select>
            </div>
            <div className="sm:col-span-2"><Button type="submit" disabled={saving || !deviceName.trim() || !hardwareId.trim()}>{saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Cpu className="h-4 w-4 mr-2" />} Register station</Button></div>
          </form>
          {issuedToken && <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 space-y-2">
            <div className="font-semibold text-sm">Device credential — shown once</div>
            <p className="text-xs text-muted-foreground">Copy this token into the station's secure configuration now. Do not share it. The database stores only its SHA-256 hash.</p>
            <div className="flex gap-2"><Input readOnly value={issuedToken} className="font-mono text-xs" /><Button type="button" variant="outline" size="icon" onClick={copyToken}><Copy className="h-4 w-4" /></Button></div>
            <Button type="button" size="sm" variant="ghost" onClick={() => setIssuedToken(null)}>I have saved the token</Button>
          </div>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base">Registered stations &amp; sensor readings</CardTitle>
          <Button variant="outline" size="sm" onClick={() => void refresh()} disabled={loading}><RefreshCw className={`h-3 w-3 mr-1 ${loading ? "animate-spin" : ""}`} /> Refresh</Button>
        </CardHeader>
        <CardContent className="space-y-3">
          {loading ? <div className="py-5 text-center"><Loader2 className="h-5 w-5 animate-spin inline" /></div> :
            devices.length === 0 ? <p className="text-sm text-muted-foreground py-4">No Post-Harvest Stations registered yet.</p> :
            devices.map((device) => {
              const reading = recentFor(device.id);
              const seen = isRecentlySeen(device.last_seen_at);
              return <div key={device.id} className="rounded-lg border p-3 space-y-2">
                <div className="flex flex-wrap justify-between gap-2">
                  <div><div className="font-medium">{device.device_name}</div><div className="text-xs text-muted-foreground">{device.model || "Model not specified"} · {device.hardware_id}</div></div>
                  <div className="flex items-center gap-2"><Badge variant={device.status === "revoked" ? "destructive" : seen ? "default" : "secondary"}>{device.status === "revoked" ? "Revoked" : seen ? "Recently connected" : "Registered · no recent signal"}</Badge>{device.status === "active" && <Button size="sm" variant="outline" onClick={() => void revokeDevice(device)}><Ban className="h-3 w-3 mr-1" /> Revoke</Button>}</div>
                </div>
                {reading ? <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="rounded-md bg-muted p-2 flex items-center gap-2"><Thermometer className="h-4 w-4" /><span>{Number(reading.temperature_c).toFixed(1)} °C</span></div>
                  <div className="rounded-md bg-muted p-2 flex items-center gap-2"><Droplets className="h-4 w-4" /><span>{Number(reading.humidity_pct).toFixed(1)} % RH</span></div>
                </div> : <p className="text-xs text-muted-foreground">No sensor observations received.</p>}
                <p className="text-xs text-muted-foreground">Last device signal: {device.last_seen_at ? new Date(device.last_seen_at).toLocaleString() : "Never"}{reading ? ` · Latest reading: ${new Date(reading.observed_at).toLocaleString()}` : ""}</p>
              </div>;
            })}
          <p className="text-xs text-muted-foreground">Only authenticated device uploads appear here. These values are device-reported measurements, not laboratory verification of food safety. No physical station is assumed connected until its first successful upload.</p>
        </CardContent>
      </Card>
    </div>
  );
}
