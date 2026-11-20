import { supabase } from "@/integrations/supabase/client";
import type { DeviceObservation, DeviceRegistration, HardwareComponent, DeviceProtocol } from "./types";
import type { ObservationSink, PostHarvestReadingSink } from "./browserAdapters";

export interface ProvisionedDevice {
  id: string; user_id: string; component: HardwareComponent; device_name: string;
  hardware_id: string; manufacturer: string | null; model: string | null;
  firmware_version: string | null; protocol: DeviceProtocol; capabilities: string[];
  farm_id: string | null; site_id: string | null; status: "active" | "revoked"; created_at: string;
}
export interface DeviceProvisioningResult { device: ProvisionedDevice; device_token: string; token_notice: string; }

/** Owner-authenticated provisioning. The returned token must be handed to the authorised Amineva deployment vault once. */
export async function provisionAgroClimateDevice(input: {
  component: Exclude<HardwareComponent, "post-harvest">; protocol: DeviceProtocol;
  deviceName: string; hardwareId: string; manufacturer?: string; model?: string;
  firmwareVersion?: string; capabilities: string[]; farmId?: string; siteId?: string;
}): Promise<DeviceProvisioningResult> {
  const { data, error } = await supabase.functions.invoke("agroclimate-device-gateway", {
    body: { action: "register", component: input.component, protocol: input.protocol,
      device_name: input.deviceName, hardware_id: input.hardwareId, manufacturer: input.manufacturer,
      model: input.model, firmware_version: input.firmwareVersion, capabilities: input.capabilities,
      farm_id: input.farmId, site_id: input.siteId },
  });
  if (error) throw new Error(error.message || "Device provisioning failed.");
  if (!data?.device?.id || !data?.device_token) throw new Error(data?.error || "Device gateway returned an incomplete provisioning response.");
  return data as DeviceProvisioningResult;
}

export async function revokeAgroClimateDevice(deviceId: string): Promise<void> {
  const { data, error } = await supabase.functions.invoke("agroclimate-device-gateway", { body: { action: "revoke", device_id: deviceId } });
  if (error || data?.revoked !== true) throw new Error(data?.error || error?.message || "Device revocation failed.");
}

/** The token resolver must read from a protected Amineva-managed secret store, never a UI field or localStorage. */
export function createSupabaseDeviceObservationSink(resolveDeviceToken: (deviceId: string) => Promise<string | null>): ObservationSink {
  return async (item: DeviceObservation) => {
    const token = await resolveDeviceToken(item.deviceId);
    if (!token) throw new Error("No managed device credential is available for this device.");
    const { data, error } = await supabase.functions.invoke("agroclimate-device-gateway", {
      body: { action: "ingest", metric: item.metric, value: item.value, unit: item.unit,
        observed_at: item.measuredAt, idempotency_key: item.eventId, farm_id: item.farmId,
        site_id: item.siteId, latitude: item.latitude, longitude: item.longitude, metadata: item.metadata ?? {} },
      headers: { "x-device-token": token },
    });
    if (error || data?.accepted !== true) throw new Error(data?.error || error?.message || "Device observation was not accepted.");
  };
}

/** Converts the server-issued registration into the local adapter contract without exposing the credential. */
export function toDeviceRegistration(device: ProvisionedDevice, ownerUserId: string): DeviceRegistration {
  return { deviceId: device.id, tenantId: device.user_id, ownerUserId, component: device.component,
    deviceClass: device.device_name, manufacturer: device.manufacturer ?? "Unknown", model: device.model ?? "Unknown",
    firmwareVersion: device.firmware_version ?? undefined, protocol: device.protocol,
    capabilities: device.capabilities as DeviceRegistration["capabilities"], farmId: device.farm_id ?? undefined,
    siteId: device.site_id ?? undefined, registeredAt: device.created_at, state: device.status === "active" ? "registered" : "revoked" };
}


export interface ProvisionedPostHarvestStation {
  id: string; user_id: string; device_name: string; hardware_id: string;
  model: string | null; status: "active" | "revoked"; harvest_entry_id: string | null; created_at: string;
}
export interface PostHarvestProvisioningResult {
  device: ProvisionedPostHarvestStation; device_token: string; token_notice: string;
}

export async function provisionPostHarvestStation(input: {
  deviceName: string; hardwareId: string; model?: string; harvestEntryId?: string;
}): Promise<PostHarvestProvisioningResult> {
  const { data, error } = await supabase.functions.invoke("post-harvest-station", {
    body: { action: "register", device_name: input.deviceName, hardware_id: input.hardwareId,
      model: input.model, harvest_entry_id: input.harvestEntryId },
  });
  if (error) throw new Error(error.message || "Post-Harvest station provisioning failed.");
  if (!data?.device?.id || !data?.device_token) throw new Error(data?.error || "Post-Harvest gateway returned an incomplete response.");
  return data as PostHarvestProvisioningResult;
}

export async function revokePostHarvestStation(deviceId: string): Promise<void> {
  const { data, error } = await supabase.functions.invoke("post-harvest-station", {
    body: { action: "revoke", device_id: deviceId },
  });
  if (error || data?.revoked !== true) throw new Error(data?.error || error?.message || "Post-Harvest station revocation failed.");
}

export function createPostHarvestStationSink(
  resolveDeviceToken: (deviceId: string) => Promise<string | null>,
): PostHarvestReadingSink {
  return async (device, reading) => {
    const token = await resolveDeviceToken(device.deviceId);
    if (!token) throw new Error("No managed Post-Harvest station credential is available.");
    const { data, error } = await supabase.functions.invoke("post-harvest-station", {
      body: { action: "ingest", temperature_c: reading.temperatureC, humidity_pct: reading.humidityPct,
        observed_at: reading.observedAt, idempotency_key: reading.idempotencyKey,
        sequence_no: reading.sequenceNo, firmware: reading.firmware, sensor_model: reading.sensorModel },
      headers: { "x-device-token": token },
    });
    if (error || data?.accepted !== true) throw new Error(data?.error || error?.message || "Post-Harvest station reading was not accepted.");
  };
}
