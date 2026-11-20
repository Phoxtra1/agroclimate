import { useCallback, useEffect, useState } from "react";
import { Activity, CheckCircle2, Clock3, Copy, Loader2, Plus, RefreshCw, ShieldAlert, Unplug, Wifi, WifiOff } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import {
  listSharedDevices, listSharedDeviceObservations, registerSharedDevice, revokeSharedDevice,
  type SharedDevice, type SharedDeviceComponent, type SharedDeviceObservation, type SharedDeviceProtocol,
} from "@/services/hardware/deviceGateway";

const PROTOCOLS: SharedDeviceProtocol[] = [
  "manual", "https-api", "ble-gatt", "usb-hid", "usb-serial", "mqtt-tls",
  "browser-camera", "browser-geolocation", "mavlink", "vendor-sdk", "satellite-api",
];
const TITLES: Record<SharedDeviceComponent, string> = {
  "farm-handler": "Farm Handler", "agro-inventory": "Agro Inventory",
  "market-link": "Market Link", agtrans: "AGTrans", agroforecast: "AgroForecast",
  agrorisk: "AgroRisk", "aerial-console": "Aerial Console", satellite: "Satellite",
};

function readableDate(value: string | null) {
  if (!value) return "Not yet received";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Unknown" : date.toLocaleString();
}

export function SharedDevicePanel({ component }: { component: SharedDeviceComponent }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [devices, setDevices] = useState<SharedDevice[]>([]);
  const [observations, setObservations] = useState<SharedDeviceObservation[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [oneTimeToken, setOneTimeToken] = useState<string | null>(null);
  const [form, setForm] = useState({
    device_name: "", hardware_id: "", manufacturer: "", model: "",
    firmware_version: "", protocol: "manual" as SharedDeviceProtocol,
    capabilities: "", farm_id: "", site_id: "",
  });

  const refresh = useCallback(async () => {
    if (!user) {
      setDevices([]);
      setObservations([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [deviceRows, observationRows] = await Promise.all([
        listSharedDevices(component), listSharedDeviceObservations(component),
      ]);
      setDevices(deviceRows);
      setObservations(observationRows);
    } catch (error) {
      toast({
        title: "Device information is unavailable",
        description: error instanceof Error ? error.message : "The shared device gateway may not yet be deployed.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [component, user?.id, toast]);

  useEffect(() => { void refresh(); }, [refresh]);

  const submitRegistration = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!form.device_name.trim() || !form.hardware_id.trim()) {
      toast({ title: "Device name and hardware ID are required.", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const result = await registerSharedDevice({
        component,
        device_name: form.device_name.trim(),
        hardware_id: form.hardware_id.trim(),
        manufacturer: form.manufacturer.trim() || undefined,
        model: form.model.trim() || undefined,
        firmware_version: form.firmware_version.trim() || undefined,
        protocol: form.protocol,
        capabilities: form.capabilities.split(",").map(v => v.trim()).filter(Boolean).slice(0, 32),
        farm_id: form.farm_id.trim() || undefined,
        site_id: form.site_id.trim() || undefined,
      });
      setOneTimeToken(result.device_token);
      setShowForm(false);
      setForm({ device_name: "", hardware_id: "", manufacturer: "", model: "", firmware_version: "", protocol: "manual", capabilities: "", farm_id: "", site_id: "" });
      toast({ title: "Device registered", description: "The device credential is shown once. Copy it to a protected device or gateway secret store." });
      await refresh();
    } catch (error) {
      toast({ title: "Could not register device", description: error instanceof Error ? error.message : "Please retry.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const revoke = async (device: SharedDevice) => {
    if (!window.confirm(`Revoke access for "${device.device_name}"? Historical observations will be retained.`)) return;
    setRevokingId(device.id);
    try {
      await revokeSharedDevice(device.id);
      toast({ title: "Device access revoked", description: "Historical observations remain available." });
      await refresh();
    } catch (error) {
      toast({ title: "Could not revoke device", description: error instanceof Error ? error.message : "Please retry.", variant: "destructive" });
    } finally {
      setRevokingId(null);
    }
  };

  const copyToken = async () => {
    if (!oneTimeToken) return;
    try {
      await navigator.clipboard.writeText(oneTimeToken);
      toast({ title: "Credential copied", description: "Move it to a protected secret store. Do not put it in browser storage or source code." });
    } catch {
      toast({ title: "Clipboard unavailable", description: "Select and copy the credential manually.", variant: "destructive" });
    }
  };

  if (!user) return null;

  return (
    <Card className="border-primary/20">
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <CardTitle className="flex items-center gap-2 text-base"><Activity className="h-4 w-4 text-primary" /> {TITLES[component]} · Device connections</CardTitle>
            <p className="mt-1 text-xs text-muted-foreground">Optional device connections. Existing {TITLES[component]} workflows remain available without registered hardware.</p>
          </div>
          <div className="flex gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => void refresh()} disabled={loading}><RefreshCw className={`mr-1 h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} /> Refresh</Button>
            <Button type="button" size="sm" onClick={() => setShowForm(v => !v)}><Plus className="mr-1 h-3.5 w-3.5" /> Register device</Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <Badge variant="outline">{devices.length} registered</Badge>
          <Badge variant="outline">{devices.filter(d => d.status === "active").length} active</Badge>
          <Badge variant="outline">{observations.length} recent observations</Badge>
          <span className="text-muted-foreground">Connectivity is confirmed only after an authenticated device message is received.</span>
        </div>

        {oneTimeToken && (
          <div className="rounded-lg border border-amber-500/40 bg-amber-500/5 p-3 space-y-2">
            <div className="flex items-center gap-2 text-sm font-semibold"><ShieldAlert className="h-4 w-4 text-amber-600" /> One-time device credential</div>
            <p className="text-xs text-muted-foreground">This token will not be shown again. Store it in the physical device or trusted gateway's protected secret store. Never put it in browser local storage, a URL, logs or source code.</p>
            <div className="flex flex-wrap gap-2">
              <Input readOnly value={oneTimeToken} className="min-w-0 flex-1 font-mono text-xs" />
              <Button type="button" size="sm" variant="outline" onClick={() => void copyToken()}><Copy className="mr-1 h-3.5 w-3.5" /> Copy</Button>
              <Button type="button" size="sm" variant="ghost" onClick={() => setOneTimeToken(null)}>Dismiss</Button>
            </div>
          </div>
        )}

        {showForm && (
          <form onSubmit={submitRegistration} className="rounded-lg border p-3 space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1"><Label>Device name *</Label><Input required maxLength={100} value={form.device_name} onChange={e => setForm(v => ({ ...v, device_name: e.target.value }))} placeholder="e.g. North field probe" /></div>
              <div className="space-y-1"><Label>Hardware ID / serial *</Label><Input required maxLength={160} value={form.hardware_id} onChange={e => setForm(v => ({ ...v, hardware_id: e.target.value }))} placeholder="Manufacturer serial or assigned ID" /></div>
              <div className="space-y-1"><Label>Manufacturer</Label><Input maxLength={100} value={form.manufacturer} onChange={e => setForm(v => ({ ...v, manufacturer: e.target.value }))} /></div>
              <div className="space-y-1"><Label>Model</Label><Input maxLength={100} value={form.model} onChange={e => setForm(v => ({ ...v, model: e.target.value }))} /></div>
              <div className="space-y-1"><Label>Firmware version</Label><Input maxLength={80} value={form.firmware_version} onChange={e => setForm(v => ({ ...v, firmware_version: e.target.value }))} /></div>
              <div className="space-y-1"><Label>Connection protocol (declared)</Label><select className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={form.protocol} onChange={e => setForm(v => ({ ...v, protocol: e.target.value as SharedDeviceProtocol }))}>{PROTOCOLS.map(p => <option key={p} value={p}>{p}</option>)}</select></div>
              <div className="space-y-1 sm:col-span-2"><Label>Capabilities (comma separated)</Label><Input value={form.capabilities} onChange={e => setForm(v => ({ ...v, capabilities: e.target.value }))} placeholder="soil-moisture, soil-temperature" /></div>
              <div className="space-y-1"><Label>Farm reference (optional)</Label><Input maxLength={120} value={form.farm_id} onChange={e => setForm(v => ({ ...v, farm_id: e.target.value }))} /></div>
              <div className="space-y-1"><Label>Site reference (optional)</Label><Input maxLength={120} value={form.site_id} onChange={e => setForm(v => ({ ...v, site_id: e.target.value }))} /></div>
            </div>
            <p className="text-xs text-muted-foreground">Registration records device metadata only. It does not pair, test or certify physical compatibility. Use the protocol documented for the exact device model.</p>
            <div className="flex gap-2"><Button type="submit" disabled={saving}>{saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null} {saving ? "Registering…" : "Register device"}</Button><Button type="button" variant="ghost" onClick={() => setShowForm(false)}>Cancel</Button></div>
          </form>
        )}

        <div className="space-y-2">
          {loading ? <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading device connections…</div> :
            devices.length === 0 ? <p className="rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">No devices registered for this component. You can continue using all existing features normally.</p> :
            devices.map(device => (
              <div key={device.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2"><p className="font-medium text-sm">{device.device_name}</p><Badge variant={device.status === "active" ? "secondary" : "destructive"}>{device.status}</Badge></div>
                  <p className="mt-1 text-xs text-muted-foreground">{[device.manufacturer, device.model, device.firmware_version].filter(Boolean).join(" · ") || device.hardware_id}</p>
                  <p className="mt-1 text-xs text-muted-foreground">ID: {device.hardware_id} · Protocol: {device.protocol} · Last message: {readableDate(device.last_seen_at)}</p>
                </div>
                <div className="flex items-center gap-2">{device.last_seen_at ? <Badge variant="outline" className="gap-1"><Wifi className="h-3 w-3" /> Message received</Badge> : <Badge variant="outline" className="gap-1"><WifiOff className="h-3 w-3" /> Awaiting first message</Badge>}
                  {device.status === "active" && <Button type="button" size="sm" variant="outline" disabled={revokingId === device.id} onClick={() => void revoke(device)}>{revokingId === device.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Unplug className="h-3.5 w-3.5" />} <span className="ml-1">Revoke</span></Button>}
                </div>
              </div>
            ))}
        </div>

        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm font-semibold"><Clock3 className="h-4 w-4" /> Recent device observations</div>
          {observations.length === 0 ? <p className="text-xs text-muted-foreground">No device measurements received yet. Forecasts, estimates, phone GPS and manually entered records are not represented as physical sensor measurements here.</p> :
            <div className="overflow-x-auto rounded-lg border"><table className="w-full min-w-[540px] text-left text-xs"><thead className="bg-muted/60"><tr><th className="p-2">Measurement</th><th className="p-2">Value</th><th className="p-2">Measured at</th><th className="p-2">Received at</th><th className="p-2">Source</th></tr></thead><tbody>{observations.map(row => <tr key={row.id} className="border-t"><td className="p-2 font-medium">{row.metric.replace(/_/g, " ")}</td><td className="p-2">{row.value} {row.unit}</td><td className="p-2">{readableDate(row.observed_at)}</td><td className="p-2">{readableDate(row.received_at)}</td><td className="p-2 font-mono">{row.device_id.slice(0, 8)}</td></tr>)}</tbody></table></div>}
        </div>
      </CardContent>
    </Card>
  );
}
