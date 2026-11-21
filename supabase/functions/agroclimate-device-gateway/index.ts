// Shared AgroClimate device gateway for all components except Post-Harvest.
// Post-Harvest continues to use its dedicated post-harvest-station function.
// Device tokens are shown once, stored only as SHA-256 hashes, and never returned on ingest.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-device-token",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
const COMPONENTS = new Set([
  "farm-handler", "agro-inventory", "market-link", "agtrans",
  "agroforecast", "agrorisk", "aerial-console", "satellite",
]);
const PROTOCOLS = new Set([
  "browser-camera", "browser-geolocation", "ble-gatt", "usb-hid", "usb-serial",
  "https-api", "mqtt-tls", "mavlink", "vendor-sdk", "satellite-api", "manual",
]);
const UNITS: Record<string, string[]> = {
  temperature: ["°C", "C", "°F", "F"],
  relative_humidity: ["%RH", "%"],
  soil_moisture: ["%", "%VWC", "m³/m³"],
  soil_temperature: ["°C", "C", "°F", "F"],
  soil_ph: ["pH"],
  electrical_conductivity: ["µS/cm", "mS/cm", "dS/m"],
  rainfall: ["mm", "in"],
  wind_speed: ["m/s", "km/h", "mph"],
  wind_direction: ["°"],
  water_level: ["mm", "cm", "m"],
  weight: ["g", "kg", "lb"],
  vehicle_speed: ["m/s", "km/h", "mph"],
  aircraft_altitude: ["m", "ft"],
  aircraft_battery: ["%", "V"],
  latitude: ["°"],
  longitude: ["°"],
  barcode_count: ["count"],
};
const hex = (bytes: Uint8Array) => Array.from(bytes, b => b.toString(16).padStart(2, "0")).join("");
const sha256 = async (value: string) => hex(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value))));
const newToken = () => hex(crypto.getRandomValues(new Uint8Array(32)));
const isObject = (value: unknown): value is Record<string, any> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);
const ISO_DATE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/;

async function ownerFromRequest(req: Request, url: string, anonKey: string) {
  const authorization = req.headers.get("Authorization");
  if (!authorization) return null;
  const client = createClient(url, anonKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false },
  });
  const { data: { user }, error } = await client.auth.getUser();
  return error || !user ? null : user;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  const url = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  if (!url || !serviceKey || !anonKey) return json({ error: "Device gateway is not configured" }, 503);
  const admin = createClient(url, serviceKey, { auth: { persistSession: false } });

  const declaredLength = Number(req.headers.get("content-length") || 0);
  if (declaredLength > 16_384) return json({ error: "Request body is too large" }, 413);
  const raw = await req.text();
  if (raw.length > 16_384) return json({ error: "Request body is too large" }, 413);
  let body: unknown;
  try { body = JSON.parse(raw); } catch { return json({ error: "A valid JSON body is required" }, 400); }
  if (!isObject(body)) return json({ error: "A JSON object is required" }, 400);

  if (body.action === "register") {
    const user = await ownerFromRequest(req, url, anonKey);
    if (!user) return json({ error: "Valid owner authentication required" }, 401);
    const component = typeof body.component === "string" ? body.component : "";
    const protocol = typeof body.protocol === "string" ? body.protocol : "";
    const deviceName = typeof body.device_name === "string" ? body.device_name.trim() : "";
    const hardwareId = typeof body.hardware_id === "string" ? body.hardware_id.trim() : "";
    if (!COMPONENTS.has(component) || component === "post-harvest") return json({ error: "Unsupported component. Post-Harvest uses its dedicated station gateway." }, 400);
    if (!PROTOCOLS.has(protocol)) return json({ error: "Unsupported protocol" }, 400);
    if (!deviceName || deviceName.length > 100 || !hardwareId || hardwareId.length > 160) {
      return json({ error: "device_name (1-100) and hardware_id (1-160) are required" }, 400);
    }
    if (body.capabilities !== undefined && (!Array.isArray(body.capabilities) ||
        body.capabilities.length > 32 ||
        !body.capabilities.every((v: unknown) => typeof v === "string" && v.trim().length > 0 && v.length <= 64))) {
      return json({ error: "capabilities must be an array of at most 32 short strings" }, 400);
    }
    const capabilities = body.capabilities ?? [];
    const calibrationDueAt = body.calibration_due_at == null ? null : body.calibration_due_at;
    if (calibrationDueAt !== null && (typeof calibrationDueAt !== "string" || !Number.isFinite(Date.parse(calibrationDueAt)) || Date.parse(calibrationDueAt) <= Date.now())) {
      return json({ error: "calibration_due_at must be a future ISO 8601 timestamp" }, 400);
    }
    const token = newToken();
    const { data: device, error } = await admin.from("agroclimate_devices").insert({
      user_id: user.id, component, protocol, device_name: deviceName, hardware_id: hardwareId,
      manufacturer: typeof body.manufacturer === "string" ? body.manufacturer.trim().slice(0, 100) || null : null,
      model: typeof body.model === "string" ? body.model.trim().slice(0, 100) || null : null,
      firmware_version: typeof body.firmware_version === "string" ? body.firmware_version.trim().slice(0, 80) || null : null,
      capabilities,
      calibration_due_at: calibrationDueAt,
      farm_id: typeof body.farm_id === "string" ? body.farm_id.slice(0, 120) : null,
      site_id: typeof body.site_id === "string" ? body.site_id.slice(0, 120) : null,
    }).select("id,user_id,component,device_name,hardware_id,manufacturer,model,firmware_version,protocol,capabilities,farm_id,site_id,status,created_at").single();
    if (error) return json({ error: error.code === "23505" ? "This hardware ID is already registered for this component and account" : "Device registration failed" }, 400);
    const { error: credentialError } = await admin.from("agroclimate_device_credentials")
      .insert({ device_id: device.id, token_hash: await sha256(token) });
    if (credentialError) {
      await admin.from("agroclimate_devices").delete().eq("id", device.id);
      return json({ error: "Secure device credential provisioning failed" }, 500);
    }
    return json({ device, device_token: token, token_notice: "Store this token securely. It is returned once only." }, 201);
  }

  if (body.action === "revoke") {
    const user = await ownerFromRequest(req, url, anonKey);
    if (!user) return json({ error: "Valid owner authentication required" }, 401);
    const id = typeof body.device_id === "string" ? body.device_id : "";
    const { data: device } = await admin.from("agroclimate_devices").select("id")
      .eq("id", id).eq("user_id", user.id).maybeSingle();
    if (!device) return json({ error: "Device not found for this account" }, 404);
    const now = new Date().toISOString();
    const { error: credentialError } = await admin.from("agroclimate_device_credentials")
      .update({ revoked_at: now }).eq("device_id", id);
    if (credentialError) return json({ error: "Credential revocation failed" }, 500);
    const { error } = await admin.from("agroclimate_devices").update({ status: "revoked" })
      .eq("id", id).eq("user_id", user.id);
    return error ? json({ error: "Device status update failed" }, 500) : json({ revoked: true, device_id: id });
  }

  if (body.action === "ingest") {
    const token = req.headers.get("x-device-token") || "";
    if (token.length < 32 || token.length > 256) return json({ error: "Valid x-device-token required" }, 401);
    const { data: credential } = await admin.from("agroclimate_device_credentials")
      .select("device_id,revoked_at,agroclimate_devices!inner(id,user_id,component,status,farm_id,site_id)")
      .eq("token_hash", await sha256(token)).maybeSingle();
    if (!credential || credential.revoked_at) return json({ error: "Invalid or revoked device credential" }, 401);
    const device = (credential as any).agroclimate_devices;
    if (device.status !== "active") return json({ error: "Device is not active" }, 403);
    const metric = typeof body.metric === "string" ? body.metric : "";
    const unit = typeof body.unit === "string" ? body.unit : "";
    const value = body.value;
    const observedAt = typeof body.observed_at === "string" ? body.observed_at : "";
    const key = typeof body.idempotency_key === "string" ? body.idempotency_key.trim() : "";
    if (!Object.hasOwn(UNITS, metric) || !UNITS[metric].includes(unit) ||
        typeof value !== "number" || !Number.isFinite(value) ||
        !metricValueIsPlausible(metric, value, unit) ||
        !ISO_DATE.test(observedAt) || !Number.isFinite(Date.parse(observedAt)) ||
        Date.parse(observedAt) > Date.now() + 5 * 60_000 ||
        !key || key.length > 160) {
      return json({ error: "Invalid observation. Supply an allowlisted metric/unit, finite numeric value, timezone-aware observed_at, and idempotency_key." }, 400);
    }
    if (body.latitude !== undefined && (typeof body.latitude !== "number" || !Number.isFinite(body.latitude) || body.latitude < -90 || body.latitude > 90)) return json({ error: "Invalid latitude" }, 400);
    if (body.longitude !== undefined && (typeof body.longitude !== "number" || !Number.isFinite(body.longitude) || body.longitude < -180 || body.longitude > 180)) return json({ error: "Invalid longitude" }, 400);
    if ((body.latitude === undefined) !== (body.longitude === undefined)) return json({ error: "Latitude and longitude must be supplied together" }, 400);
    const metadata = body.metadata === undefined ? {} : body.metadata;
    if (!isObject(metadata) || Object.keys(metadata).length > 24 ||
        Object.entries(metadata).some(([k, v]) => k.length > 64 || !["string", "number", "boolean"].includes(typeof v) || (typeof v === "number" && !Number.isFinite(v)) || (typeof v === "string" && v.length > 256))) {
      return json({ error: "Metadata must contain at most 24 short primitive fields" }, 400);
    }
    const row = {
      device_id: device.id, user_id: device.user_id, component: device.component,
      metric, value, unit, observed_at: new Date(observedAt).toISOString(),
      idempotency_key: key,
      // Device credentials are bound to the farm/site assigned at registration.
      // Never let an ingest payload reassign observations to another farm or site.
      farm_id: device.farm_id,
      site_id: device.site_id,
      latitude: body.latitude ?? null, longitude: body.longitude ?? null, metadata,
    };
    const { data: inserted, error } = await admin.from("agroclimate_device_observations")
      .insert(row).select("id,device_id,component,metric,value,unit,observed_at,received_at,idempotency_key,farm_id,site_id,latitude,longitude,metadata").maybeSingle();
    if (error?.code === "23505") {
      const { data: existing, error: lookupError } = await admin.from("agroclimate_device_observations")
        .select("id,device_id,component,metric,value,unit,observed_at,received_at,idempotency_key,farm_id,site_id,latitude,longitude,metadata")
        .eq("device_id", device.id).eq("idempotency_key", key).maybeSingle();
      if (lookupError || !existing) return json({ error: "Duplicate observation could not be confirmed; retry with the same key" }, 503);
      const same = existing.metric === metric && existing.value === value && existing.unit === unit &&
        existing.observed_at === row.observed_at && existing.farm_id === row.farm_id &&
        existing.site_id === row.site_id && existing.latitude === row.latitude &&
        existing.longitude === row.longitude && stableJson(existing.metadata) === stableJson(metadata);
      if (!same) return json({ error: "Idempotency key was already used for a different observation" }, 409);
      await admin.from("agroclimate_devices").update({ last_seen_at: new Date().toISOString() }).eq("id", device.id);
      return json({ accepted: true, duplicate: true, observation: existing });
    }
    if (error || !inserted) return json({ error: "Observation could not be persisted" }, 500);
    const { error: touchError } = await admin.from("agroclimate_devices")
      .update({ last_seen_at: new Date().toISOString() }).eq("id", device.id);
    if (touchError) return json({ error: "Observation stored but device heartbeat update failed" }, 500);
    return json({ accepted: true, duplicate: false, observation: inserted }, 201);
  }

  return json({ error: "action must be register, revoke or ingest" }, 400);
});
