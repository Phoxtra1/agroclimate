// Post-Harvest Station device gateway.
// Authenticated owners provision devices; physical stations ingest readings using
// a one-time-issued bearer token. This endpoint never treats a registration as live.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-device-token",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const hex = (bytes: Uint8Array) => Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
const sha256 = async (value: string) => hex(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value))));
const newToken = () => {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
};

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
  const rawBody = await req.text();
  if (rawBody.length > 16_384) return json({ error: "Request body is too large" }, 413);
  let body: any = null;
  try { body = JSON.parse(rawBody); } catch { return json({ error: "A valid JSON body is required" }, 400); }
  if (!body || typeof body !== "object" || Array.isArray(body)) return json({ error: "A JSON object is required" }, 400);

  if (body.action === "register") {
    const authorization = req.headers.get("Authorization");
    if (!authorization) return json({ error: "Owner authentication required" }, 401);
    const ownerClient = createClient(url, anonKey, {
      global: { headers: { Authorization: authorization } },
      auth: { persistSession: false },
    });
    const { data: { user }, error: authError } = await ownerClient.auth.getUser();
    if (authError || !user) return json({ error: "Invalid owner session" }, 401);

    const deviceName = typeof body.device_name === "string" ? body.device_name.trim() : "";
    const hardwareId = typeof body.hardware_id === "string" ? body.hardware_id.trim() : "";
    const model = typeof body.model === "string" ? body.model.trim().slice(0, 100) : null;
    const harvestEntryId = typeof body.harvest_entry_id === "string" ? body.harvest_entry_id : null;
    if (!deviceName || deviceName.length > 100 || !hardwareId || hardwareId.length > 160) {
      return json({ error: "device_name and hardware_id are required (maximum 100 and 160 characters)" }, 400);
    }

    if (harvestEntryId) {
      const { data: entry } = await admin.from("post_harvest_entries").select("id")
        .eq("id", harvestEntryId).eq("user_id", user.id).maybeSingle();
      if (!entry) return json({ error: "Harvest record not found for this owner" }, 404);
    }

    const token = newToken();
    const tokenHash = await sha256(token);
    const { data: device, error: insertError } = await admin.from("post_harvest_station_devices")
      .insert({ user_id: user.id, device_name: deviceName, hardware_id: hardwareId, model, harvest_entry_id: harvestEntryId })
      .select("id,user_id,device_name,hardware_id,model,status,harvest_entry_id,created_at")
      .single();
    if (insertError) return json({ error: insertError.code === "23505" ? "A device with this hardware_id is already registered to this account" : insertError.message }, 400);

    const { error: credentialError } = await admin.from("post_harvest_station_credentials")
      .insert({ device_id: device.id, token_hash: tokenHash });
    if (credentialError) {
      await admin.from("post_harvest_station_devices").delete().eq("id", device.id);
      return json({ error: "Could not securely provision device credentials" }, 500);
    }
    return json({ device, device_token: token, token_notice: "Store this token securely. It is shown only once." }, 201);
  }

  if (body.action === "revoke") {
    const authorization = req.headers.get("Authorization");
    if (!authorization) return json({ error: "Owner authentication required" }, 401);
    const ownerClient = createClient(url, anonKey, {
      global: { headers: { Authorization: authorization } },
      auth: { persistSession: false },
    });
    const { data: { user }, error: authError } = await ownerClient.auth.getUser();
    if (authError || !user) return json({ error: "Invalid owner session" }, 401);
    const deviceId = typeof body.device_id === "string" ? body.device_id : "";
    if (!deviceId) return json({ error: "device_id required" }, 400);
    const { data: device } = await admin.from("post_harvest_station_devices")
      .select("id").eq("id", deviceId).eq("user_id", user.id).maybeSingle();
    if (!device) return json({ error: "Station not found for this owner" }, 404);
    const now = new Date().toISOString();
    const { error: credentialError } = await admin.from("post_harvest_station_credentials")
      .update({ revoked_at: now }).eq("device_id", deviceId);
    if (credentialError) return json({ error: "Could not revoke device credential" }, 500);
    const { error: deviceError } = await admin.from("post_harvest_station_devices")
      .update({ status: "revoked" }).eq("id", deviceId).eq("user_id", user.id);
    if (deviceError) return json({ error: "Could not update station status" }, 500);
    return json({ revoked: true, device_id: deviceId });
  }

  if (body.action === "ingest") {
    const token = req.headers.get("x-device-token");
    if (!token || token.length < 32 || token.length > 256) return json({ error: "Valid x-device-token required" }, 401);
    const tokenHash = await sha256(token);
    const { data: credential } = await admin.from("post_harvest_station_credentials")
      .select("device_id,revoked_at,post_harvest_station_devices!inner(id,user_id,status,harvest_entry_id)")
      .eq("token_hash", tokenHash).maybeSingle();
    if (!credential || credential.revoked_at) return json({ error: "Invalid or revoked device token" }, 401);
    const device = (credential as any).post_harvest_station_devices;
    if (device.status !== "active") return json({ error: "Device is not active" }, 403);

    // Do not coerce strings, null, or empty values into numeric measurements:
    // Number("") and Number(null) both become zero and could create false readings.
    const temperature = body.temperature_c;
    const humidity = body.humidity_pct;
    const observedAtValue = body.observed_at;
    const observedAt = typeof observedAtValue === "string" ? new Date(observedAtValue) : null;
    const idempotencyKey = typeof body.idempotency_key === "string" ? body.idempotency_key.trim() : "";
    const sequenceNo = body.sequence_no == null ? null : body.sequence_no;
    const timestampIsExplicitAndValid = !!observedAt &&
      /^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}(\\.\\d+)?(Z|[+-]\\d{2}:\\d{2})$/.test(observedAtValue) &&
      Number.isFinite(observedAt.getTime());
    if (typeof temperature !== "number" || !Number.isFinite(temperature) || temperature < -40 || temperature > 85 ||
        typeof humidity !== "number" || !Number.isFinite(humidity) || humidity < 0 || humidity > 100 ||
        !timestampIsExplicitAndValid || observedAt!.getTime() > Date.now() + 5 * 60_000 ||
        !idempotencyKey || idempotencyKey.length > 160 ||
        (sequenceNo !== null && (typeof sequenceNo !== "number" || !Number.isSafeInteger(sequenceNo) || sequenceNo < 0))) {
      return json({ error: "Invalid reading. Supply numeric temperature_c (-40..85), numeric humidity_pct (0..100), a timezone-aware ISO 8601 observed_at, idempotency_key and optional non-negative integer sequence_no." }, 400);
    }

    const harvestEntryId = typeof body.harvest_entry_id === "string" ? body.harvest_entry_id : device.harvest_entry_id;
    if (harvestEntryId) {
      const { data: entry } = await admin.from("post_harvest_entries").select("id")
        .eq("id", harvestEntryId).eq("user_id", device.user_id).maybeSingle();
      if (!entry) return json({ error: "Harvest record is not owned by this device account" }, 403);
    }

    const { data: inserted, error: insertError } = await admin.from("post_harvest_station_observations")
      .insert({
        device_id: device.id, user_id: device.user_id, harvest_entry_id: harvestEntryId,
        observed_at: observedAt.toISOString(), temperature_c: temperature, humidity_pct: humidity,
        sequence_no: sequenceNo, idempotency_key: idempotencyKey,
        raw_payload: {
          firmware: typeof body.firmware === "string" ? body.firmware.slice(0, 80) : null,
          sensor_model: typeof body.sensor_model === "string" ? body.sensor_model.slice(0, 100) : null,
        },
      })
      .select("id,device_id,harvest_entry_id,observed_at,received_at,temperature_c,humidity_pct,sequence_no")
      .maybeSingle();

    if (insertError?.code === "23505") {
      const { data: existing, error: lookupError } = await admin.from("post_harvest_station_observations")
        .select("id,device_id,harvest_entry_id,observed_at,received_at,temperature_c,humidity_pct,sequence_no")
        .eq("device_id", device.id).eq("idempotency_key", idempotencyKey).maybeSingle();
      if (lookupError || !existing) {
        console.error("[post-harvest-station] duplicate lookup failed", lookupError);
        return json({ error: "The duplicate reading could not be confirmed. Retry with the same idempotency_key." }, 503);
      }
      const { error: touchError } = await admin.from("post_harvest_station_devices")
        .update({ last_seen_at: new Date().toISOString() }).eq("id", device.id);
      if (touchError) return json({ error: "Duplicate reading is stored, but device signal time could not be refreshed" }, 500);
      return json({ accepted: true, duplicate: true, observation: existing });
    }
    if (insertError) return json({ error: "Could not persist sensor observation" }, 500);

    const { error: touchError } = await admin.from("post_harvest_station_devices")
      .update({ last_seen_at: new Date().toISOString() }).eq("id", device.id);
    if (touchError) return json({ error: "Observation is stored, but device signal time could not be refreshed" }, 500);
    return json({ accepted: true, duplicate: false, observation: inserted }, 201);
  }

  return json({ error: "action must be register or ingest" }, 400);
});
