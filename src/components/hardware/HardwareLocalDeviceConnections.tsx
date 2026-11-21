import { useEffect, useRef, useState } from "react";
import { AlertCircle, Bluetooth, Link2, Unplug } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { createAgroClimateHardwareRuntime } from "@/services/hardware/bootstrap";
import { toDeviceRegistration } from "@/services/hardware/supabaseGateway";
import type { ProvisionedDevice } from "@/services/hardware/supabaseGateway";
import type { ObservationMetric } from "@/services/hardware/types";
import { hardwareCapabilitySupportsMetric, type BleCharacteristicMapping } from "@/services/hardware/browserAdapters";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";

type ComponentKey = "agro-inventory" | "market-link" | "agtrans" | "agroforecast" | "agrorisk" | "aerial-console";
type Row = ProvisionedDevice;
type Session = { runtime: ReturnType<typeof createAgroClimateHardwareRuntime>; status: string };

const METRICS: ObservationMetric[] = ["temperature","relative_humidity","soil_moisture","soil_temperature","soil_ph","electrical_conductivity","rainfall","wind_speed","wind_direction","water_level","weight","vehicle_speed","aircraft_altitude","aircraft_battery","latitude","longitude"];

function jsonLineDecoder(capabilities: string[]) {
  return (line: string) => {
    let parsed: unknown;
    try { parsed = JSON.parse(line); } catch { return []; }
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return [];
    const value = parsed as Record<string, unknown>;
    const metric = value.metric;
    const reading = Number(value.value);
    const unit = typeof value.unit === "string" ? value.unit : "";
    if (typeof metric !== "string" || !METRICS.includes(metric as ObservationMetric) || !Number.isFinite(reading) || !unit) return [];
    if (!capabilities.some((capability) => hardwareCapabilitySupportsMetric(capability, metric as ObservationMetric))) return [];
    return [{ metric: metric as ObservationMetric, value: reading, unit }];
  };
}

function customBleMappings(raw: string): BleCharacteristicMapping[] {
  if (!raw.trim()) return [];
  const parsed: unknown = JSON.parse(raw);
  if (!Array.isArray(parsed)) throw new Error("Custom BLE mapping must be a JSON array.");
  return parsed.map((entry) => {
    const item = entry as Record<string, unknown>;
    if (typeof item.serviceUuid !== "string" || typeof item.characteristicUuid !== "string" ||
        typeof item.metric !== "string" || !METRICS.includes(item.metric as ObservationMetric) ||
        typeof item.unit !== "string" || !["int16","uint16","int32","uint32","float32"].includes(String(item.format))) {
      throw new Error("Each BLE mapping needs serviceUuid, characteristicUuid, metric, unit and format (int16, uint16, int32, uint32 or float32).");
    }
    const format = item.format;
    const scale = Number(item.scale ?? 1);
    if (!Number.isFinite(scale) || scale === 0) throw new Error("BLE mapping scale must be a non-zero number.");
    return {
      serviceUuid: item.serviceUuid, characteristicUuid: item.characteristicUuid,
      metric: item.metric as ObservationMetric, unit: item.unit,
      decode: (view: DataView) => {
        if (format === "int16" && view.byteLength >= 2) return view.getInt16(0, true) * scale;
        if (format === "uint16" && view.byteLength >= 2) return view.getUint16(0, true) * scale;
        if (format === "int32" && view.byteLength >= 4) return view.getInt32(0, true) * scale;
        if (format === "uint32" && view.byteLength >= 4) return view.getUint32(0, true) * scale;
        if (format === "float32" && view.byteLength >= 4) return view.getFloat32(0, true) * scale;
        return null;
      },
    };
  });
}

export function HardwareLocalDeviceConnections({ component }: { component: ComponentKey }) {
  const { user } = useAuth();
  const [devices, setDevices] = useState<Row[]>([]);
  const [tokens, setTokens] = useState<Record<string,string>>({});
  const [states, setStates] = useState<Record<string,string>>({});
  const [error, setError] = useState<string | null>(null);
  const [baudRate, setBaudRate] = useState("9600");
  const [hidOffset, setHidOffset] = useState("0");
  const [hidScale, setHidScale] = useState("1");
  const [bleMap, setBleMap] = useState("");
  const sessions = useRef(new Map<string, Session>());

  useEffect(() => {
    let current = true;
    if (!user) { setDevices([]); return; }
    void supabase.from("agroclimate_devices" as any)
      .select("id,user_id,component,device_name,hardware_id,manufacturer,model,firmware_version,protocol,capabilities,farm_id,site_id,status,created_at")
      .eq("user_id", user.id).eq("component", component).order("created_at", { ascending: false })
      .then(({ data, error: queryError }) => {
        if (!current) return;
        if (queryError) setError(queryError.message);
        else setDevices((data ?? []) as unknown as Row[]);
      });
    return () => { current = false; };
  }, [component, user]);

  useEffect(() => () => {
    void Promise.all([...sessions.current.values()].map(({ runtime }) => runtime.dispose()));
    sessions.current.clear();
  }, []);

  const connect = async (device: Row) => {
    if (!user) return;
    setError(null);
    const token = tokens[device.id]?.trim();
    if (!token) { setError("Paste this device's token. Tokens are never saved in browser storage."); return; }
    if (!["ble-gatt","usb-hid","usb-serial","mavlink","browser-geolocation"].includes(device.protocol)) {
      setError("This protocol uses the shared HTTPS gateway, not local browser pairing."); return;
    }
    try {
      const mappings = customBleMappings(bleMap);
      const runtime = createAgroClimateHardwareRuntime({
        queueScope: user.id,
        resolveDeviceToken: async (id) => id === device.id ? token : null,
        bleMappings: mappings,
        serialOptions: device.protocol === "usb-serial" && component !== "agtrans" ? {
          adapterId: `json-lines-${component}`, components: [component], baudRate: Number(baudRate),
          decodeLine: jsonLineDecoder(device.capabilities),
        } : undefined,
        agtransNmeaBaudRate: Number(baudRate),
        decodeHidScaleReport: device.protocol === "usb-hid" ? (view) => {
          const offset = Number(hidOffset), scale = Number(hidScale);
          if (!Number.isInteger(offset) || offset < 0 || offset + 4 > view.byteLength || !Number.isFinite(scale) || scale === 0) return null;
          const reading = view.getFloat32(offset, true) * scale;
          return Number.isFinite(reading) ? reading : null;
        } : undefined,
      });
      runtime.registerDevice(toDeviceRegistration(device, user.id));
      const result = await runtime.connect(device.id);
      if (!result.connected) {
        await runtime.dispose();
        setStates((prior) => ({ ...prior, [device.id]: result.detail || "Not connected" }));
        return;
      }
      const prior = sessions.current.get(device.id);
      if (prior) await prior.runtime.dispose();
      sessions.current.set(device.id, { runtime, status: result.detail || "Connected" });
      setStates((prior) => ({ ...prior, [device.id]: result.detail || "Connected" }));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Browser device connection failed.");
    }
  };

  const disconnect = async (deviceId: string) => {
    const session = sessions.current.get(deviceId);
    if (!session) return;
    await session.runtime.dispose();
    sessions.current.delete(deviceId);
    setStates((prior) => ({ ...prior, [deviceId]: "Disconnected" }));
  };

  return <section className="space-y-3 rounded-lg border p-3">
    <div className="flex items-center gap-2"><Link2 className="h-4 w-4"/><h4 className="text-sm font-semibold">Direct browser pairing</h4><Badge variant="outline">BLE · USB · Serial</Badge></div>
    <p className="text-xs text-muted-foreground">Pair from a secure HTTPS page in a supported desktop browser. Each connection requires a device token pasted for this session. The token stays in memory only. BLE uses standard environmental/weight profiles plus optional documented custom mappings; serial uses JSON-lines (or NMEA for AGTrans); HID scale reports use a configurable 32-bit float decoder. A model-specific decoder must match the manufacturer's protocol exactly.</p>
    {component !== "agtrans" && <div className="grid gap-2 sm:grid-cols-3">
      <div><Label className="text-xs">Serial baud rate</Label><Input value={baudRate} onChange={e=>setBaudRate(e.target.value)} inputMode="numeric"/></div>
      {component === "agro-inventory" || component === "market-link" ? <><div><Label className="text-xs">HID float byte offset</Label><Input value={hidOffset} onChange={e=>setHidOffset(e.target.value)} inputMode="numeric"/></div><div><Label className="text-xs">HID scale multiplier</Label><Input value={hidScale} onChange={e=>setHidScale(e.target.value)} inputMode="decimal"/></div></> : null}
    </div>}
    <div><Label className="text-xs">Optional custom BLE characteristic mappings (JSON)</Label><textarea className="min-h-20 w-full rounded-md border bg-background p-2 text-xs" value={bleMap} onChange={e=>setBleMap(e.target.value)} placeholder={'[{"serviceUuid":"...","characteristicUuid":"...","metric":"soil_moisture","unit":"%","format":"uint16","scale":0.01}]'}/></div>
    {devices.length === 0 ? <p className="text-xs text-muted-foreground">Register a device above before pairing.</p> : devices.map(device => <div key={device.id} className="space-y-2 rounded-md border p-3">
      <div className="flex flex-wrap items-center justify-between gap-2"><div><p className="text-sm font-medium">{device.device_name}</p><p className="text-xs text-muted-foreground">{device.protocol} · {device.model || device.hardware_id}</p></div><Badge variant={sessions.current.has(device.id) ? "default" : "secondary"}>{states[device.id] || "Not paired"}</Badge></div>
      <div className="flex flex-wrap gap-2">{["ble-gatt","usb-hid","usb-serial","mavlink","browser-geolocation"].includes(device.protocol) && device.status === "active" ? <Input className="min-w-0 flex-1" type="password" autoComplete="off" placeholder="Paste device token for this session" value={tokens[device.id] || ""} onChange={e=>setTokens(prior=>({...prior,[device.id]:e.target.value}))}/> : null}{sessions.current.has(device.id) ? <Button type="button" variant="outline" size="sm" onClick={()=>void disconnect(device.id)}><Unplug className="mr-1 h-3 w-3"/>Disconnect</Button> : ["ble-gatt","usb-hid","usb-serial","mavlink","browser-geolocation"].includes(device.protocol) && device.status === "active" ? <Button type="button" size="sm" onClick={()=>void connect(device)}><Bluetooth className="mr-1 h-3 w-3"/>Pair / connect</Button> : <Badge variant="outline">{device.status === "revoked" ? "Revoked" : "Use shared HTTPS gateway"}</Badge>}</div>
    </div>)}
    {error && <p role="alert" className="flex items-center gap-2 text-xs text-destructive"><AlertCircle className="h-3 w-3"/>{error}</p>}
    <p className="text-[11px] text-muted-foreground">Browser permissions and hardware support vary. USB HID float decoding is not universal; confirm report layout, byte order, scale and unit against the exact device manual before using readings operationally. If the browser does not expose WebHID/Web Serial (common on mobile browsers), use the shared HTTPS gateway device/gateway path instead.</p>
  </section>;
}
