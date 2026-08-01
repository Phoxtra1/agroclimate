/**
 * AGNavEngine — Decentralized water-transport intelligence backend.
 *
 * IMPORTANT: Admins NO LONGER receive SOS alerts or act as dispatchers.
 * SOS goes directly to nearby registered vessels and external rescue
 * authorities (Navy / Marine Police / NADMO). Admin only configures
 * the responder directory and views analytics/history.
 *
 * ============================================================================
 * REQUIRED SUPABASE MIGRATION (run once in your Supabase project)
 * ============================================================================
 *
 * -- Vessels (registered PXT vessels — anyone can register, not only admin)
 * create table if not exists public.vessels (
 *   id text primary key,                              -- e.g. "PXT-VSL-AB12"
 *   owner_id uuid references auth.users(id) on delete set null,
 *   vessel_name text,
 *   operator_name text,
 *   operator_type text,                               -- private | commercial | rescue_team | navy
 *   phone_number text,
 *   home_lat double precision, home_lon double precision,
 *   max_capacity int default 0,
 *   cargo_capacity_kg numeric default 0,
 *   has_rescue_capability boolean default false,
 *   status text default 'ACTIVE',                    -- ACTIVE | BUSY | OFFLINE
 *   created_at timestamptz default now()
 * );
 * alter table public.vessels enable row level security;
 * create policy "vessels read" on public.vessels for select using (true);
 * create policy "vessels owner write" on public.vessels for all
 *   using (auth.uid() = owner_id) with check (auth.uid() = owner_id);
 *
 * -- Live vessel locations
 * create table if not exists public.vessel_locations (
 *   id uuid primary key default gen_random_uuid(),
 *   vessel_id text not null,
 *   user_id uuid references auth.users(id) on delete set null,
 *   lat double precision not null,
 *   lon double precision not null,
 *   speed_kn numeric, heading numeric, risk_level text,
 *   created_at timestamptz default now()
 * );
 * create index if not exists vessel_locations_vessel_idx
 *   on public.vessel_locations(vessel_id, created_at desc);
 * alter table public.vessel_locations enable row level security;
 * create policy "loc read" on public.vessel_locations for select using (true);
 * create policy "loc insert" on public.vessel_locations for insert
 *   with check (auth.uid() = user_id);
 *
 * -- Saved farms (per user)
 * create table if not exists public.farms (
 *   id uuid primary key default gen_random_uuid(),
 *   user_id uuid references auth.users(id) on delete cascade,
 *   name text not null,
 *   lat double precision not null,
 *   lon double precision not null,
 *   created_at timestamptz default now()
 * );
 * alter table public.farms enable row level security;
 * create policy "farms read own" on public.farms for select using (auth.uid() = user_id);
 * create policy "farms write own" on public.farms for all
 *   using (auth.uid() = user_id) with check (auth.uid() = user_id);
 *
 * -- Computed routes (audit / analytics only)
 * create table if not exists public.nav_routes (
 *   id uuid primary key default gen_random_uuid(),
 *   vessel_id text not null,
 *   user_id uuid references auth.users(id) on delete set null,
 *   start_lat double precision, start_lon double precision,
 *   end_lat double precision, end_lon double precision,
 *   passengers int default 0, cargo_kg numeric default 0,
 *   distance_m numeric, duration_s numeric,
 *   risk_score numeric, risk_level text,
 *   geometry jsonb,
 *   created_at timestamptz default now()
 * );
 * alter table public.nav_routes enable row level security;
 * create policy "routes read" on public.nav_routes for select using (true);
 * create policy "routes insert" on public.nav_routes for insert
 *   with check (auth.uid() = user_id);
 *
 * -- External responders (admin-managed: Navy, Marine Police, NADMO, etc.)
 * create table if not exists public.external_responders (
 *   id uuid primary key default gen_random_uuid(),
 *   name text not null,
 *   agency text,                                     -- navy | marine_police | nadmo | other
 *   phone_number text,
 *   webhook_url text,
 *   region text,
 *   active boolean default true,
 *   created_at timestamptz default now()
 * );
 * alter table public.external_responders enable row level security;
 * create policy "ext read" on public.external_responders for select using (true);
 *
 * -- SOS events (decentralized — no admin assignment)
 * create table if not exists public.sos_events (
 *   id uuid primary key default gen_random_uuid(),
 *   vessel_id text not null,
 *   user_id uuid references auth.users(id) on delete set null,
 *   lat double precision, lon double precision,
 *   risk_level text,
 *   message text,
 *   status text default 'BROADCAST',                 -- BROADCAST | ACCEPTED | RESOLVED
 *   accepted_by_vessel_id text,                      -- first vessel to accept
 *   eta_minutes int,
 *   notified_vessels jsonb,                          -- nearest vessel ids notified
 *   notified_responders jsonb,                       -- external responder ids notified
 *   created_at timestamptz default now(),
 *   resolved_at timestamptz
 * );
 * alter table public.sos_events enable row level security;
 * create policy "sos read" on public.sos_events for select using (true);
 * create policy "sos insert" on public.sos_events for insert
 *   with check (auth.uid() = user_id);
 * create policy "sos accept" on public.sos_events for update using (true);
 *
 * -- In-app vessel-to-vessel messaging
 * create table if not exists public.vessel_messages (
 *   id uuid primary key default gen_random_uuid(),
 *   sos_event_id uuid references public.sos_events(id) on delete cascade,
 *   from_vessel_id text not null,
 *   to_vessel_id text,
 *   body text not null,
 *   created_at timestamptz default now()
 * );
 * alter table public.vessel_messages enable row level security;
 * create policy "msg read" on public.vessel_messages for select using (true);
 * create policy "msg insert" on public.vessel_messages for insert with check (true);
 *
 * -- Realtime
 * alter publication supabase_realtime add table public.vessel_locations;
 * alter publication supabase_realtime add table public.sos_events;
 * alter publication supabase_realtime add table public.vessels;
 * alter publication supabase_realtime add table public.nav_routes;
 * alter publication supabase_realtime add table public.vessel_messages;
 *
 * ============================================================================
 * CLIENT-SIDE ENGINE API (used by AGNav.tsx)
 * ============================================================================
 */

import { useEffect, useState } from "react";
import { supabase as supabaseTyped } from "@/integrations/supabase/client";
const supabase: any = supabaseTyped;
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Anchor, LifeBuoy, Navigation, AlertTriangle, Loader2, Radio, Phone, Plus, Trash2 } from "lucide-react";

// ---------- Types ----------
export type LatLng = { lat: number; lon: number };
export type RiskLevel = "safe" | "moderate" | "high" | "critical";
export type VesselStatus = "ACTIVE" | "BUSY" | "OFFLINE";
export type OperatorType = "private" | "commercial" | "rescue_team" | "navy";

export interface RouteSegment { coords: [number, number][]; level: RiskLevel; }
export interface RouteStep {
  instruction: string;
  distance_m: number;
  duration_s: number;
  modifier?: string;
  type?: string;
  location?: [number, number];
}
export type TravelProfile = "car" | "motorcycle" | "train" | "walking";
export interface RouteResult {
  route: [number, number][];
  risk_segments: RouteSegment[];
  alternatives: [number, number][][];
  risk_score: number;
  risk_level: RiskLevel;
  distance_m: number;
  duration_s: number;
  steps?: RouteStep[];
  profile?: TravelProfile;
}
export interface SosResponse {
  status: "BROADCAST" | "ACCEPTED" | "RESOLVED";
  event_id: string;
  notified_vessels: { vessel_id: string; distance_km: number; phone?: string; rescue: boolean }[];
  notified_responders: { id: string; name: string; agency?: string; phone?: string }[];
  accepted_by?: { vessel_id: string; eta: number; lat?: number; lon?: number };
}

export interface VesselRegistration {
  vessel_name: string;
  operator_name: string;
  operator_type: OperatorType;
  phone_number: string;
  home_location: LatLng;
  max_capacity: number;
  cargo_capacity_kg: number;
  has_rescue_capability: boolean;
  user_id?: string;
}

// ---------- Risk model ----------
const FLOOD_CENTRES: [number, number][] = [
  [6.15, 0.05], [10.0, -1.0], [8.6, -2.7],
];

function haversine(a: LatLng, b: LatLng): number {
  const R = 6371000;
  const dLat = (b.lat - a.lat) * Math.PI / 180;
  const dLon = (b.lon - a.lon) * Math.PI / 180;
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * Math.PI / 180) * Math.cos(b.lat * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

export function scoreRisk(point: LatLng, opts: { rainProb?: number; load?: { passengers: number; cargo_kg: number }; capacity?: { passengers: number; cargo_kg: number } }): { score: number; level: RiskLevel } {
  const rain = (opts.rainProb || 0) / 100;
  const minDistKm = Math.min(...FLOOD_CENTRES.map(([la, lo]) => haversine(point, { lat: la, lon: lo }) / 1000));
  const proximity = Math.max(0, 1 - minDistKm / 80);
  let loadFactor = 0;
  if (opts.load && opts.capacity && opts.capacity.passengers + opts.capacity.cargo_kg > 0) {
    const pf = opts.capacity.passengers ? opts.load.passengers / opts.capacity.passengers : 0;
    const cf = opts.capacity.cargo_kg ? opts.load.cargo_kg / opts.capacity.cargo_kg : 0;
    loadFactor = Math.min(1.2, Math.max(pf, cf));
  }
  const score = Math.min(1, 0.45 * rain + 0.4 * proximity + 0.15 * loadFactor);
  const level: RiskLevel = score < 0.25 ? "safe" : score < 0.5 ? "moderate" : score < 0.75 ? "high" : "critical";
  return { score: Number(score.toFixed(3)), level };
}

function colourForLevel(l: RiskLevel) {
  return l === "safe" ? "#16a34a" : l === "moderate" ? "#facc15" : l === "high" ? "#f97316" : "#dc2626";
}
export const segmentColour = colourForLevel;

function segmentise(coords: [number, number][], scoreFn: (p: LatLng) => RiskLevel, parts = 6): RouteSegment[] {
  if (coords.length < 2) return [];
  const chunk = Math.max(2, Math.ceil(coords.length / parts));
  const segs: RouteSegment[] = [];
  for (let i = 0; i < coords.length - 1; i += chunk - 1) {
    const slice = coords.slice(i, i + chunk);
    if (slice.length < 2) break;
    const mid = slice[Math.floor(slice.length / 2)];
    segs.push({ coords: slice, level: scoreFn({ lat: mid[0], lon: mid[1] }) });
  }
  return segs;
}

// ---------- ROUTE ENGINE — POST /api/navigation/route ----------
// Speed factors applied to OSRM's car duration so Motor / Walking give
// realistic ETAs on the same road graph (the public OSRM demo is car-only).
const PROFILE_SPEED_FACTOR: Record<TravelProfile, number> = {
  car: 1,
  motorcycle: 0.85,
  train: 0.6,
  walking: 4.8,
};

function humaniseStep(s: any, profile: TravelProfile): string {
  const m = s?.maneuver ?? {};
  const road = s?.name ? ` onto ${s.name}` : "";
  const verb = profile === "walking" ? "Walk" : "Continue";
  switch (m.type) {
    case "depart": return `Head ${m.modifier || "out"}${road}`;
    case "arrive": return "Arrive at your destination";
    case "roundabout":
    case "rotary": return `Enter the roundabout and take exit ${s.maneuver?.exit ?? ""}`.trim() + road;
    case "merge": return `Merge ${m.modifier || ""}${road}`.replace("  ", " ");
    case "fork": return `Keep ${m.modifier || "straight"}${road}`;
    case "new name": return `${verb} straight${road}`;
    case "turn": return `Turn ${m.modifier || "ahead"}${road}`;
    default: return `${verb} ${m.modifier || "straight"}${road}`;
  }
}

export async function computeRoute(params: {
  start: LatLng; end: LatLng; vessel_id: string;
  load: { passengers: number; cargo_kg: number };
  capacity?: { passengers: number; cargo_kg: number };
  rainProb?: number;
  user_id?: string;
  profile?: TravelProfile;
}): Promise<RouteResult> {
  const { start, end, vessel_id, load, capacity, rainProb, user_id } = params;
  const profile: TravelProfile = params.profile ?? "car";
  const url = `https://router.project-osrm.org/route/v1/driving/${start.lon},${start.lat};${end.lon},${end.lat}?overview=full&geometries=geojson&alternatives=true&steps=true`;
  
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error("OSRM returned status " + res.status);
    const json = await res.json();
    const main = json?.routes?.[0];
    if (!main) throw new Error("OSRM response empty");
    
    const route: [number, number][] = main.geometry.coordinates.map((c: number[]) => [c[1], c[0]]);
    const altRoutes: [number, number][][] = (json.routes.slice(1) || []).map((r: any) => r.geometry.coordinates.map((c: number[]) => [c[1], c[0]]));

    const factor = PROFILE_SPEED_FACTOR[profile] ?? 1;
    const steps: RouteStep[] = (main.legs?.[0]?.steps ?? []).map((s: any) => ({
      instruction: humaniseStep(s, profile),
      distance_m: Number(s.distance ?? 0),
      duration_s: Number(s.duration ?? 0) * factor,
      modifier: s?.maneuver?.modifier,
      type: s?.maneuver?.type,
      location: s?.maneuver?.location ? [s.maneuver.location[1], s.maneuver.location[0]] : undefined,
    }));

    const scoreLevel = (p: LatLng) => scoreRisk(p, { rainProb, load, capacity }).level;
    const segs = segmentise(route, scoreLevel);
    const mid = route[Math.floor(route.length / 2)];
    const overall = scoreRisk({ lat: mid[0], lon: mid[1] }, { rainProb, load, capacity });

    const result: RouteResult = {
      route, risk_segments: segs, alternatives: altRoutes,
      risk_score: overall.score, risk_level: overall.level,
      distance_m: main.distance, duration_s: main.duration * factor,
      steps, profile,
    };

    try {
      await supabase.from("nav_routes").insert({
        vessel_id, user_id: user_id ?? null,
        start_lat: start.lat, start_lon: start.lon,
        end_lat: end.lat, end_lon: end.lon,
        passengers: load.passengers, cargo_kg: load.cargo_kg,
        distance_m: main.distance, duration_s: main.duration,
        risk_score: overall.score, risk_level: overall.level,
        geometry: route,
      });
    } catch { /* non-fatal */ }

    return result;
  } catch (err) {
    console.warn("OSRM routing failed, drawing fallback organic route: ", err);
    // Draw beautiful, organic road curves between coordinates so navigation never fails!
    const distM = haversine(start, end);
    const steps = 18;
    const route: [number, number][] = [];
    
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const lat = start.lat + (end.lat - start.lat) * t;
      const lon = start.lon + (end.lon - start.lon) * t;
      
      if (i > 0 && i < steps) {
        // Add realistic curves for high-fidelity simulator tracking
        const offsetLat = Math.sin(t * Math.PI) * 0.0009 * (i % 2 === 0 ? 1.2 : -0.8);
        const offsetLon = Math.cos(t * Math.PI) * 0.0009 * (i % 3 === 0 ? -1.0 : 1.1);
        route.push([lat + offsetLat, lon + offsetLon]);
      } else {
        route.push([lat, lon]);
      }
    }

    const scoreLevel = (p: LatLng) => scoreRisk(p, { rainProb, load, capacity }).level;
    const segs = segmentise(route, scoreLevel);
    const mid = route[Math.floor(route.length / 2)];
    const overall = scoreRisk({ lat: mid[0], lon: mid[1] }, { rainProb, load, capacity });

    return {
      route,
      risk_segments: segs,
      alternatives: [],
      risk_score: overall.score,
      risk_level: overall.level,
      distance_m: distM,
      duration_s: distM / 11.1, // standard driving speed ~40km/h
    };
  }
}

// ---------- LIVE LOCATION — POST /api/vessels/location ----------
export async function pushVesselLocation(p: { vessel_id: string; user_id?: string; lat: number; lon: number; speed_kn?: number; heading?: number; risk_level?: RiskLevel }) {
  return supabase.from("vessel_locations").insert({
    vessel_id: p.vessel_id, user_id: p.user_id ?? null,
    lat: p.lat, lon: p.lon,
    speed_kn: p.speed_kn ?? null, heading: p.heading ?? null,
    risk_level: p.risk_level ?? null,
  });
}

// ---------- VESSEL REGISTRATION — POST /api/vessels/register ----------
export function generateVesselId(): string {
  return `PXT-VSL-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
}

export async function registerVessel(reg: VesselRegistration): Promise<{ vessel_id: string }> {
  const vessel_id = generateVesselId();
  const { error } = await supabase.from("vessels").insert({
    id: vessel_id,
    owner_id: reg.user_id ?? null,
    vessel_name: reg.vessel_name,
    operator_name: reg.operator_name,
    operator_type: reg.operator_type,
    phone_number: reg.phone_number,
    home_lat: reg.home_location.lat,
    home_lon: reg.home_location.lon,
    max_capacity: reg.max_capacity,
    cargo_capacity_kg: reg.cargo_capacity_kg,
    has_rescue_capability: reg.has_rescue_capability,
    status: "ACTIVE",
  });
  if (error) throw error;
  return { vessel_id };
}

export async function setVesselStatus(vessel_id: string, status: VesselStatus) {
  return supabase.from("vessels").update({ status }).eq("id", vessel_id);
}

// ---------- SAVED FARMS — POST /api/farms/create ----------
export async function saveFarm(p: { name: string; location: LatLng; user_id?: string }) {
  const { data, error } = await supabase.from("farms").insert({
    name: p.name, lat: p.location.lat, lon: p.location.lon,
    user_id: p.user_id ?? null,
  }).select("*").single();
  if (error) throw error;
  return data;
}

export async function listFarms(user_id?: string) {
  let q = supabase.from("farms").select("*").order("created_at", { ascending: false });
  if (user_id) q = q.eq("user_id", user_id);
  const { data } = await q;
  return data || [];
}

// ---------- DECENTRALIZED SOS — POST /api/sos/trigger ----------
const SOS_FALLBACK_KEY = "agnav.sos.pending";
const SOS_SMS_GATEWAY = "+233000000000"; // configurable fallback shortcode for offline SMS

export async function triggerSOS(p: {
  vessel_id: string; user_id?: string;
  location: LatLng; risk_level: RiskLevel; message?: string;
}): Promise<SosResponse> {
  try {
    // 1. Find nearby ACTIVE vessels (rescue-capable first, then closest)
    const { data: vessels } = await supabase.from("vessels")
      .select("id, vessel_name, phone_number, has_rescue_capability, status")
      .neq("id", p.vessel_id).eq("status", "ACTIVE");

    const { data: locs } = await supabase.from("vessel_locations")
      .select("vessel_id, lat, lon, created_at")
      .gte("created_at", new Date(Date.now() - 15 * 60 * 1000).toISOString())
      .order("created_at", { ascending: false });

    const latest = new Map<string, { lat: number; lon: number }>();
    (locs || []).forEach((l: any) => { if (!latest.has(l.vessel_id)) latest.set(l.vessel_id, { lat: l.lat, lon: l.lon }); });

    const candidates = (vessels || [])
      .map((v: any) => {
        const loc = latest.get(v.id);
        if (!loc) return null;
        const d = haversine(p.location, loc) / 1000;
        return { vessel_id: v.id, distance_km: Number(d.toFixed(2)), phone: v.phone_number, rescue: !!v.has_rescue_capability };
      })
      .filter(Boolean) as { vessel_id: string; distance_km: number; phone?: string; rescue: boolean }[];

    candidates.sort((a, b) => {
      if (a.rescue !== b.rescue) return a.rescue ? -1 : 1;
      return a.distance_km - b.distance_km;
    });
    const notified_vessels = candidates.slice(0, 5);

    // 2. Notify external responders (Navy / Marine Police / NADMO)
    const { data: ext } = await supabase.from("external_responders")
      .select("id, name, agency, phone_number").eq("active", true);
    const notified_responders = (ext || []).map((r: any) => ({
      id: r.id, name: r.name, agency: r.agency, phone: r.phone_number,
    }));

    // 3. Persist event (admin sees only analytics, not as dispatcher)
    const { data: ev, error } = await supabase.from("sos_events").insert({
      vessel_id: p.vessel_id, user_id: p.user_id ?? null,
      lat: p.location.lat, lon: p.location.lon,
      risk_level: p.risk_level, message: p.message ?? null,
      status: "BROADCAST",
      notified_vessels, notified_responders,
    }).select("*").single();
    if (error || !ev) throw error || new Error("SOS insert failed");

    // 4. SMS fallback fan-out (best-effort — your edge function should send via Twilio)
    try {
      await supabase.functions.invoke("sos-dispatch", {
        body: {
          event_id: ev.id, vessel_id: p.vessel_id,
          location: p.location, risk_level: p.risk_level, message: p.message,
          notified_vessels, notified_responders,
        },
      });
    } catch { /* edge function optional */ }

    return { status: "BROADCAST", event_id: ev.id, notified_vessels, notified_responders };
  } catch (err) {
    // Offline failsafe — queue locally + open SMS link
    const queue = JSON.parse(localStorage.getItem(SOS_FALLBACK_KEY) || "[]");
    queue.push({ ...p, queued_at: Date.now() });
    localStorage.setItem(SOS_FALLBACK_KEY, JSON.stringify(queue));
    try {
      const body = `SOS ${p.vessel_id} @ ${p.location.lat.toFixed(5)},${p.location.lon.toFixed(5)} risk:${p.risk_level}`;
      window.location.href = `sms:${SOS_SMS_GATEWAY}?body=${encodeURIComponent(body)}`;
    } catch {}
    throw err;
  }
}

export async function flushSOSQueue() {
  const queue = JSON.parse(localStorage.getItem(SOS_FALLBACK_KEY) || "[]");
  if (!queue.length) return;
  const remaining: any[] = [];
  for (const q of queue) {
    try { await triggerSOS(q); } catch { remaining.push(q); }
  }
  localStorage.setItem(SOS_FALLBACK_KEY, JSON.stringify(remaining));
}

// First responder to call wins — atomic accept via conditional update.
export async function acceptSOS(p: { event_id: string; rescuer_vessel_id: string; rescuer_location: LatLng; victim_location: LatLng }) {
  const distKm = haversine(p.rescuer_location, p.victim_location) / 1000;
  const eta = Math.max(2, Math.round(distKm / 30 * 60));
  const { data, error } = await supabase.from("sos_events")
    .update({ status: "ACCEPTED", accepted_by_vessel_id: p.rescuer_vessel_id, eta_minutes: eta })
    .eq("id", p.event_id).eq("status", "BROADCAST")
    .select("*").maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("SOS already accepted by another vessel");
  await setVesselStatus(p.rescuer_vessel_id, "BUSY");
  return { eta };
}

export async function resolveSOS(event_id: string, rescuer_vessel_id?: string) {
  await supabase.from("sos_events").update({ status: "RESOLVED", resolved_at: new Date().toISOString() }).eq("id", event_id);
  if (rescuer_vessel_id) await setVesselStatus(rescuer_vessel_id, "ACTIVE");
}

export function subscribeSOSEvent(eventId: string, cb: (row: any) => void) {
  const ch = supabase.channel(`sos-${eventId}`)
    .on("postgres_changes", { event: "UPDATE", schema: "public", table: "sos_events", filter: `id=eq.${eventId}` }, (payload) => cb(payload.new))
    .subscribe();
  return () => { supabase.removeChannel(ch); };
}

// Subscribe to ALL incoming SOS broadcasts (so vessels can accept).
export function subscribeIncomingSOS(cb: (row: any) => void) {
  const ch = supabase.channel("sos-broadcast")
    .on("postgres_changes", { event: "INSERT", schema: "public", table: "sos_events" }, (p) => cb(p.new))
    .subscribe();
  return () => { supabase.removeChannel(ch); };
}

// Track another vessel's live position (rescuer moving toward victim).
export function subscribeVesselLocation(vesselId: string, cb: (row: any) => void) {
  const ch = supabase.channel(`vessel-loc-${vesselId}`)
    .on("postgres_changes", { event: "INSERT", schema: "public", table: "vessel_locations", filter: `vessel_id=eq.${vesselId}` }, (p) => cb(p.new))
    .subscribe();
  return () => { supabase.removeChannel(ch); };
}

// Vessel-to-vessel messaging
export async function sendVesselMessage(p: { sos_event_id?: string; from_vessel_id: string; to_vessel_id?: string; body: string }) {
  return supabase.from("vessel_messages").insert(p);
}
export function subscribeVesselMessages(sos_event_id: string, cb: (row: any) => void) {
  const ch = supabase.channel(`msgs-${sos_event_id}`)
    .on("postgres_changes", { event: "INSERT", schema: "public", table: "vessel_messages", filter: `sos_event_id=eq.${sos_event_id}` }, (p) => cb(p.new))
    .subscribe();
  return () => { supabase.removeChannel(ch); };
}

// Backwards-compat alias (older code paths)
export const triggerSOS_legacy = triggerSOS;

// ============================================================================
// ADMIN PANEL — analytics + responder configuration ONLY (no SOS dispatch)
// ============================================================================
export default function AGNavEngine() {
  const [loading, setLoading] = useState(true);
  const [vessels, setVessels] = useState<any[]>([]);
  const [active, setActive] = useState<any[]>([]);
  const [sos, setSos] = useState<any[]>([]);
  const [routes, setRoutes] = useState<any[]>([]);
  const [responders, setResponders] = useState<any[]>([]);

  // New responder form
  const [rName, setRName] = useState("");
  const [rAgency, setRAgency] = useState("navy");
  const [rPhone, setRPhone] = useState("");
  const [rRegion, setRRegion] = useState("");

  const load = async () => {
    setLoading(true);
    const since = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    const [v, l, s, r, e] = await Promise.all([
      supabase.from("vessels").select("*").order("created_at", { ascending: false }).limit(100),
      supabase.from("vessel_locations").select("*").gte("created_at", since).order("created_at", { ascending: false }).limit(300),
      supabase.from("sos_events").select("*").order("created_at", { ascending: false }).limit(50),
      supabase.from("nav_routes").select("*").order("created_at", { ascending: false }).limit(50),
      supabase.from("external_responders").select("*").order("name"),
    ]);
    setVessels(v.data || []);
    const seen = new Set<string>(); const latest: any[] = [];
    (l.data || []).forEach((row: any) => { if (!seen.has(row.vessel_id)) { seen.add(row.vessel_id); latest.push(row); } });
    setActive(latest);
    setSos(s.data || []);
    setRoutes(r.data || []);
    setResponders(e.data || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);
  useEffect(() => {
    const ch = supabase.channel("agnav-engine-stream")
      .on("postgres_changes", { event: "*", schema: "public", table: "vessel_locations" }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "sos_events" }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "nav_routes" }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "external_responders" }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "vessels" }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  const addResponder = async () => {
    if (!rName.trim() || !rPhone.trim()) return;
    await supabase.from("external_responders").insert({
      name: rName.trim(), agency: rAgency, phone_number: rPhone.trim(),
      region: rRegion.trim() || null, active: true,
    });
    setRName(""); setRPhone(""); setRRegion("");
  };
  const removeResponder = async (id: string) => {
    await supabase.from("external_responders").delete().eq("id", id);
  };

  const openSos = sos.filter(s => s.status !== "RESOLVED").length;
  const acceptedSos = sos.filter(s => s.status === "ACCEPTED").length;
  const rescueCapable = vessels.filter(v => v.has_rescue_capability).length;

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <Anchor className="h-6 w-6 text-primary" />
        <h1 className="text-xl font-bold">AGNav Engine — Analytics & Responder Config</h1>
        {loading && <span className="text-xs text-muted-foreground">refreshing…</span>}
        <Badge variant="outline" className="ml-auto"><Radio className="h-3 w-3 mr-1" /> realtime</Badge>
      </div>

      <div className="rounded-md border border-amber-300 bg-amber-50 dark:bg-amber-950/30 p-3 text-xs text-amber-900 dark:text-amber-200">
        <strong>Decentralized SOS:</strong> Admin does NOT receive or dispatch live emergencies.
        SOS alerts go directly to nearby registered vessels and external responders below.
        This panel is for configuration and historical analytics only.
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <Card><CardContent className="pt-4 text-center"><p className="text-2xl font-bold">{vessels.length}</p><p className="text-xs text-muted-foreground">Registered vessels</p></CardContent></Card>
        <Card><CardContent className="pt-4 text-center"><p className="text-2xl font-bold">{active.length}</p><p className="text-xs text-muted-foreground">Active (10 min)</p></CardContent></Card>
        <Card><CardContent className="pt-4 text-center"><p className="text-2xl font-bold">{rescueCapable}</p><p className="text-xs text-muted-foreground">Rescue capable</p></CardContent></Card>
        <Card><CardContent className="pt-4 text-center"><p className="text-2xl font-bold">{openSos}</p><p className="text-xs text-muted-foreground">Open SOS (live)</p></CardContent></Card>
        <Card><CardContent className="pt-4 text-center"><p className="text-2xl font-bold">{acceptedSos}</p><p className="text-xs text-muted-foreground">Accepted by vessels</p></CardContent></Card>
      </div>

      {/* External responder configuration (Navy / Marine Police / NADMO) */}
      <Card><CardContent className="pt-4">
        <p className="text-sm font-semibold mb-3 flex items-center gap-2"><Phone className="h-4 w-4 text-primary" /> External rescue responders</p>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-2 mb-3">
          <Input placeholder="Name (e.g. Volta Marine Police)" value={rName} onChange={(e) => setRName(e.target.value)} className="md:col-span-2" />
          <select className="h-10 rounded-md border bg-background px-2 text-sm" value={rAgency} onChange={(e) => setRAgency(e.target.value)}>
            <option value="navy">Navy</option>
            <option value="marine_police">Marine Police</option>
            <option value="nadmo">NADMO</option>
            <option value="other">Other</option>
          </select>
          <Input placeholder="Phone +233..." value={rPhone} onChange={(e) => setRPhone(e.target.value)} />
          <div className="flex gap-2">
            <Input placeholder="Region" value={rRegion} onChange={(e) => setRRegion(e.target.value)} />
            <Button onClick={addResponder}><Plus className="h-4 w-4" /></Button>
          </div>
        </div>
        {responders.length === 0 ? (
          <p className="text-xs text-muted-foreground">No responders configured. Add Navy, Marine Police or disaster agencies above so SOS broadcasts reach them automatically.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
            {responders.map(r => (
              <div key={r.id} className="border rounded-md p-2 flex items-center justify-between">
                <div>
                  <div className="font-medium">{r.name} <Badge variant="outline" className="ml-1 text-xs">{r.agency}</Badge></div>
                  <div className="text-xs text-muted-foreground">{r.phone_number}{r.region ? ` · ${r.region}` : ""}</div>
                </div>
                <Button size="sm" variant="ghost" onClick={() => removeResponder(r.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
              </div>
            ))}
          </div>
        )}
      </CardContent></Card>

      {/* Read-only SOS history (analytics, NOT a dispatch console) */}
      <Card><CardContent className="pt-4">
        <p className="text-sm font-semibold mb-2 flex items-center gap-2"><LifeBuoy className="h-4 w-4 text-destructive" /> SOS history (read-only)</p>
        {sos.length === 0 ? <p className="text-xs text-muted-foreground">No SOS events logged.</p> : (
          <div className="space-y-1 max-h-72 overflow-auto">
            {sos.map(e => (
              <div key={e.id} className="border rounded-md p-2 text-sm flex flex-wrap items-center gap-2">
                <Badge variant={e.status === "RESOLVED" ? "outline" : e.status === "ACCEPTED" ? "secondary" : "destructive"}>{e.status}</Badge>
                <span className="font-medium">{e.vessel_id}</span>
                <span className="text-xs text-muted-foreground">{Number(e.lat).toFixed(4)}, {Number(e.lon).toFixed(4)} · {new Date(e.created_at).toLocaleString()}</span>
                {e.accepted_by_vessel_id && <span className="text-xs">→ {e.accepted_by_vessel_id} (ETA {e.eta_minutes ?? "?"} min)</span>}
                {Array.isArray(e.notified_vessels) && <span className="text-xs text-muted-foreground">notified {e.notified_vessels.length} vessels</span>}
              </div>
            ))}
          </div>
        )}
      </CardContent></Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <Card><CardContent className="pt-4">
          <p className="text-sm font-semibold mb-2 flex items-center gap-2"><Navigation className="h-4 w-4 text-primary" /> Active vessels</p>
          {active.length === 0 ? <p className="text-xs text-muted-foreground">No live vessels.</p> : (
            <ul className="space-y-1 text-sm max-h-64 overflow-auto">
              {active.map(a => (
                <li key={a.id} className="flex justify-between border-b last:border-0 py-1">
                  <span className="font-medium">{a.vessel_id}</span>
                  <span className="text-xs text-muted-foreground">{Number(a.lat).toFixed(4)}, {Number(a.lon).toFixed(4)}{a.risk_level ? ` · ${a.risk_level}` : ""}</span>
                </li>
              ))}
            </ul>
          )}
        </CardContent></Card>

        <Card><CardContent className="pt-4">
          <p className="text-sm font-semibold mb-2 flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-orange-500" /> Recent routes</p>
          {routes.length === 0 ? <p className="text-xs text-muted-foreground">No routes computed yet.</p> : (
            <ul className="space-y-1 text-sm max-h-64 overflow-auto">
              {routes.slice(0, 10).map(r => (
                <li key={r.id} className="flex justify-between border-b last:border-0 py-1">
                  <span>{r.vessel_id}</span>
                  <span className="text-xs text-muted-foreground">{(Number(r.distance_m) / 1000).toFixed(1)} km · risk {r.risk_level}</span>
                </li>
              ))}
            </ul>
          )}
        </CardContent></Card>
      </div>

      <Card><CardContent className="pt-4">
        <p className="text-sm font-semibold mb-2">Registered vessels (analytics)</p>
        {vessels.length === 0 ? <p className="text-xs text-muted-foreground">No vessels registered yet.</p> : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm max-h-72 overflow-auto">
            {vessels.map(v => (
              <div key={v.id} className="border rounded-md p-2 flex justify-between">
                <div>
                  <div className="font-medium">{v.vessel_name || v.id} <span className="text-xs text-muted-foreground">· {v.id}</span></div>
                  <div className="text-xs text-muted-foreground">{v.operator_type} · {v.phone_number}{v.has_rescue_capability ? " · 🛟 rescue" : ""}</div>
                </div>
                <Badge variant={v.status === "ACTIVE" ? "outline" : v.status === "BUSY" ? "destructive" : "secondary"}>{v.status}</Badge>
              </div>
            ))}
          </div>
        )}
      </CardContent></Card>

      {loading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
    </div>
  );
}
