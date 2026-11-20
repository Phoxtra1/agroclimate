import { supabase } from "@/integrations/supabase/client";

export type SharedDeviceComponent =
  | "farm-handler" | "agro-inventory" | "market-link" | "agtrans"
  | "agroforecast" | "agrorisk" | "aerial-console" | "satellite";

export type SharedDeviceProtocol =
  | "browser-camera" | "browser-geolocation" | "ble-gatt" | "usb-hid"
  | "usb-serial" | "https-api" | "mqtt-tls" | "mavlink"
  | "vendor-sdk" | "satellite-api" | "manual";

export interface SharedDevice {
  id: string;
  component: SharedDeviceComponent;
  device_name: string;
  hardware_id: string;
  manufacturer: string | null;
  model: string | null;
  firmware_version: string | null;
  protocol: SharedDeviceProtocol;
  capabilities: string[];
  farm_id: string | null;
  site_id: string | null;
  status: "active" | "revoked";
  last_seen_at: string | null;
  calibration_due_at: string | null;
  created_at: string;
}

export interface SharedDeviceObservation {
  id: string;
  device_id: string;
  component: SharedDeviceComponent;
  metric: string;
  value: number;
  unit: string;
  observed_at: string;
  received_at: string;
  farm_id: string | null;
  site_id: string | null;
  latitude: number | null;
  longitude: number | null;
  metadata: Record<string, string | number | boolean>;
}

export interface RegisterSharedDeviceInput {
  component: SharedDeviceComponent;
  device_name: string;
  hardware_id: string;
  manufacturer?: string;
  model?: string;
  firmware_version?: string;
  protocol: SharedDeviceProtocol;
  capabilities: string[];
  farm_id?: string;
  site_id?: string;
}

export async function listSharedDevices(component: SharedDeviceComponent): Promise<SharedDevice[]> {
  const { data, error } = await (supabase as any).from("agroclimate_devices")
    .select("id,component,device_name,hardware_id,manufacturer,model,firmware_version,protocol,capabilities,farm_id,site_id,status,last_seen_at,calibration_due_at,created_at")
    .eq("component", component).order("created_at", { ascending: false });
  if (error) throw error;
  return (data || []) as SharedDevice[];
}

export async function listSharedDeviceObservations(component: SharedDeviceComponent): Promise<SharedDeviceObservation[]> {
  const { data, error } = await (supabase as any).from("agroclimate_device_observations")
    .select("id,device_id,component,metric,value,unit,observed_at,received_at,farm_id,site_id,latitude,longitude,metadata")
    .eq("component", component).order("observed_at", { ascending: false }).limit(30);
  if (error) throw error;
  return (data || []) as SharedDeviceObservation[];
}

export async function registerSharedDevice(input: RegisterSharedDeviceInput): Promise<{ device: SharedDevice; device_token: string }> {
  const { data, error } = await supabase.functions.invoke("agroclimate-device-gateway", {
    body: { action: "register", ...input },
  });
  if (error) throw error;
  if (!data?.device?.id || typeof data.device_token !== "string") {
    throw new Error(data?.error || "Device registration returned an incomplete response.");
  }
  return data as { device: SharedDevice; device_token: string };
}

export async function revokeSharedDevice(deviceId: string): Promise<void> {
  const { data, error } = await supabase.functions.invoke("agroclimate-device-gateway", {
    body: { action: "revoke", device_id: deviceId },
  });
  if (error) throw error;
  if (!data?.revoked) throw new Error(data?.error || "Device revocation was not confirmed.");
}
