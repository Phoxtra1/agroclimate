import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type LatLng = { lat: number; lon: number };
type Action = "broadcast" | "accept" | "resolve" | "message";

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "no-store" },
  });

function validPoint(value: unknown): value is LatLng {
  if (!value || typeof value !== "object") return false;
  const p = value as Record<string, unknown>;
  return typeof p.lat === "number" && Number.isFinite(p.lat) && p.lat >= -90 && p.lat <= 90
    && typeof p.lon === "number" && Number.isFinite(p.lon) && p.lon >= -180 && p.lon <= 180;
}

function distanceKm(a: LatLng, b: LatLng): number {
  const radius = 6371;
  const dLat = (b.lat - a.lat) * Math.PI / 180;
  const dLon = (b.lon - a.lon) * Math.PI / 180;
  const h = Math.sin(dLat / 2) ** 2
    + Math.cos(a.lat * Math.PI / 180) * Math.cos(b.lat * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return 2 * radius * Math.asin(Math.sqrt(h));
}

async function hasFreshVesselFix(adminClient: any, vesselId: string, userId: string, point: LatLng): Promise<boolean> {
  const { data, error } = await adminClient
    .from("vessel_locations")
    .select("lat,lon,accuracy_m,captured_at,location_source")
    .eq("vessel_id", vesselId)
    .eq("user_id", userId)
    .eq("location_source", "device_gps")
    .order("captured_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error || !data || !Number.isFinite(data.accuracy_m) || data.accuracy_m < 0.1 || data.accuracy_m > 100) return false;
  const capturedAt = Date.parse(data.captured_at);
  const ageMs = Date.now() - capturedAt;
  if (!Number.isFinite(capturedAt) || ageMs > 30000 || ageMs < -15000) return false;
  const separationM = distanceKm(point, { lat: data.lat, lon: data.lon }) * 1000;
  return Number.isFinite(separationM) && separationM <= Math.max(75, data.accuracy_m + 50);
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "POST required" }, 405);

  const authorization = req.headers.get("Authorization") || "";
  if (!authorization.startsWith("Bearer ")) return json({ error: "Sign in required" }, 401);

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("SUPABASE_PUBLISHABLE_KEY");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !anonKey || !serviceRoleKey) return json({ error: "Maritime services are not configured" }, 503);

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authorization } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: authData, error: authError } = await userClient.auth.getUser();
    if (authError || !authData.user) return json({ error: "Session expired. Sign in again." }, 401);

    const user = authData.user;
    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const body = await req.json().catch(() => ({}));
    const action = String(body.action || "") as Action;
    const vesselId = String(body.vessel_id || "").trim();

    if (!["broadcast", "accept", "resolve", "message"].includes(action)) {
      return json({ error: "Unsupported maritime action" }, 400);
    }

    if (action === "broadcast") {
      if (!vesselId || !validPoint(body.location)) return json({ error: "A registered vessel and current GPS coordinates are required" }, 400);
      const { data: vessel, error: vesselError } = await adminClient
        .from("vessels").select("id,status,owner_id").eq("id", vesselId).eq("owner_id", user.id).maybeSingle();
      if (vesselError || !vessel) return json({ error: "This vessel is not registered to your account" }, 403);
      if (vessel.status === "OFFLINE") return json({ error: "Set the vessel to active before broadcasting an emergency" }, 409);
      if (!await hasFreshVesselFix(adminClient, vesselId, user.id, body.location)) {
        return json({ error: "No matching, accurate and recent device GPS fix is recorded for this vessel. Refresh location sharing before broadcasting." }, 409);
      }

      const since = new Date(Date.now() - 15 * 60 * 1000).toISOString();
      const [{ data: vessels, error: vesselsError }, { data: locations, error: locationsError }, { data: responders, error: respondersError }] = await Promise.all([
        adminClient.from("vessels").select("id,vessel_name,phone_number,has_rescue_capability,status").eq("status", "ACTIVE").neq("id", vesselId),
        adminClient.from("vessel_locations").select("vessel_id,lat,lon,captured_at,accuracy_m,location_source").eq("location_source", "device_gps").gte("captured_at", since).lte("accuracy_m", 100).order("captured_at", { ascending: false }).limit(1000),
        adminClient.from("external_responders").select("id,name,agency,phone_number,region").eq("active", true),
      ]);
      if (vesselsError || locationsError || respondersError) return json({ error: "Could not retrieve current responder availability" }, 502);

      const latestByVessel = new Map<string, { lat: number; lon: number; at: string }>();
      for (const point of locations || []) {
        if (!latestByVessel.has(point.vessel_id)) {
          latestByVessel.set(point.vessel_id, { lat: point.lat, lon: point.lon, at: point.captured_at });
        }
      }

      const notifiedVessels = (vessels || [])
        .map((candidate) => {
          const point = latestByVessel.get(candidate.id);
          if (!point) return null;
          return {
            vessel_id: candidate.id,
            vessel_name: candidate.vessel_name,
            distance_km: Number(distanceKm(body.location, point).toFixed(2)),
            last_seen_at: point.at,
            rescue: candidate.has_rescue_capability === true,
          };
        })
        .filter(Boolean)
        .sort((a, b) => Number(b!.rescue) - Number(a!.rescue) || Number(a!.distance_km) - Number(b!.distance_km))
        .slice(0, 5);

      const { data: event, error: insertError } = await adminClient.from("sos_events").insert({
        vessel_id: vesselId,
        user_id: user.id,
        lat: body.location.lat,
        lon: body.location.lon,
        risk_level: ["safe", "moderate", "high", "critical"].includes(body.risk_level) ? body.risk_level : "high",
        message: String(body.message || "Emergency assistance requested").slice(0, 1000),
        status: "BROADCAST",
        notified_vessels: notifiedVessels,
        notified_responders: (responders || []).map((r) => ({ id: r.id, name: r.name, agency: r.agency, region: r.region })),
      }).select("id,status,created_at").single();

      if (insertError || !event) return json({ error: insertError?.message || "Could not create SOS event" }, 500);

      // SMS fan-out is deliberately opt-in. Without an approved SMS account and
      // sender policy, the app sends an in-app realtime broadcast only.
      const smsEnabled = Deno.env.get("MARITIME_SMS_ENABLED") === "true";
      let smsQueued = 0;
      if (smsEnabled && Deno.env.get("AFRICASTALKING_API_KEY")) {
        const smsTargets = [
          ...(notifiedVessels || []).map((v) => ({ phone: (vessels || []).find((r) => r.id === v!.vessel_id)?.phone_number })),
          ...(responders || []).map((r) => ({ phone: r.phone_number })),
        ].filter((item) => typeof item.phone === "string" && item.phone.trim().length > 0);
        for (const target of smsTargets) {
          try {
            const { error } = await adminClient.functions.invoke("send-sms", {
              body: {
                to: target.phone,
                username: Deno.env.get("AFRICASTALKING_USERNAME") || "sandbox",
                message: `AGROCLIMATE MARITIME SOS: ${body.message || "Emergency assistance requested"}. Coordinates ${body.location.lat.toFixed(5)}, ${body.location.lon.toFixed(5)}. Event ${event.id}.`,
              },
            });
            if (!error) smsQueued += 1;
          } catch (error) {
            console.warn("Optional maritime SMS dispatch failed:", error);
          }
        }
      }

      return json({
        event,
        notified_vessels: notifiedVessels,
        notified_responders: (responders || []).map((r) => ({ id: r.id, name: r.name, agency: r.agency, region: r.region })),
        sms_enabled: smsEnabled,
        sms_sent_count: smsQueued,
        location_freshness_minutes: 15,
      });
    }

    if (action === "accept") {
      const eventId = String(body.event_id || "");
      if (!eventId || !vesselId || !validPoint(body.location)) return json({ error: "Event, registered vessel and current GPS coordinates are required" }, 400);
      const { data: vessel } = await adminClient.from("vessels").select("id,owner_id").eq("id", vesselId).eq("owner_id", user.id).maybeSingle();
      if (!vessel) return json({ error: "This vessel is not registered to your account" }, 403);
      if (!await hasFreshVesselFix(adminClient, vesselId, user.id, body.location)) {
        return json({ error: "A matching, accurate and recent device GPS fix is required to accept a rescue." }, 409);
      }

      const { data: event } = await adminClient.from("sos_events").select("*").eq("id", eventId).eq("status", "BROADCAST").maybeSingle();
      if (!event) return json({ error: "This emergency has already been accepted or resolved" }, 409);
      const notified = Array.isArray(event.notified_vessels) ? event.notified_vessels : [];
      if (!notified.some((candidate: any) => candidate.vessel_id === vesselId)) {
        return json({ error: "This vessel was not among the notified nearby responders" }, 403);
      }

      const target = { lat: event.lat, lon: event.lon };
      const straightLineKm = distanceKm(body.location, target);
      const eta = Math.max(1, Math.round(straightLineKm / 30 * 60));
      const { data: accepted, error: acceptError } = await adminClient.from("sos_events")
        .update({ status: "ACCEPTED", accepted_by_vessel_id: vesselId, eta_minutes: eta })
        .eq("id", eventId).eq("status", "BROADCAST").select("id,status,accepted_by_vessel_id,eta_minutes").maybeSingle();
      if (acceptError) return json({ error: acceptError.message }, 500);
      if (!accepted) return json({ error: "Another responder accepted this emergency first" }, 409);
      await adminClient.from("vessels").update({ status: "BUSY" }).eq("id", vesselId);
      return json({ event: accepted, straight_line_distance_km: Number(straightLineKm.toFixed(2)), eta_minutes: eta, eta_type: "straight-line planning estimate, not road or water routing" });
    }

    if (action === "resolve") {
      const eventId = String(body.event_id || "");
      if (!eventId) return json({ error: "Event ID required" }, 400);
      const { data: event } = await adminClient.from("sos_events").select("*").eq("id", eventId).maybeSingle();
      if (!event) return json({ error: "Emergency event not found" }, 404);
      const { data: vessel } = await adminClient.from("vessels").select("id,owner_id").eq("owner_id", user.id).in("id", [event.vessel_id, event.accepted_by_vessel_id].filter(Boolean)).maybeSingle();
      const { data: adminRole } = await adminClient.from("user_roles").select("role").eq("user_id", user.id).eq("role", "admin").maybeSingle();
      if (!vessel && !adminRole) return json({ error: "Only the reporting or accepting vessel can resolve this emergency" }, 403);
      const { data: resolved, error } = await adminClient.from("sos_events").update({
        status: "RESOLVED", resolved_at: new Date().toISOString(),
      }).eq("id", eventId).neq("status", "RESOLVED").select("id,status,resolved_at").maybeSingle();
      if (error) return json({ error: error.message }, 500);
      if (event.accepted_by_vessel_id) await adminClient.from("vessels").update({ status: "ACTIVE" }).eq("id", event.accepted_by_vessel_id);
      return json({ event: resolved || { id: eventId, status: "RESOLVED" } });
    }

    if (action === "message") {
      const eventId = String(body.event_id || "");
      const text = String(body.message || "").trim();
      if (!eventId || !vesselId || !text || text.length > 2000) return json({ error: "Event, sender vessel and message (1-2000 characters) are required" }, 400);
      const { data: vessel } = await adminClient.from("vessels").select("id,owner_id").eq("id", vesselId).eq("owner_id", user.id).maybeSingle();
      if (!vessel) return json({ error: "Sender vessel is not registered to your account" }, 403);
      const { data: event } = await adminClient.from("sos_events").select("id,vessel_id,accepted_by_vessel_id").eq("id", eventId).maybeSingle();
      if (!event || ![event.vessel_id, event.accepted_by_vessel_id].includes(vesselId)) return json({ error: "Vessel is not a participant in this emergency" }, 403);
      const toVesselId = event.vessel_id === vesselId ? event.accepted_by_vessel_id : event.vessel_id;
      const { data: saved, error } = await adminClient.from("vessel_messages").insert({
        sos_event_id: eventId, from_vessel_id: vesselId, to_vessel_id: toVesselId, body: text,
      }).select("id,sos_event_id,from_vessel_id,to_vessel_id,body,created_at").single();
      if (error) return json({ error: error.message }, 500);
      return json({ message: saved });
    }

    return json({ error: "Unsupported action" }, 400);
  } catch (error) {
    console.error("maritime-sos error:", error);
    return json({ error: error instanceof Error ? error.message : "Unexpected maritime service error" }, 500);
  }
});
