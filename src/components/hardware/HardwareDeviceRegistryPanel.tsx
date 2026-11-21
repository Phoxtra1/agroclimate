import { useCallback, useEffect, useState } from "react";
import type { FormEvent } from "react";
import { Ban, Check, Copy, Cpu, RefreshCw } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { COMPONENT_HARDWARE_PROFILES } from "@/services/hardware/componentProfiles";
import type { DeviceProtocol, HardwareComponent } from "@/services/hardware/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type RegisterableComponent = "agro-inventory" | "market-link" | "agtrans" | "agroforecast" | "agrorisk" | "aerial-console";
type DeviceRow = {
  id: string;
  component: HardwareComponent;
  device_name: string;
  hardware_id: string;
  model: string | null;
  protocol: DeviceProtocol;
  status: "active" | "revoked";
  last_seen_at: string | null;
  created_at: string;
};

function isRecentlySeen(value: string | null): boolean {
  if (!value) return false;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) && timestamp <= Date.now() && Date.now() - timestamp < 2 * 60 * 1000;
}

const COMPONENT_LABELS: Record<RegisterableComponent, string> = {
  "agro-inventory": "Agro Inventory",
  "market-link": "Market Link",
  agtrans: "AGTrans",
  agroforecast: "AgroForecast",
  agrorisk: "AgroRisk",
  "aerial-console": "Aerial Console",
};

export function HardwareDeviceRegistryPanel({ component }: { component: RegisterableComponent }) {
  const { user } = useAuth();
  const profile = COMPONENT_HARDWARE_PROFILES[component];
  const [devices, setDevices] = useState<DeviceRow[]>([]);
  const [deviceName, setDeviceName] = useState("");
  const [hardwareId, setHardwareId] = useState("");
  const [model, setModel] = useState("");
  const [farmId, setFarmId] = useState("");
  const [siteId, setSiteId] = useState("");
  const [calibrationDueAt, setCalibrationDueAt] = useState("");
  const [protocol, setProtocol] = useState<DeviceProtocol>(profile.candidateProtocols[0] ?? "manual");
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [issuedToken, setIssuedToken] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const refresh = useCallback(async () => {
    if (!user) { setDevices([]); return; }
    setRefreshing(true);
    const { data, error: loadError } = await supabase
      .from("agroclimate_devices" as any)
      .select("id,component,device_name,hardware_id,model,protocol,status,last_seen_at,created_at")
      .eq("user_id", user.id)
      .eq("component", component)
      .order("created_at", { ascending: false });
    if (loadError) setError(loadError.message);
    else setDevices((data ?? []) as unknown as DeviceRow[]);
    setRefreshing(false);
  }, [component, user]);

  useEffect(() => {
    setDevices([]);
    setIssuedToken(null);
    void refresh();
    if (!user) return;
    const channel = supabase.channel(`hardware-registry-${user.id}-${component}`)
      .on("postgres_changes", {
        event: "*", schema: "public", table: "agroclimate_devices",
        filter: `user_id=eq.${user.id}`,
      }, () => { void refresh(); })
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [component, refresh, user]);

  const register = async (event: FormEvent) => {
    event.preventDefault();
    if (!user || !deviceName.trim() || !hardwareId.trim()) return;
    setSaving(true); setError(null); setIssuedToken(null);
    try {
      const { data, error: invokeError } = await supabase.functions.invoke("agroclimate-device-gateway", {
        body: {
          action: "register", component, protocol, device_name: deviceName.trim(),
          hardware_id: hardwareId.trim(), model: model.trim() || null,
          farm_id: farmId.trim() || null, site_id: siteId.trim() || null,
          calibration_due_at: calibrationDueAt ? new Date(`${calibrationDueAt}T23:59:59.999Z`).toISOString() : null,
          capabilities: [...profile.capabilities],
        },
      });
      if (invokeError) throw invokeError;
      if (!data?.device?.id || typeof data.device_token !== "string") {
        throw new Error(data?.error || "The gateway did not return a device credential.");
      }
      setIssuedToken(data.device_token);
      setDeviceName(""); setHardwareId(""); setModel(""); setFarmId(""); setSiteId(""); setCalibrationDueAt("");
      await refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Device registration failed.");
    } finally { setSaving(false); }
  };

  const revoke = async (device: DeviceRow) => {
    if (!confirm(`Revoke access for "${device.device_name}"?`)) return;
    setError(null);
    const { data, error: invokeError } = await supabase.functions.invoke("agroclimate-device-gateway", {
      body: { action: "revoke", device_id: device.id },
    });
    if (invokeError || data?.revoked !== true) {
      setError(invokeError?.message || data?.error || "Device revocation failed.");
      return;
    }
    await refresh();
  };

  const rotateCredential = async (device: DeviceRow) => {
    if (!confirm(`Issue a replacement credential for "${device.device_name}"? The previous token will stop working.`)) return;
    setError(null); setIssuedToken(null);
    const { data, error: invokeError } = await supabase.functions.invoke("agroclimate-device-gateway", {
      body: { action: "rotate", device_id: device.id },
    });
    if (invokeError || typeof data?.device_token !== "string") {
      setError(invokeError?.message || data?.error || "Credential rotation failed.");
      return;
    }
    setIssuedToken(data.device_token);
    await refresh();
  };

  const copyToken = async () => {
    if (!issuedToken) return;
    try {
      await navigator.clipboard.writeText(issuedToken);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setError("Clipboard access is unavailable. Select and copy the displayed token manually.");
    }
  };

  const protocols = profile.candidateProtocols;

  return (
    <details className="group">
      <summary className="cursor-pointer list-none">
        <Card className="border-dashed">
          <CardHeader className="py-3">
            <CardTitle className="flex items-center justify-between gap-3 text-sm">
              <span className="flex items-center gap-2"><Cpu className="h-4 w-4" /> Device connections · {COMPONENT_LABELS[component]}</span>
              <span className="text-xs font-normal text-muted-foreground">{devices.length} registered · expand</span>
            </CardTitle>
          </CardHeader>
        </Card>
      </summary>
      <Card className="mt-2">
        <CardContent className="space-y-4 pt-4">
          <p className="text-xs text-muted-foreground">
            Register an actual device or gateway for this component. Registration issues a credential once; it does not mean the device is connected. The device must send a valid observation before its last-seen status changes.
          </p>
          <form onSubmit={register} className="grid gap-3 sm:grid-cols-2">
            <div><Label>Device name</Label><Input value={deviceName} onChange={(e) => setDeviceName(e.target.value)} maxLength={100} required placeholder="e.g. North field soil probe" /></div>
            <div><Label>Hardware ID / serial</Label><Input value={hardwareId} onChange={(e) => setHardwareId(e.target.value)} maxLength={160} required placeholder="Unique device serial" /></div>
            <div><Label>Model (optional)</Label><Input value={model} onChange={(e) => setModel(e.target.value)} maxLength={100} placeholder="Manufacturer model" /></div>
            <div><Label>Farm ID (optional)</Label><Input value={farmId} onChange={(e) => setFarmId(e.target.value)} maxLength={120} placeholder="Registered farm identifier" /></div>
            <div><Label>Site ID (optional)</Label><Input value={siteId} onChange={(e) => setSiteId(e.target.value)} maxLength={120} placeholder="Field, store or facility identifier" /></div>
            {(component === "agrorisk" || component === "agroforecast") && <div><Label>Sensor calibration valid through (owner-entered)</Label><Input type="date" value={calibrationDueAt} min={new Date().toISOString().slice(0, 10)} onChange={(e) => setCalibrationDueAt(e.target.value)} /><p className="text-[10px] text-muted-foreground">Only enter a date supported by the sensor calibration record. This is an owner declaration, not independent certification.</p></div>}
            <div><Label>Connection protocol</Label><select className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={protocol} onChange={(e) => setProtocol(e.target.value as DeviceProtocol)}>{protocols.map((item) => <option key={item} value={item}>{item}</option>)}</select></div>
            <div className="sm:col-span-2"><Button type="submit" disabled={saving || !deviceName.trim() || !hardwareId.trim()}>{saving ? "Registering…" : "Register device and issue token"}</Button></div>
          </form>
          {issuedToken && (
            <div className="rounded-lg border border-amber-500/40 bg-amber-500/5 p-3 space-y-2">
              <div className="flex items-center gap-2"><Badge variant="outline">Shown once</Badge><span className="text-xs font-medium">Store this credential securely on the device.</span></div>
              <code className="block break-all rounded bg-muted p-2 text-xs">{issuedToken}</code>
              <div className="flex gap-2"><Button type="button" size="sm" onClick={() => void copyToken()}>{copied ? <Check className="mr-1 h-3 w-3" /> : <Copy className="mr-1 h-3 w-3" />}{copied ? "Copied" : "Copy token"}</Button><Button type="button" size="sm" variant="outline" onClick={() => setIssuedToken(null)}>Hide token</Button></div>
              <p className="text-xs text-muted-foreground">The raw token is not stored in the browser or shown again. If lost, revoke the device and register it again.</p>
            </div>
          )}
          {error && <p role="alert" className="text-xs text-destructive">{error}</p>}
          <div className="flex items-center justify-between"><h4 className="text-sm font-semibold">Registered devices</h4><Button type="button" size="sm" variant="ghost" onClick={() => void refresh()} disabled={refreshing}><RefreshCw className={`mr-1 h-3 w-3 ${refreshing ? "animate-spin" : ""}`} />Refresh</Button></div>
          {devices.length === 0 ? <p className="text-xs text-muted-foreground">No devices registered for this component.</p> : devices.map((device) => (
            <div key={device.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border p-3">
              <div className="min-w-0"><p className="text-sm font-medium">{device.device_name}</p><p className="text-xs text-muted-foreground">{device.model || "Model not specified"} · {device.hardware_id} · {device.protocol}</p><p className="text-xs text-muted-foreground">Last signal: {device.last_seen_at ? new Date(device.last_seen_at).toLocaleString() : "Never received"}</p></div>
              <div className="flex items-center gap-2"><Badge variant={device.status === "revoked" ? "destructive" : isRecentlySeen(device.last_seen_at) ? "default" : "secondary"}>{device.status === "revoked" ? "Revoked" : isRecentlySeen(device.last_seen_at) ? "Recently connected" : "Registered · no recent signal"}</Badge><Button type="button" size="sm" variant="outline" onClick={() => void rotateCredential(device)}>Rotate token</Button>{device.status === "active" && <Button type="button" size="sm" variant="outline" onClick={() => void revoke(device)}><Ban className="mr-1 h-3 w-3" />Revoke</Button>}</div>
            </div>
          ))}
        </CardContent>
      </Card>
    </details>
  );
}
