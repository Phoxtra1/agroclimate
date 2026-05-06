/**
 * AGNavEngine — Admin-side intelligence backend for AGNav water transport.
 *
 * ============================================================================
 * REQUIRED SUPABASE MIGRATION (run once in your Supabase project)
 * ============================================================================
 *
 * -- Vessels (registered PXT vessels)
 * create table if not exists public.vessels (
 *   id text primary key,                              -- e.g. "PXT-VSL-001"
 *   owner_id uuid references auth.users(id) on delete set null,
 *   name text,
 *   capacity_passengers int default 0,
 *   capacity_cargo_kg numeric default 0,
 *   created_at timestamptz default now()
 * );
 * alter table public.vessels enable row level security;
 * create policy "vessels read" on public.vessels for select using (true);
 * create policy "vessels owner write" on public.vessels for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);
 *
 * -- Live vessel locations (ping every 3-5s from client)
 * create table if not exists public.vessel_locations (
 *   id uuid primary key default gen_random_uuid(),
 *   vessel_id text not null,
 *   user_id uuid references auth.users(id) on delete set null,
 *   lat double precision not null,
 *   lon double precision not null,
 *   speed_kn numeric,
 *   heading numeric,
 *   risk_level text,
 *   created_at timestamptz default now()
 * );
 * create index if not exists vessel_locations_vessel_idx on public.vessel_locations(vessel_id, created_at desc);
 * alter table public.vessel_locations enable row level security;
 * create policy "loc read" on public.vessel_locations for select using (true);
 * create policy "loc insert" on public.vessel_locations for insert with check (auth.uid() = user_id);
 *
 * -- Computed routes (audit + admin display)
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
 * create policy "routes insert" on public.nav_routes for insert with check (auth.uid() = user_id);
 *
 * -- Rescue units (admin-managed)
 * create table if not exists public.rescue_units (
 *   id text primary key,
 *   name text,
 *   lat double precision, lon double precision,
 *   status text default 'available',                  -- available | dispatched | offline
 *   updated_at timestamptz default now()
 * );
 * alter table public.rescue_units enable row level security;
 * create policy "rescue read" on public.rescue_units for select using (true);
 *
 * -- SOS events
 * create table if not exists public.sos_events (
 *   id uuid primary key default gen_random_uuid(),
 *   vessel_id text not null,
 *   user_id uuid references auth.users(id) on delete set null,
 *   lat double precision, lon double precision,
 *   risk_level text,
 *   message text,
 *   status text default 'RECEIVED',                   -- RECEIVED | DISPATCHED | RESOLVED
 *   rescue_unit_id text references public.rescue_units(id),
 *   eta_minutes int,
 *   created_at timestamptz default now(),
 *   resolved_at timestamptz
 * );
 * alter table public.sos_events enable row level security;
 * create policy "sos read" on public.sos_events for select using (true);
 * create policy "sos insert" on public.sos_events for insert with check (auth.uid() = user_id);
 * create policy "sos update admin" on public.sos_events for update using (true);
 *
 * -- Realtime
 * alter publication supabase_realtime add table public.vessel_locations;
 * alter publication supabase_realtime add table public.sos_events;
 * alter publication supabase_realtime add table public.rescue_units;
 * alter publication supabase_realtime add table public.nav_routes;
 *
 * ============================================================================
 * CLIENT-SIDE ENGINE API (used by AGNav.tsx)
 * ============================================================================
 */

import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Anchor, LifeBuoy, Navigation, AlertTriangle, Loader2, Radio } from "lucide-react";

// ---------- Types ----------
export type LatLng = { lat: number; lon: number };
export type RiskLevel = "safe" | "moderate" | "high" | "critical";
export interface RouteSegment { coords: [number, number][]; level: RiskLevel; }
export interface RouteResult {
  route: [number, number][];
  risk_segments: RouteSegment[];
  alternatives: [number, number][][];
  risk_score: number;
  risk_level: RiskLevel;
  distance_m: number;
  duration_s: number;
}
export interface SosResponse {
  status: "RECEIVED" | "DISPATCHED" | "RESOLVED";
  rescue_unit?: { id: string; name?: string; eta: number; lat?: number; lon?: number };
  event_id: string;
}

// ---------- Risk model ----------
// Combines weather (rainProb), load factor (passengers + cargo) and proximity to known flood polygons.
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
  const proximity = Math.max(0, 1 - minDistKm / 80); // within 80 km of a flood centre adds risk
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

// Split an OSRM polyline into ~equal segments and score each so the map can colour them.
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

// ---------- ROUTE ENGINE ----------
// /api/navigation/route equivalent. Uses OSRM for the geometry then scores each segment.
export async function computeRoute(params: {
  start: LatLng; end: LatLng; vessel_id: string;
  load: { passengers: number; cargo_kg: number };
  capacity?: { passengers: number; cargo_kg: number };
  rainProb?: number;
  user_id?: string;
}): Promise<RouteResult> {
  const { start, end, vessel_id, load, capacity, rainProb, user_id } = params;
  const url = `https://router.project-osrm.org/route/v1/driving/${start.lon},${start.lat};${end.lon},${end.lat}?overview=full&geometries=geojson&alternatives=true`;
  const res = await fetch(url);
  const json = await res.json();
  const main = json?.routes?.[0];
  if (!main) throw new Error("No route found");
  const route: [number, number][] = main.geometry.coordinates.map((c: number[]) => [c[1], c[0]]);
  const altRoutes: [number, number][][] = (json.routes.slice(1) || []).map((r: any) => r.geometry.coordinates.map((c: number[]) => [c[1], c[0]]));

  const scoreLevel = (p: LatLng) => scoreRisk(p, { rainProb, load, capacity }).level;
  const segs = segmentise(route, scoreLevel);
  const mid = route[Math.floor(route.length / 2)];
  const overall = scoreRisk({ lat: mid[0], lon: mid[1] }, { rainProb, load, capacity });

  const result: RouteResult = {
    route, risk_segments: segs, alternatives: altRoutes,
    risk_score: overall.score, risk_level: overall.level,
    distance_m: main.distance, duration_s: main.duration,
  };

  // Persist for admin visibility (best effort).
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
}

// ---------- LIVE LOCATION ----------
export async function pushVesselLocation(p: { vessel_id: string; user_id?: string; lat: number; lon: number; speed_kn?: number; heading?: number; risk_level?: RiskLevel }) {
  return supabase.from("vessel_locations").insert({
    vessel_id: p.vessel_id,
    user_id: p.user_id ?? null,
    lat: p.lat, lon: p.lon,
    speed_kn: p.speed_kn ?? null,
    heading: p.heading ?? null,
    risk_level: p.risk_level ?? null,
  });
}

// ---------- SOS ----------
const SOS_FALLBACK_KEY = "agnav.sos.pending";

export async function triggerSOS(p: { vessel_id: string; user_id?: string; location: LatLng; risk_level: RiskLevel; message?: string }): Promise<SosResponse> {
  try {
    const { data: ev, error } = await supabase.from("sos_events").insert({
      vessel_id: p.vessel_id,
      user_id: p.user_id ?? null,
      lat: p.location.lat, lon: p.location.lon,
      risk_level: p.risk_level,
      message: p.message ?? null,
      status: "RECEIVED",
    }).select("*").single();
    if (error || !ev) throw error || new Error("SOS insert failed");

    // Auto-assign nearest available rescue unit
    const { data: units } = await supabase.from("rescue_units").select("*").eq("status", "available");
    let rescue: any = null;
    if (units && units.length) {
      let best = Infinity;
      for (const u of units) {
        if (u.lat == null || u.lon == null) continue;
        const d = haversine(p.location, { lat: u.lat, lon: u.lon });
        if (d < best) { best = d; rescue = u; }
      }
      if (rescue) {
        const eta = Math.max(2, Math.round(best / 1000 / 30 * 60)); // assume 30 km/h
        await supabase.from("sos_events").update({ status: "DISPATCHED", rescue_unit_id: rescue.id, eta_minutes: eta }).eq("id", ev.id);
        await supabase.from("rescue_units").update({ status: "dispatched", updated_at: new Date().toISOString() }).eq("id", rescue.id);
        return { status: "DISPATCHED", rescue_unit: { id: rescue.id, name: rescue.name, eta, lat: rescue.lat, lon: rescue.lon }, event_id: ev.id };
      }
    }
    return { status: "RECEIVED", event_id: ev.id };
  } catch (err) {
    // Fallback: persist locally and let UI retry later.
    const queue = JSON.parse(localStorage.getItem(SOS_FALLBACK_KEY) || "[]");
    queue.push({ ...p, queued_at: Date.now() });
    localStorage.setItem(SOS_FALLBACK_KEY, JSON.stringify(queue));
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

// Subscribe to a single SOS event (status / rescue updates).
export function subscribeSOSEvent(eventId: string, cb: (row: any) => void) {
  const ch = supabase.channel(`sos-${eventId}`)
    .on("postgres_changes", { event: "UPDATE", schema: "public", table: "sos_events", filter: `id=eq.${eventId}` }, (payload) => cb(payload.new))
    .subscribe();
  return () => { supabase.removeChannel(ch); };
}

// Subscribe to a rescue unit's live position (so the user sees it move).
export function subscribeRescueUnit(unitId: string, cb: (row: any) => void) {
  const ch = supabase.channel(`rescue-${unitId}`)
    .on("postgres_changes", { event: "UPDATE", schema: "public", table: "rescue_units", filter: `id=eq.${unitId}` }, (payload) => cb(payload.new))
    .subscribe();
  return () => { supabase.removeChannel(ch); };
}

// ============================================================================
// ADMIN PANEL (rendered inside AdminDashboard under the "AGNav Engine" tab)
// ============================================================================
export default function AGNavEngine() {
  const [loading, setLoading] = useState(true);
  const [vessels, setVessels] = useState<any[]>([]);
  const [active, setActive] = useState<any[]>([]);
  const [sos, setSos] = useState<any[]>([]);
  const [routes, setRoutes] = useState<any[]>([]);
  const [units, setUnits] = useState<any[]>([]);

  const load = async () => {
    setLoading(true);
    const since = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    const [v, l, s, r, u] = await Promise.all([
      supabase.from("vessels").select("*").order("created_at", { ascending: false }).limit(50),
      supabase.from("vessel_locations").select("*").gte("created_at", since).order("created_at", { ascending: false }).limit(200),
      supabase.from("sos_events").select("*").order("created_at", { ascending: false }).limit(50),
      supabase.from("nav_routes").select("*").order("created_at", { ascending: false }).limit(50),
      supabase.from("rescue_units").select("*").order("name"),
    ]);
    setVessels(v.data || []);
    // Keep the latest ping per vessel
    const seen = new Set<string>(); const latest: any[] = [];
    (l.data || []).forEach((row: any) => { if (!seen.has(row.vessel_id)) { seen.add(row.vessel_id); latest.push(row); } });
    setActive(latest);
    setSos(s.data || []);
    setRoutes(r.data || []);
    setUnits(u.data || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);
  useEffect(() => {
    const ch = supabase.channel("agnav-engine-stream")
      .on("postgres_changes", { event: "*", schema: "public", table: "vessel_locations" }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "sos_events" }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "nav_routes" }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "rescue_units" }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  const dispatch = async (sosId: string, unitId: string) => {
    const unit = units.find(u => u.id === unitId);
    const ev = sos.find(s => s.id === sosId);
    if (!unit || !ev) return;
    const dist = unit.lat != null && unit.lon != null ? haversine({ lat: ev.lat, lon: ev.lon }, { lat: unit.lat, lon: unit.lon }) : 0;
    const eta = Math.max(2, Math.round(dist / 1000 / 30 * 60));
    await supabase.from("sos_events").update({ status: "DISPATCHED", rescue_unit_id: unitId, eta_minutes: eta }).eq("id", sosId);
    await supabase.from("rescue_units").update({ status: "dispatched", updated_at: new Date().toISOString() }).eq("id", unitId);
  };
  const resolve = async (sosId: string) => {
    const ev = sos.find(s => s.id === sosId);
    await supabase.from("sos_events").update({ status: "RESOLVED", resolved_at: new Date().toISOString() }).eq("id", sosId);
    if (ev?.rescue_unit_id) await supabase.from("rescue_units").update({ status: "available", updated_at: new Date().toISOString() }).eq("id", ev.rescue_unit_id);
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <Anchor className="h-6 w-6 text-primary" />
        <h1 className="text-xl font-bold">AGNav Engine</h1>
        {loading && <span className="text-xs text-muted-foreground">refreshing…</span>}
        <Badge variant="outline" className="ml-auto"><Radio className="h-3 w-3 mr-1" /> realtime</Badge>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card><CardContent className="pt-4 text-center"><p className="text-2xl font-bold">{vessels.length}</p><p className="text-xs text-muted-foreground">Registered vessels</p></CardContent></Card>
        <Card><CardContent className="pt-4 text-center"><p className="text-2xl font-bold">{active.length}</p><p className="text-xs text-muted-foreground">Active (10 min)</p></CardContent></Card>
        <Card><CardContent className="pt-4 text-center"><p className="text-2xl font-bold">{sos.filter(s => s.status !== "RESOLVED").length}</p><p className="text-xs text-muted-foreground">Open SOS</p></CardContent></Card>
        <Card><CardContent className="pt-4 text-center"><p className="text-2xl font-bold">{units.filter(u => u.status === "available").length}</p><p className="text-xs text-muted-foreground">Rescue units ready</p></CardContent></Card>
      </div>

      <Card><CardContent className="pt-4">
        <p className="text-sm font-semibold mb-2 flex items-center gap-2"><LifeBuoy className="h-4 w-4 text-destructive" /> SOS feed</p>
        {sos.length === 0 ? <p className="text-xs text-muted-foreground">No SOS events yet.</p> : (
          <div className="space-y-2">
            {sos.map(e => (
              <div key={e.id} className="border rounded-md p-2 text-sm flex flex-wrap items-center gap-2">
                <Badge variant={e.status === "RESOLVED" ? "outline" : "destructive"}>{e.status}</Badge>
                <span className="font-medium">{e.vessel_id}</span>
                <span className="text-xs text-muted-foreground">{Number(e.lat).toFixed(4)}, {Number(e.lon).toFixed(4)} · {new Date(e.created_at).toLocaleTimeString()}</span>
                {e.message && <span className="text-xs italic">"{e.message}"</span>}
                {e.eta_minutes && <span className="text-xs">ETA {e.eta_minutes} min</span>}
                <div className="ml-auto flex gap-1">
                  {e.status !== "RESOLVED" && (
                    <select className="text-xs border rounded px-1 py-0.5 bg-background" defaultValue="" onChange={(ev) => ev.target.value && dispatch(e.id, ev.target.value)}>
                      <option value="">Assign unit…</option>
                      {units.filter(u => u.status === "available" || u.id === e.rescue_unit_id).map(u => <option key={u.id} value={u.id}>{u.name || u.id}</option>)}
                    </select>
                  )}
                  {e.status !== "RESOLVED" && <Button size="sm" variant="outline" onClick={() => resolve(e.id)}>Resolve</Button>}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent></Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <Card><CardContent className="pt-4">
          <p className="text-sm font-semibold mb-2 flex items-center gap-2"><Navigation className="h-4 w-4 text-primary" /> Active vessels</p>
          {active.length === 0 ? <p className="text-xs text-muted-foreground">No live vessels.</p> : (
            <ul className="space-y-1 text-sm">
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
            <ul className="space-y-1 text-sm">
              {routes.slice(0, 8).map(r => (
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
        <p className="text-sm font-semibold mb-2">Rescue units</p>
        {units.length === 0 ? <p className="text-xs text-muted-foreground">No rescue units configured. Insert rows into <code>rescue_units</code> to enable auto-dispatch.</p> : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
            {units.map(u => (
              <div key={u.id} className="border rounded-md p-2 flex justify-between">
                <div><div className="font-medium">{u.name || u.id}</div><div className="text-xs text-muted-foreground">{u.lat != null ? `${Number(u.lat).toFixed(4)}, ${Number(u.lon).toFixed(4)}` : "no location"}</div></div>
                <Badge variant={u.status === "available" ? "outline" : u.status === "dispatched" ? "destructive" : "secondary"}>{u.status}</Badge>
              </div>
            ))}
          </div>
        )}
      </CardContent></Card>

      {loading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
    </div>
  );
}
