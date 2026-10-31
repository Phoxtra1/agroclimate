import { supabase } from "@/integrations/supabase/client";
import type { GeoPoint } from "@/services/satellite/navigation";

export type MaritimeRiskLevel = "safe" | "moderate" | "high" | "critical";
export type VesselStatus = "ACTIVE" | "BUSY" | "OFFLINE";

export interface VesselRecord {
  id: string;
  owner_id: string | null;
  vessel_name: string | null;
  operator_name: string | null;
  operator_type: string | null;
  phone_number: string | null;
  home_lat: number | null;
  home_lon: number | null;
  status: VesselStatus;
  has_rescue_capability: boolean;
  created_at: string;
}

export interface MaritimeSosEvent {
  id: string;
  vessel_id: string;
  user_id: string | null;
  lat: number;
  lon: number;
  risk_level: MaritimeRiskLevel;
  message: string | null;
  status: "BROADCAST" | "ACCEPTED" | "RESOLVED";
  accepted_by_vessel_id: string | null;
  eta_minutes: number | null;
  notified_vessels: Array<{ vessel_id: string; vessel_name?: string; distance_km: number; rescue: boolean; last_seen_at: string }>;
  notified_responders: Array<{ id: string; name: string; agency: string | null; region: string | null }>;
  created_at: string;
  resolved_at: string | null;
}

export async function listMyVessels(): Promise<VesselRecord[]> {
  const { data, error } = await (supabase.from("vessels" as any) as any)
    .select("*").order("created_at", { ascending: false });
  if (error) throw new Error(error.message || "Could not load registered vessels.");
  return (data ?? []) as VesselRecord[];
}

export async function registerMyVessel(input: {
  vesselName: string;
  operatorName: string;
  operatorType: "private" | "commercial" | "rescue_team" | "navy";
  phoneNumber?: string;
  homeLocation?: GeoPoint;
  passengerCapacity?: number;
  cargoCapacityKg?: number;
  rescueCapable?: boolean;
}): Promise<VesselRecord> {
  const { data: userData, error: authError } = await supabase.auth.getUser();
  if (authError || !userData.user) throw new Error("Sign in before registering a vessel.");
  const id = `PXT-VSL-${crypto.randomUUID().replace(/-/g, "").slice(0, 8).toUpperCase()}`;
  const { data, error } = await (supabase.from("vessels" as any) as any).insert({
    id,
    owner_id: userData.user.id,
    vessel_name: input.vesselName.trim(),
    operator_name: input.operatorName.trim(),
    operator_type: input.operatorType,
    phone_number: input.phoneNumber?.trim() || null,
    home_lat: input.homeLocation?.lat ?? null,
    home_lon: input.homeLocation?.lon ?? null,
    max_capacity: Math.max(0, Math.round(input.passengerCapacity ?? 0)),
    cargo_capacity_kg: Math.max(0, input.cargoCapacityKg ?? 0),
    has_rescue_capability: input.rescueCapable === true,
    status: "ACTIVE",
  }).select("*").single();
  if (error) throw new Error(error.message || "Vessel registration failed.");
  return data as VesselRecord;
}

export async function setMyVesselStatus(vesselId: string, status: VesselStatus) {
  const { error } = await (supabase.from("vessels" as any) as any)
    .update({ status }).eq("id", vesselId);
  if (error) throw new Error(error.message || "Could not update vessel status.");
}

export async function saveMyVesselLocation(input: {
  vesselId: string;
  point: GeoPoint;
  accuracyM: number;
  capturedAt: string;
  speedMps?: number | null;
  headingDeg?: number | null;
}) {
  const { data: userData, error: authError } = await supabase.auth.getUser();
  if (authError || !userData.user) throw new Error("Sign in is required to share a vessel location.");
  if (!Number.isFinite(input.point.lat) || !Number.isFinite(input.point.lon)
    || input.point.lat < -90 || input.point.lat > 90 || input.point.lon < -180 || input.point.lon > 180) {
    throw new Error("Invalid GPS coordinates.");
  }
  if (!Number.isFinite(input.accuracyM) || input.accuracyM < 0.1 || input.accuracyM > 100) {
    throw new Error("Only a device GPS fix with accuracy of 100 m or better can be shared.");
  }
  const capturedAtMs = Date.parse(input.capturedAt);
  const ageMs = Date.now() - capturedAtMs;
  if (!Number.isFinite(capturedAtMs) || ageMs > 90000 || ageMs < -15000) {
    throw new Error("The vessel GPS fix is stale or has an invalid capture time.");
  }
  const { data, error } = await (supabase.from("vessel_locations" as any) as any).insert({
    vessel_id: input.vesselId,
    user_id: userData.user.id,
    lat: input.point.lat,
    lon: input.point.lon,
    accuracy_m: input.accuracyM,
    captured_at: input.capturedAt,
    location_source: "device_gps",
    speed_kn: input.speedMps == null ? null : Number((input.speedMps * 1.943844).toFixed(1)),
    heading: input.headingDeg ?? null,
    risk_level: null,
  }).select("id,vessel_id,lat,lon,accuracy_m,captured_at,location_source,speed_kn,heading,created_at").single();
  if (error) throw new Error(error.message || "Could not store GPS position.");
  return { ...data, accuracy_m: input.accuracyM };
}

async function invokeMaritime<T>(action: string, body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke("maritime-sos", {
    body: { action, ...body },
  });
  if (error) throw new Error(error.message || "Maritime service request failed.");
  if (data?.error) throw new Error(String(data.error));
  return data as T;
}

export function broadcastMaritimeSos(input: {
  vesselId: string;
  point: GeoPoint;
  riskLevel: MaritimeRiskLevel;
  message: string;
}) {
  return invokeMaritime<{
    event: { id: string; status: string; created_at: string };
    notified_vessels: MaritimeSosEvent["notified_vessels"];
    notified_responders: MaritimeSosEvent["notified_responders"];
    sms_enabled: boolean;
    sms_sent_count: number;
    location_freshness_minutes: number;
  }>("broadcast", {
    vessel_id: input.vesselId,
    location: input.point,
    risk_level: input.riskLevel,
    message: input.message,
  });
}

export function acceptMaritimeSos(input: { eventId: string; vesselId: string; point: GeoPoint }) {
  return invokeMaritime<{
    event: { id: string; status: string; accepted_by_vessel_id: string; eta_minutes: number };
    straight_line_distance_km: number;
    eta_minutes: number;
    eta_type: string;
  }>("accept", { event_id: input.eventId, vessel_id: input.vesselId, location: input.point });
}

export function resolveMaritimeSos(eventId: string, vesselId: string) {
  return invokeMaritime<{ event: { id: string; status: string } }>("resolve", {
    event_id: eventId,
    vessel_id: vesselId,
  });
}

export function sendMaritimeMessage(eventId: string, vesselId: string, message: string) {
  return invokeMaritime<{ message: { id: string; body: string; created_at: string } }>("message", {
    event_id: eventId,
    vessel_id: vesselId,
    message,
  });
}

export async function listOpenMaritimeEvents(): Promise<MaritimeSosEvent[]> {
  const { data, error } = await (supabase.from("sos_events" as any) as any)
    .select("*").neq("status", "RESOLVED").order("created_at", { ascending: false }).limit(30);
  if (error) throw new Error(error.message || "Could not load maritime emergencies.");
  return (data ?? []) as MaritimeSosEvent[];
}

export async function listMaritimeMessages(eventId: string) {
  const { data, error } = await (supabase.from("vessel_messages" as any) as any)
    .select("*").eq("sos_event_id", eventId).order("created_at", { ascending: true }).limit(100);
  if (error) throw new Error(error.message || "Could not load emergency messages.");
  return data ?? [];
}

export function subscribeMaritimeEvents(onEvent: (event: MaritimeSosEvent) => void) {
  const channel = supabase.channel("agroclimate-maritime-events")
    .on("postgres_changes", { event: "*", schema: "public", table: "sos_events" }, (payload) => {
      onEvent((payload.new ?? payload.old) as MaritimeSosEvent);
    }).subscribe();
  return () => { void supabase.removeChannel(channel); };
}

export function subscribeMaritimeMessages(eventId: string, onMessage: (message: any) => void) {
  const channel = supabase.channel(`agroclimate-maritime-messages-${eventId}`)
    .on("postgres_changes", {
      event: "INSERT", schema: "public", table: "vessel_messages",
      filter: `sos_event_id=eq.${eventId}`,
    }, (payload) => onMessage(payload.new))
    .subscribe();
  return () => { void supabase.removeChannel(channel); };
}

export function subscribeVesselPositions(vesselId: string, onPosition: (position: any) => void) {
  const channel = supabase.channel(`agroclimate-vessel-position-${vesselId}`)
    .on("postgres_changes", {
      event: "INSERT", schema: "public", table: "vessel_locations",
      filter: `vessel_id=eq.${vesselId}`,
    }, (payload) => onPosition(payload.new))
    .subscribe();
  return () => { void supabase.removeChannel(channel); };
}
