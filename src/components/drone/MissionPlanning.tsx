import React, { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Route, Clock, Battery, Map, Loader2, CheckCircle, Sparkles, Navigation } from "lucide-react";
import { useMissions } from "@/hooks/useMissions";
import { useToast } from "@/hooks/use-toast";
import { CopyButton } from "@/components/CopyButton";
import { supabase } from "@/integrations/supabase/client";

const MISSION_TYPES = [
  { v: "mapping", l: "Farm Mapping" },
  { v: "inspection", l: "Crop Inspection" },
  { v: "irrigation", l: "Irrigation Assessment" },
  { v: "flood", l: "Flood Assessment" },
  { v: "pest", l: "Pest Surveillance" },
  { v: "survey", l: "Aerial Survey" },
  { v: "spraying", l: "Spraying Mission" },
];

const DEFAULT_BOUNDARY = "5.60370,-0.18700\n5.60480,-0.18180\n5.59990,-0.18090\n5.59870,-0.18640";

type GeneratedRoute = {
  route_pattern: string;
  estimated_coverage_ha: number;
  estimated_duration_min: number;
  estimated_battery_pct: number;
  waypoint_spacing_m?: number;
  waypoints: Array<{ lat: number; lng: number; altitude_m: number; action: string }>;
  advisory_notes: string[];
  coverage_summary: string;
  boundary?: Array<{ lat: number; lng: number }>;
};

export function MissionPlanning() {
  const [name, setName] = useState("");
  const [type, setType] = useState("mapping");
  const [altitude, setAltitude] = useState(50);
  const [speed, setSpeed] = useState(10);
  const [areaHa, setAreaHa] = useState(12);
  const [pattern, setPattern] = useState("grid");
  const [farmName, setFarmName] = useState("North Field");
  const [boundary, setBoundary] = useState(DEFAULT_BOUNDARY);
  const [aiRoute, setAiRoute] = useState<GeneratedRoute | null>(null);
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const { missions, create } = useMissions();
  const { toast } = useToast();

  const estimates = useMemo(() => {
    // Simple coverage model: time = area / (speed * swath); swath ~ altitude*0.7
    const swath = Math.max(5, altitude * 0.7);
    const areaM2 = areaHa * 10000;
    const timeSec = areaM2 / Math.max(0.1, speed * swath);
    const min = timeSec / 60;
    const batteryPct = Math.min(100, min * 4); // ~4%/min
    return {
      min: aiRoute?.estimated_duration_min ?? min,
      batteryPct: aiRoute?.estimated_battery_pct ?? batteryPct,
      coverageHa: aiRoute?.estimated_coverage_ha ?? areaHa,
      pattern: aiRoute?.route_pattern ?? pattern,
    };
  }, [altitude, speed, areaHa, aiRoute, pattern]);

  const generateRoute = async () => {
    setGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke("dipa-route-generator", {
        body: {
          farmName,
          missionType: type,
          routePreference: pattern,
          altitude,
          speed,
          boundary,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setAiRoute(data.route as GeneratedRoute);
      setAreaHa(Number(data.route?.estimated_coverage_ha || areaHa));
      setPattern(data.route?.route_pattern || pattern);
      toast({ title: "Dipa route generated", description: `${data.route?.waypoints?.length || 0} mission waypoint(s) ready.` });
    } catch (e: any) {
      toast({ title: "Route generation failed", description: e.message || "Check farm boundary coordinates.", variant: "destructive" });
    } finally {
      setGenerating(false);
    }
  };

  const save = async () => {
    setSaving(true);
    try {
      await create({
        name: name || `${type} mission`,
        mission_type: type,
        altitude_m: altitude,
        speed_ms: speed,
        route_pattern: pattern,
        area_polygon: aiRoute ? { boundary: aiRoute.boundary, waypoints: aiRoute.waypoints, source: "dipa-ai" } : null,
        camera_settings: aiRoute ? { advisory_notes: aiRoute.advisory_notes, coverage_summary: aiRoute.coverage_summary, waypoint_spacing_m: aiRoute.waypoint_spacing_m } : {},
        estimated_battery_pct: estimates.batteryPct,
        estimated_duration_min: estimates.min,
        estimated_coverage_ha: estimates.coverageHa,
      });
      toast({ title: "Mission saved" });
      setName("");
    } catch (e: any) {
      toast({ title: "Save failed", description: e.message, variant: "destructive" });
    } finally { setSaving(false); }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2 space-y-6">
        <Card className="bg-slate-900 border-slate-800 text-slate-100">
          <CardHeader className="py-4 border-b border-slate-800">
            <CardTitle className="text-sm font-mono uppercase tracking-widest text-cyan-400 flex items-center gap-2">
              <Route className="h-4 w-4" /> Mission Configuration
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <Field label="Mission Name"><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="North Field Survey" className="bg-slate-950 border-slate-800 text-slate-300 font-mono" /></Field>
              <Field label="Farm Boundary Name"><Input value={farmName} onChange={(e) => setFarmName(e.target.value)} placeholder="North Field" className="bg-slate-950 border-slate-800 text-slate-300 font-mono" /></Field>
              <Field label="Mission Type">
                <Select value={type} onValueChange={setType}>
                  <SelectTrigger className="bg-slate-950 border-slate-800 text-slate-300 font-mono"><SelectValue /></SelectTrigger>
                  <SelectContent className="bg-slate-900 border-slate-800 text-slate-300 font-mono">
                    {MISSION_TYPES.map((m) => <SelectItem key={m.v} value={m.v}>{m.l}</SelectItem>)}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Altitude (m)"><Input type="number" min={10} max={400} value={altitude} onChange={(e) => setAltitude(Number(e.target.value))} className="bg-slate-950 border-slate-800 text-slate-300 font-mono" /></Field>
              <Field label="Speed (m/s)"><Input type="number" min={1} max={25} value={speed} onChange={(e) => setSpeed(Number(e.target.value))} className="bg-slate-950 border-slate-800 text-slate-300 font-mono" /></Field>
              <Field label="Coverage (ha)"><Input type="number" min={0.1} value={areaHa} onChange={(e) => setAreaHa(Number(e.target.value))} className="bg-slate-950 border-slate-800 text-slate-300 font-mono" /></Field>
              <Field label="Route Pattern">
                <Select value={pattern} onValueChange={setPattern}>
                  <SelectTrigger className="bg-slate-950 border-slate-800 text-slate-300 font-mono"><SelectValue /></SelectTrigger>
                  <SelectContent className="bg-slate-900 border-slate-800 text-slate-300 font-mono">
                    <SelectItem value="grid">Grid (mapping)</SelectItem>
                    <SelectItem value="perimeter">Perimeter</SelectItem>
                    <SelectItem value="spiral">Spiral</SelectItem>
                    <SelectItem value="waypoint">Waypoints</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
            </div>
            <Field label="Farm Boundary Coordinates">
              <Textarea
                value={boundary}
                onChange={(e) => setBoundary(e.target.value)}
                placeholder={"lat,lng\nlat,lng\nlat,lng"}
                className="min-h-[110px] bg-slate-950 border-slate-800 text-slate-300 font-mono text-xs"
              />
            </Field>
            <Button className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-mono" onClick={generateRoute} disabled={generating}>
              {generating ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Sparkles className="h-4 w-4 mr-2" />}
              GENERATE DIPA AI ROUTE
            </Button>
            {aiRoute && (
              <div className="rounded-lg border border-cyan-900/50 bg-cyan-950/20 p-3 font-mono text-xs text-slate-200 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="text-cyan-300 uppercase tracking-widest text-[10px]">AI Route Ready</div>
                    <p className="mt-1 text-slate-300">{aiRoute.coverage_summary}</p>
                  </div>
                  <CopyButton value={JSON.stringify(aiRoute.waypoints)} className="h-7 w-7 text-slate-400" />
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-[10px]">
                  <span>Pattern <b className="text-slate-100">{aiRoute.route_pattern.toUpperCase()}</b></span>
                  <span>Waypoints <b className="text-slate-100">{aiRoute.waypoints.length}</b></span>
                  <span>Coverage <b className="text-slate-100">{aiRoute.estimated_coverage_ha.toFixed(1)} ha</b></span>
                  <span>Spacing <b className="text-slate-100">{aiRoute.waypoint_spacing_m?.toFixed(0) || "—"}m</b></span>
                </div>
                <CoveragePreview boundaryText={boundary} aiRoute={aiRoute} />
                <div className="max-h-28 overflow-y-auto space-y-1">
                  {aiRoute.waypoints.slice(0, 8).map((point, index) => (
                    <div key={`${point.lat}-${point.lng}-${index}`} className="flex items-center justify-between gap-2 border-t border-cyan-900/30 pt-1 text-[10px]">
                      <span className="flex items-center gap-1 text-cyan-200"><Navigation className="h-3 w-3" /> WP{index + 1}</span>
                      <span className="text-slate-400 truncate">{point.lat.toFixed(5)}, {point.lng.toFixed(5)} · {point.altitude_m}m · {point.action}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <Button className="w-full bg-cyan-600 hover:bg-cyan-500 text-white font-mono mt-2" onClick={save} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <CheckCircle className="h-4 w-4 mr-2" />}
              SAVE FLIGHT PLAN
            </Button>
          </CardContent>
        </Card>

        {missions.length > 0 && (
          <Card className="bg-slate-900 border-slate-800 text-slate-100">
            <CardHeader className="py-3 border-b border-slate-800">
              <CardTitle className="text-sm font-mono uppercase tracking-widest text-cyan-400">Saved Missions</CardTitle>
            </CardHeader>
            <CardContent className="p-3 space-y-2 max-h-64 overflow-y-auto">
              {missions.map((m) => (
                <div key={m.id} className="bg-slate-950 border border-slate-800 rounded p-2 text-[11px] font-mono flex items-center justify-between">
                  <div className="min-w-0">
                    <div className="text-slate-200 truncate">{m.name || m.mission_type}</div>
                    <div className="text-slate-500 text-[10px]">{m.mission_type} · {m.altitude_m}m · {m.estimated_coverage_ha?.toFixed(1) || "—"} ha · {m.status}</div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <span className="text-slate-600 truncate max-w-[80px]">{m.id.slice(0, 8)}</span>
                    <CopyButton value={m.id} className="h-5 w-5" />
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        )}
      </div>

      <Card className="bg-slate-900 border-slate-800 text-slate-100 h-fit">
        <CardHeader className="py-4 border-b border-slate-800">
          <CardTitle className="text-sm font-mono uppercase tracking-widest text-cyan-400">Estimates</CardTitle>
        </CardHeader>
        <CardContent className="p-4 space-y-4 text-xs font-mono">
          <Row icon={<Clock className="h-4 w-4" />} label="Flight Time" value={`${Math.floor(estimates.min)}m ${Math.round((estimates.min%1)*60)}s`} />
          <Row icon={<Battery className="h-4 w-4" />} label="Battery Est." value={`${estimates.batteryPct.toFixed(0)}%`} />
          <Row icon={<Map className="h-4 w-4" />} label="Coverage" value={`${estimates.coverageHa.toFixed(1)} ha`} />
          <Row icon={<Route className="h-4 w-4" />} label="Pattern" value={estimates.pattern.toUpperCase()} />
        </CardContent>
      </Card>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <label className="text-[10px] font-mono text-slate-500 uppercase">{label}</label>
      {children}
    </div>
  );
}

function Row({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex justify-between items-center border-b border-slate-800 pb-2 last:border-0">
      <span className="text-slate-500 flex items-center gap-2">{icon} {label}</span>
      <span className="text-slate-200">{value}</span>
    </div>
  );
}

function parseBoundary(text: string): Array<{ lat: number; lng: number }> {
  return text.split("\n").map((l) => l.trim()).filter(Boolean).map((line) => {
    const [a, b] = line.split(/[,\s]+/).map(Number);
    return Number.isFinite(a) && Number.isFinite(b) ? { lat: a, lng: b } : null;
  }).filter(Boolean) as Array<{ lat: number; lng: number }>;
}

function CoveragePreview({ boundaryText, aiRoute }: { boundaryText: string; aiRoute: GeneratedRoute }) {
  const boundary = (aiRoute.boundary && aiRoute.boundary.length >= 3) ? aiRoute.boundary : parseBoundary(boundaryText);
  const points = [...boundary, ...aiRoute.waypoints];
  if (points.length === 0) return null;
  const lats = points.map((p) => p.lat), lngs = points.map((p) => p.lng);
  const minLat = Math.min(...lats), maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs), maxLng = Math.max(...lngs);
  const W = 360, H = 200, pad = 14;
  const x = (lng: number) => pad + ((lng - minLng) / Math.max(1e-9, maxLng - minLng)) * (W - pad * 2);
  const y = (lat: number) => H - (pad + ((lat - minLat) / Math.max(1e-9, maxLat - minLat)) * (H - pad * 2));
  const polyStr = boundary.map((p) => `${x(p.lng)},${y(p.lat)}`).join(" ");
  const pathStr = aiRoute.waypoints.map((p, i) => `${i === 0 ? "M" : "L"}${x(p.lng)},${y(p.lat)}`).join(" ");

  return (
    <div className="rounded-md border border-cyan-900/40 bg-slate-950 p-2">
      <div className="flex items-center justify-between text-[10px] text-slate-500 mb-1">
        <span>COVERAGE PREVIEW</span>
        <span>{aiRoute.estimated_coverage_ha.toFixed(1)} ha · {aiRoute.waypoints.length} WP</span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-40">
        <defs>
          <pattern id="cov" patternUnits="userSpaceOnUse" width="8" height="8">
            <path d="M0 8 L8 0" stroke="rgba(34,211,238,0.25)" strokeWidth="1" />
          </pattern>
        </defs>
        {boundary.length >= 3 && (
          <polygon points={polyStr} fill="url(#cov)" stroke="#22d3ee" strokeWidth={1.5} strokeDasharray="4 3" />
        )}
        {aiRoute.waypoints.length > 1 && (
          <path d={pathStr} fill="none" stroke="#34d399" strokeWidth={1.5} />
        )}
        {aiRoute.waypoints.map((p, i) => (
          <g key={i}>
            <circle cx={x(p.lng)} cy={y(p.lat)} r={3} fill="#facc15" stroke="#0f172a" strokeWidth={1} />
            {i === 0 && <text x={x(p.lng) + 5} y={y(p.lat) - 5} fontSize={8} fill="#facc15" fontFamily="monospace">START</text>}
          </g>
        ))}
      </svg>
      <div className="flex gap-3 mt-1 text-[9px] font-mono text-slate-500">
        <span><span className="inline-block w-2 h-2 bg-cyan-500/40 mr-1" />Boundary</span>
        <span><span className="inline-block w-2 h-0.5 bg-emerald-400 mr-1 align-middle" />Flight path</span>
        <span><span className="inline-block w-2 h-2 rounded-full bg-yellow-400 mr-1 align-middle" />Waypoints</span>
      </div>
    </div>
  );
}
