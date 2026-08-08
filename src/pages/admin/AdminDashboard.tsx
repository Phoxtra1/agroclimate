import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import AlertEngine from "./AlertEngine";
import AIEngine from "./AIEngine";
import FlightEngine from "./FlightEngine";
import SystemControl from "./SystemControl";
import UserSettings from "./UserSettings";
import SecurityPanel from "./SecurityPanel";
import SubscriptionPanel from "./SubscriptionPanel";
import PostHarvestAdminPanel from "./PostHarvestAdminPanel";
import MarketLinkAdminPanel from "./MarketLinkAdminPanel";
import AGNavEngine from "./AGNavEngine";
import AdminAGTransPanel from "./AdminAGTransPanel";
import DriverApprovals, { useDriverApprovals } from "@/components/admin/DriverApprovals";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import {
  Shield, Bell, Layers, Plane, Settings, Users,
  ShieldAlert, Menu, CreditCard, Archive, Store, Anchor, Truck, Download
} from "lucide-react";

import agyenkwaIcon from "@/assets/agyenkwa-icon.png";

type EngineKey =
  | "overview" | "alert" | "ai" | "flight" | "system"
  | "settings" | "security" | "subscriptions" | "post-harvest" | "market-link" | "agnav" | "agtrans" | "approvals";

const navItems: { key: EngineKey; label: string; icon: React.ElementType }[] = [
  { key: "overview", label: "Overview", icon: Shield },
  { key: "approvals", label: "Driver Approvals", icon: ShieldAlert },
  { key: "alert", label: "Alert Engine", icon: Bell },
  { key: "ai", label: "AI Layer", icon: Layers },
  { key: "flight", label: "Flight Advisory", icon: Plane },
  { key: "agnav", label: "AGNav Engine", icon: Anchor },
  { key: "agtrans", label: "AGTrans (Logistics)", icon: Truck },
  { key: "post-harvest", label: "Post-Harvest", icon: Archive },
  { key: "market-link", label: "Market Link", icon: Store },
  { key: "subscriptions", label: "Subscriptions", icon: CreditCard },
  { key: "security", label: "Security", icon: ShieldAlert },
  { key: "system", label: "System Control", icon: Settings },
  { key: "settings", label: "Admin Settings", icon: Users },
];

type Range = "today" | "7d" | "30d";

function rangeStart(r: Range) {
  const d = new Date();
  if (r === "today") { d.setHours(0, 0, 0, 0); return d; }
  if (r === "7d") { d.setDate(d.getDate() - 7); return d; }
  d.setDate(d.getDate() - 30);
  return d;
}

function OverviewPanel() {
  const [range, setRange] = useState<Range>("today");
  const [counts, setCounts] = useState({
    totalUsers: 0, activeUsers: 0, alertsTotal: 0, alertsToday: 0,
    contracts: 0, supply: 0, demand: 0, farms: 0, handlers: 0, sos: 0,
    alertsDelivered: 0, alertsOpened: 0, alertViews: 0,
  });
  const [byType, setByType] = useState<Record<string, number>>({});
  const [bySeverity, setBySeverity] = useState<Record<string, number>>({});
  const [byFarmerType, setByFarmerType] = useState<Record<string, number>>({});
  const [dailyActive, setDailyActive] = useState<{ day: string; count: number }[]>([]);
  const [loading, setLoading] = useState(true);

  const openRate = counts.alertsDelivered > 0
    ? Math.round((counts.alertsOpened / counts.alertsDelivered) * 1000) / 10
    : 0;

  const load = async () => {
    setLoading(true);
    const since = rangeStart(range).toISOString();
    const todayStart = rangeStart("today").toISOString();
    const last24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const last7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

    const [
      profiles, alerts, alertsRange, alertsToday, activeWindow,
      contracts, supply, demand, farms, handlers, sos,
      uaeDelivered, uaeOpened, dauWindow,
    ] = await Promise.all([
      supabase.from("profiles").select("id, farmer_type"),
      supabase.from("disaster_alerts").select("id, alert_type, severity, created_at"),
      supabase.from("disaster_alerts").select("id, alert_type, severity").gte("created_at", since),
      supabase.from("disaster_alerts").select("id").gte("created_at", todayStart),
      supabase.from("market_presence").select("user_id, last_seen").gte("last_seen", last24h),
      supabase.from("market_contracts").select("id").gte("created_at", since),
      supabase.from("farmer_inputs").select("id").gte("created_at", since),
      supabase.from("buyer_orders").select("id").gte("created_at", since),
      supabase.from("farm_qr_codes").select("id"),
      supabase.from("handlers").select("id"),
      supabase.from("disaster_alerts").select("id").eq("alert_type", "sos").gte("created_at", since),
      supabase.from("user_alert_events").select("id,user_id,alert_type,created_at").eq("event", "delivered").gte("created_at", since),
      supabase.from("user_alert_events").select("id,user_id").eq("event", "opened").gte("created_at", since),
      supabase.from("user_alert_events").select("user_id, created_at").eq("event", "delivered").gte("created_at", last7d),
    ]);

    const fType: Record<string, number> = {};
    (profiles.data || []).forEach((p: any) => { fType[p.farmer_type || "smallholder"] = (fType[p.farmer_type || "smallholder"] || 0) + 1; });

    const at: Record<string, number> = {}; const sv: Record<string, number> = {};
    (alertsRange.data || []).forEach((a: any) => {
      at[a.alert_type || "other"] = (at[a.alert_type || "other"] || 0) + 1;
      sv[a.severity || "info"] = (sv[a.severity || "info"] || 0) + 1;
    });

    const delivered = ((uaeDelivered.data as any[]) || []).length;
    const opened = ((uaeOpened.data as any[]) || []).length;
    const views = opened; // treat opened as views

    // Build 7-day per-day unique users reached by alerts
    const buckets: Record<string, Set<string>> = {};
    for (let i = 6; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i); d.setHours(0, 0, 0, 0);
      buckets[d.toISOString().slice(0, 10)] = new Set<string>();
    }
    ((dauWindow.data as any[]) || []).forEach((row: any) => {
      const day = new Date(row.created_at).toISOString().slice(0, 10);
      if (buckets[day] && row.user_id) buckets[day].add(row.user_id);
    });
    const dau = Object.entries(buckets).map(([day, s]) => ({ day: day.slice(5), count: s.size }));

    setByFarmerType(fType);
    setByType(at);
    setBySeverity(sv);
    setDailyActive(dau);
    setCounts({
      totalUsers: (profiles.data || []).length,
      activeUsers: (activeWindow.data || []).length,
      alertsTotal: (alerts.data || []).length,
      alertsToday: (alertsToday.data || []).length,
      contracts: (contracts.data || []).length,
      supply: (supply.data || []).length,
      demand: (demand.data || []).length,
      farms: (farms.data || []).length,
      handlers: (handlers.data || []).length,
      sos: (sos.data || []).length,
      alertsDelivered: delivered,
      alertsOpened: opened,
      alertViews: views,
    });
    setLoading(false);
  };

  useEffect(() => { load(); }, [range]);

  useEffect(() => {
    const ch = supabase.channel("admin-overview-stream")
      .on("postgres_changes", { event: "*", schema: "public", table: "disaster_alerts" }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "profiles" }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "market_contracts" }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "market_presence" }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "user_alert_events" }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "activity" }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range]);

  const exportCsv = () => {
    const rows: (string | number)[][] = [
      ["metric", "value", "range"],
      ["total_users", counts.totalUsers, "all"],
      ["active_users_24h", counts.activeUsers, "24h"],
      ["alerts_today", counts.alertsToday, "today"],
      ["alerts_total", counts.alertsTotal, "all"],
      ["alerts_delivered", counts.alertsDelivered, range],
      ["alerts_opened", counts.alertsOpened, range],
      ["alert_open_rate_pct", openRate, range],
      ["alert_views", counts.alertViews, range],
      ["new_contracts", counts.contracts, range],
      ["new_supply", counts.supply, range],
      ["new_orders", counts.demand, range],
      ["sos_broadcasts", counts.sos, range],
      ["registered_farms", counts.farms, "all"],
      ["handlers", counts.handlers, "all"],
    ];
    Object.entries(byFarmerType).forEach(([k, v]) => rows.push([`user_type_${k}`, v, "all"]));
    Object.entries(byType).forEach(([k, v]) => rows.push([`alerts_type_${k}`, v, range]));
    Object.entries(bySeverity).forEach(([k, v]) => rows.push([`alerts_severity_${k}`, v, range]));
    dailyActive.forEach(({ day, count }) => rows.push([`dau_${day}`, count, "7d"]));
    const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `agyenkwa-admin-overview-${range}-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
  };

  const farmers = byFarmerType["smallholder"] || 0 + (byFarmerType["farmer"] || 0);
  const fishermen = byFarmerType["fisherman"] || byFarmerType["fisher"] || 0;
  const boatOps = byFarmerType["boat_operator"] || byFarmerType["boat"] || 0;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <Shield className="h-6 w-6 text-primary" />
          <h1 className="text-xl font-bold">Admin Overview</h1>
          {loading && <span className="text-xs text-muted-foreground">refreshing…</span>}
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 bg-muted rounded-lg p-1 text-xs">
            {(["today", "7d", "30d"] as Range[]).map((r) => (
              <button key={r} onClick={() => setRange(r)} className={`px-3 py-1 rounded-md font-medium ${range === r ? "bg-card shadow-sm" : "text-muted-foreground"}`}>
                {r === "today" ? "Today" : r === "7d" ? "Last 7 days" : "Last 30 days"}
              </button>
            ))}
          </div>
          <Button size="sm" variant="outline" onClick={exportCsv} className="gap-2">
            <Download className="h-4 w-4" /> Export CSV
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Metric label="Total Users" value={counts.totalUsers} />
        <Metric label="Active (24h)" value={counts.activeUsers} />
        <Metric label="Alerts Sent Today" value={counts.alertsToday} />
        <Metric label={`Alert Open Rate`} value={openRate} suffix="%" />
      </div>

      <Card>
        <CardContent className="pt-4">
          <p className="text-sm font-semibold mb-2">User breakdown</p>
          <div className="grid grid-cols-3 gap-2 text-sm mb-3">
            <div className="border rounded-md p-2"><div className="text-[11px] text-muted-foreground">Farmers</div><div className="font-bold">{farmers}</div></div>
            <div className="border rounded-md p-2"><div className="text-[11px] text-muted-foreground">Fishermen</div><div className="font-bold">{fishermen}</div></div>
            <div className="border rounded-md p-2"><div className="text-[11px] text-muted-foreground">Boat Operators</div><div className="font-bold">{boatOps}</div></div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
            {Object.entries(byFarmerType).map(([k, v]) => (
              <div key={k} className="border rounded-md p-2"><div className="text-[11px] text-muted-foreground capitalize">{k.replace(/_/g, " ")}</div><div className="font-bold">{v}</div></div>
            ))}
            {Object.keys(byFarmerType).length === 0 && <p className="text-xs text-muted-foreground">No user data yet.</p>}
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <Card><CardContent className="pt-4">
          <p className="text-sm font-semibold mb-2">Alerts by type ({range})</p>
          {Object.keys(byType).length === 0 ? <p className="text-xs text-muted-foreground">No alerts in range.</p> : (
            <ul className="space-y-1 text-sm">
              {Object.entries(byType).map(([k, v]) => <li key={k} className="flex justify-between"><span className="capitalize">{k}</span><span className="font-semibold">{v}</span></li>)}
            </ul>
          )}
        </CardContent></Card>
        <Card><CardContent className="pt-4">
          <p className="text-sm font-semibold mb-2">Alerts by severity ({range})</p>
          {Object.keys(bySeverity).length === 0 ? <p className="text-xs text-muted-foreground">No alerts in range.</p> : (
            <ul className="space-y-1 text-sm">
              {Object.entries(bySeverity).map(([k, v]) => <li key={k} className="flex justify-between"><span className="capitalize">{k}</span><span className="font-semibold">{v}</span></li>)}
            </ul>
          )}
        </CardContent></Card>
      </div>

      <Card>
        <CardContent className="pt-4">
          <p className="text-sm font-semibold mb-2">Alert performance ({range})</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
            <Metric label="Delivered" value={counts.alertsDelivered} small />
            <Metric label="Opened" value={counts.alertsOpened} small />
            <Metric label="Open rate" value={openRate} suffix="%" small />
            <Metric label="Alert views" value={counts.alertViews} small />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-4">
          <p className="text-sm font-semibold mb-2">Daily active users (last 7 days)</p>
          {dailyActive.length === 0 ? <p className="text-xs text-muted-foreground">No activity yet.</p> : (
            <div className="flex items-end gap-2 h-24">
              {dailyActive.map((d) => {
                const max = Math.max(1, ...dailyActive.map(x => x.count));
                const h = Math.round((d.count / max) * 100);
                return (
                  <div key={d.day} className="flex-1 flex flex-col items-center gap-1">
                    <div className="w-full bg-primary/70 rounded-t" style={{ height: `${h}%`, minHeight: 2 }} title={`${d.count} users`} />
                    <span className="text-[10px] text-muted-foreground">{d.day}</span>
                    <span className="text-[10px] font-semibold">{d.count}</span>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-4">
          <p className="text-sm font-semibold mb-2">Engagement & activity ({range})</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
            <Metric label="New contracts" value={counts.contracts} small />
            <Metric label="New supply listings" value={counts.supply} small />
            <Metric label="New buyer orders" value={counts.demand} small />
            <Metric label="SOS broadcasts" value={counts.sos} small />
            <Metric label="Registered farms" value={counts.farms} small />
            <Metric label="Handlers" value={counts.handlers} small />
          </div>
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground">Use the sidebar to manage individual engines (Alerts, AI, Flight, Market Link, Post-Harvest, Subscriptions, Security, System).</p>
    </div>
  );
}

function Metric({ label, value, small, suffix }: { label: string; value: number; small?: boolean; suffix?: string }) {
  return (
    <Card><CardContent className="pt-4 text-center">
      <p className={small ? "text-xl font-bold" : "text-2xl font-bold"}>{value.toLocaleString()}{suffix || ""}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </CardContent></Card>
  );
}


/**
 * AdminDashboard
 * --------------
 * AgroClimate admins authenticate centrally via Amineva (https://amineva.com)
 * and reach this workspace through https://agro.amineva.com/admin.
 * No local sign-in gate is rendered here — the central identity layer
 * controls workspace access. Anyone hitting this route lands on the
 * workspace immediately.
 */
export default function AdminDashboard() {
  const [activeEngine, setActiveEngine] = useState<EngineKey>("overview");
  const [sheetOpen, setSheetOpen] = useState(false);

  const renderEngine = () => {
    switch (activeEngine) {
      case "alert": return <AlertEngine />;
      case "ai": return <AIEngine />;
      case "flight": return <FlightEngine />;
      case "system": return <SystemControl />;
      case "settings": return <UserSettings />;
      case "security": return <SecurityPanel />;
      case "subscriptions": return <SubscriptionPanel />;
      case "post-harvest": return <PostHarvestAdminPanel />;
      case "market-link": return <MarketLinkAdminPanel />;
      case "agnav": return <AGNavEngine />;
      case "agtrans": return <AdminAGTransPanel />;
      default: return <OverviewPanel />;
    }
  };

  const NavButtons = ({ onClick }: { onClick?: () => void }) => (
    <>
      {navItems.map(item => {
        const active = activeEngine === item.key;
        return (
          <button
            key={item.key}
            onClick={() => { setActiveEngine(item.key); onClick?.(); }}
            className={`flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
              active ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground"
            }`}
          >
            <item.icon className="h-4 w-4" />
            {item.label}
          </button>
        );
      })}
    </>
  );

  return (
    <div className="flex min-h-screen bg-background">
      {/* Desktop sidebar */}
      <aside className="w-60 bg-card border-r border-border flex-col fixed h-full z-30 hidden md:flex">
        <div className="flex items-center gap-2 px-5 h-16 border-b border-border">
          <img src={agyenkwaIcon} alt="Agyenkwa" className="h-8 w-8 rounded-lg" />
          <span className="font-bold text-lg text-foreground">Admin Workspace</span>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          <NavButtons />
        </nav>
        <div className="px-3 py-4 border-t border-border">
          <p className="text-[11px] text-muted-foreground px-3">
            Authenticated via Amineva central identity
          </p>
          <a
            href="https://amineva.com/account"
            className="block mt-2 px-3 text-xs text-primary hover:underline"
          >
            Manage central account ↗
          </a>
        </div>
      </aside>

      {/* Mobile header + sheet */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-40 bg-card border-b border-border px-4 h-14 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <img src={agyenkwaIcon} alt="Agyenkwa" className="h-7 w-7 rounded-lg" />
          <span className="font-bold text-sm">Admin Workspace</span>
        </div>
        <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon"><Menu className="h-5 w-5" /></Button>
          </SheetTrigger>
          <SheetContent side="left" className="bg-card w-64 p-4">
            <div className="flex items-center gap-2 mb-6">
              <img src={agyenkwaIcon} alt="Agyenkwa" className="h-7 w-7 rounded-lg" />
              <span className="font-bold">Admin Workspace</span>
            </div>
            <nav className="space-y-1">
              <NavButtons onClick={() => setSheetOpen(false)} />
            </nav>
            <div className="mt-6 pt-4 border-t border-border">
              <p className="text-[11px] text-muted-foreground">
                Authenticated via Amineva central identity
              </p>
            </div>
          </SheetContent>
        </Sheet>
      </div>

      {/* Content */}
      <main className="flex-1 md:ml-60 p-4 lg:p-6 pt-16 md:pt-6 overflow-y-auto">
        {renderEngine()}
      </main>
    </div>
  );
}
