import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Clock, CheckCircle2, AlertTriangle, MapPin, Loader2, Timer } from "lucide-react";
import { format } from "date-fns";

interface Props {
  handlerId: string;
  activeSession: any | null;
  tasks: any[];
}

function hoursBetween(a: string, b: string) {
  return Math.max(0, (new Date(b).getTime() - new Date(a).getTime()) / 3600000);
}

/**
 * Handler Dashboard — a live summary that sits above the existing workspace:
 * hours worked, completed tasks, open issues and current GPS position.
 */
export function HandlerDashboard({ handlerId, activeSession, tasks }: Props) {
  const [sessions, setSessions] = useState<any[]>([]);
  const [issues, setIssues] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [gps, setGps] = useState<{ lat: number; lon: number; accuracy?: number } | null>(null);
  const [gpsError, setGpsError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const [s, i] = await Promise.all([
        supabase.from("work_sessions").select("*").eq("handler_id", handlerId).order("clock_in", { ascending: false }).limit(200),
        supabase.from("handler_issues").select("*").eq("handler_id", handlerId).order("created_at", { ascending: false }).limit(50),
      ]);
      if (cancelled) return;
      setSessions(s.data || []);
      setIssues(i.data || []);
      setLoading(false);
    };
    load();

    const ch = supabase
      .channel(`handler-dashboard-${handlerId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "work_sessions", filter: `handler_id=eq.${handlerId}` }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "handler_issues", filter: `handler_id=eq.${handlerId}` }, load)
      .subscribe();

    return () => { cancelled = true; supabase.removeChannel(ch); };
  }, [handlerId]);

  // Live clock for the running session
  useEffect(() => {
    if (!activeSession) return;
    const id = setInterval(() => setTick((t) => t + 1), 30000);
    return () => clearInterval(id);
  }, [activeSession]);

  // Live GPS position
  useEffect(() => {
    if (!navigator.geolocation) { setGpsError("Location not available on this device"); return; }
    const watch = navigator.geolocation.watchPosition(
      (pos) => { setGps({ lat: pos.coords.latitude, lon: pos.coords.longitude, accuracy: pos.coords.accuracy }); setGpsError(null); },
      () => setGpsError("Location permission is off"),
      { enableHighAccuracy: true, maximumAge: 15000, timeout: 20000 }
    );
    return () => navigator.geolocation.clearWatch(watch);
  }, []);

  const stats = useMemo(() => {
    const now = new Date().toISOString();
    const startOfToday = new Date(); startOfToday.setHours(0, 0, 0, 0);
    const startOfWeek = new Date(); startOfWeek.setDate(startOfWeek.getDate() - 7);

    let today = 0, week = 0, total = 0;
    sessions.forEach((s) => {
      const end = s.clock_out || now;
      const h = hoursBetween(s.clock_in, end);
      total += h;
      if (new Date(s.clock_in) >= startOfWeek) week += h;
      if (new Date(s.clock_in) >= startOfToday) today += h;
    });
    return { today, week, total };
  }, [sessions, tick]);

  const completed = tasks.filter((t) => t.status === "completed");
  const completedToday = completed.filter((t) => {
    if (!t.completed_at) return false;
    const d = new Date(t.completed_at); const s = new Date(); s.setHours(0, 0, 0, 0);
    return d >= s;
  });
  const openIssues = issues.filter((i) => i.status !== "resolved" && i.status !== "closed");

  if (loading) {
    return <Card><CardContent className="py-8 flex justify-center"><Loader2 className="h-5 w-5 animate-spin text-primary" /></CardContent></Card>;
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <StatCard icon={<Clock className="h-4 w-4 text-primary" />} label="Hours today" value={stats.today.toFixed(1)} sub={`${stats.week.toFixed(1)} h this week`} />
        <StatCard icon={<CheckCircle2 className="h-4 w-4 text-green-600" />} label="Tasks completed" value={String(completed.length)} sub={`${completedToday.length} today`} />
        <StatCard icon={<AlertTriangle className="h-4 w-4 text-amber-500" />} label="Pending issues" value={String(openIssues.length)} sub={openIssues.length ? "Awaiting your farmer" : "All clear"} />
        <StatCard icon={<Timer className="h-4 w-4 text-primary" />} label="Total hours" value={stats.total.toFixed(1)} sub={activeSession ? "Session running" : "No active session"} />
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2"><MapPin className="h-4 w-4" /> Current location</CardTitle>
        </CardHeader>
        <CardContent className="text-sm">
          {gps ? (
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <span className="font-mono text-xs">{gps.lat.toFixed(5)}, {gps.lon.toFixed(5)}</span>
              <div className="flex items-center gap-2">
                {gps.accuracy && <Badge variant="outline" className="text-[10px]">±{Math.round(gps.accuracy)} m</Badge>}
                <a
                  className="text-xs text-primary hover:underline"
                  href={`https://www.google.com/maps?q=${gps.lat},${gps.lon}`}
                  target="_blank" rel="noreferrer"
                >
                  Open map ↗
                </a>
              </div>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">{gpsError || "Locating…"}</p>
          )}
        </CardContent>
      </Card>

      {openIssues.length > 0 && (
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Open issues</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {openIssues.slice(0, 5).map((i) => (
              <div key={i.id} className="flex items-start justify-between gap-2 border rounded p-2">
                <div>
                  <p className="text-sm font-medium capitalize">{String(i.issue_type).replace(/_/g, " ")}</p>
                  {i.description && <p className="text-xs text-muted-foreground line-clamp-2">{i.description}</p>}
                </div>
                <span className="text-[10px] text-muted-foreground shrink-0">{format(new Date(i.created_at), "dd MMM")}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function StatCard({ icon, label, value, sub }: { icon: React.ReactNode; label: string; value: string; sub?: string }) {
  return (
    <Card>
      <CardContent className="pt-4">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">{icon}{label}</div>
        <p className="text-2xl font-bold mt-1">{value}</p>
        {sub && <p className="text-[11px] text-muted-foreground">{sub}</p>}
      </CardContent>
    </Card>
  );
}
