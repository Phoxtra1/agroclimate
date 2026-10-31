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
import { MaritimeOperationsPanel } from "@/components/admin/MaritimeOperationsPanel";
import AdminAGTransPanel from "./AdminAGTransPanel";
import DataExporterPanel from "./DataExporterPanel";
import AgrofundPanel from "./AgrofundPanel";
import DriverApprovals, { useDriverApprovals } from "@/components/admin/DriverApprovals";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import {
  Shield, Bell, Layers, Plane, Settings, Users, Landmark,
  ShieldAlert, Menu, CreditCard, Archive, Store, Anchor, Truck, Download, Database, LogOut
} from "lucide-react";

import { ErrorBoundary } from "@/components/ErrorBoundary";
import agyenkwaIcon from "@/assets/agyenkwa-icon.png";
import { useAuth } from "@/hooks/useAuth";

type EngineKey =
  | "overview" | "data-export" | "agrofund" | "alert" | "ai" | "flight" | "system"
  | "settings" | "security" | "subscriptions" | "post-harvest" | "market-link" | "maritime" | "agtrans" | "approvals";

const navItems: { key: EngineKey; label: string; icon: React.ElementType }[] = [
  { key: "overview", label: "Overview", icon: Shield },
  { key: "agrofund", label: "Agrofund", icon: Landmark },
  { key: "data-export", label: "Data Export Hub", icon: Database },
  { key: "approvals", label: "Driver Approvals", icon: ShieldAlert },
  { key: "alert", label: "Alert Engine", icon: Bell },
  { key: "ai", label: "AI Layer", icon: Layers },
  { key: "flight", label: "Flight Advisory", icon: Plane },
  { key: "maritime", label: "Maritime Safety", icon: Anchor },
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

function OverviewPanel({ onNavigate }: { onNavigate?: (key: EngineKey) => void }) {
  const { drivers: approvalDrivers = [] } = useDriverApprovals() || {};
  const pendingApprovals = (Array.isArray(approvalDrivers) ? approvalDrivers : []).filter(
    (d) => d && (d.approval_status === "pending" || d.approval_status === "more_info")
  ).length;
  const [range, setRange] = useState<Range>("today");
  const [counts, setCounts] = useState({
    totalUsers: 0, activeUsers: 0, alertsTotal: 0, alertsToday: 0,
    contracts: 0, supply: 0, demand: 0, farms: 0, handlers: 0, sos: 0,
    alertsDelivered: 0, alertsOpened: 0, alertViews: 0,
    driversTotal: 0, driversPending: 0, driversApproved: 0,
    requestsTotal: 0, agreementsTotal: 0, activeTrips: 0, completedTrips: 0,
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
    try {
      const since = rangeStart(range).toISOString();
      const todayStart = rangeStart("today").toISOString();

      // Aggregates come from a server-side stats function so the numbers are the
      // real platform totals (row-level rules would otherwise hide other users).
      const { data, error: rpcErr } = await supabase.rpc("admin_overview_stats" as any, {
        p_since: since,
        p_today: todayStart,
      } as any);

      if (rpcErr) {
        console.warn("RPC admin_overview_stats notice:", rpcErr.message);
      }

      const s: any = data || {};

      const buckets: Record<string, number> = {};
      for (let i = 6; i >= 0; i--) {
        const d = new Date(); d.setDate(d.getDate() - i); d.setHours(0, 0, 0, 0);
        buckets[d.toISOString().slice(0, 10)] = 0;
      }

      if (Array.isArray(s.dau)) {
        s.dau.forEach((row: any) => {
          if (row && row.day && row.day in buckets) buckets[row.day] = Number(row.count) || 0;
        });
      }

      const dau = Object.entries(buckets).map(([day, count]) => ({ day: day.slice(5), count }));

      const delivered = Number(s.alerts_delivered) || 0;
      const opened = Number(s.alerts_opened) || 0;

      setByFarmerType(s.by_farmer_type && typeof s.by_farmer_type === "object" ? s.by_farmer_type : {});
      setByType(s.alerts_by_type && typeof s.alerts_by_type === "object" ? s.alerts_by_type : {});
      setBySeverity(s.alerts_by_severity && typeof s.alerts_by_severity === "object" ? s.alerts_by_severity : {});
      setDailyActive(dau);
      setCounts({
        totalUsers: Number(s.total_users) || 0,
        activeUsers: Number(s.active_users) || 0,
        alertsTotal: Number(s.alerts_total) || 0,
        alertsToday: Number(s.alerts_today) || 0,
        contracts: Number(s.contracts) || 0,
        supply: Number(s.supply) || 0,
        demand: Number(s.demand) || 0,
        farms: Number(s.farms) || 0,
        handlers: Number(s.handlers) || 0,
        sos: Number(s.sos) || 0,
        alertsDelivered: delivered,
        alertsOpened: opened,
        alertViews: opened,
        driversTotal: Number(s.drivers_total) || 0,
        driversPending: Number(s.drivers_pending) || 0,
        driversApproved: Number(s.drivers_approved) || 0,
        requestsTotal: Number(s.requests_total) || 0,
        agreementsTotal: Number(s.agreements_total) || 0,
        activeTrips: Number(s.active_trips) || 0,
        completedTrips: Number(s.completed_trips) || 0,
      });
    } catch (err) {
      console.error("Error loading OverviewPanel stats:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [range]);

  useEffect(() => {
    // Every metric source streams live — cards update the moment a row is
    // inserted or updated anywhere on the platform. No polling, no focus tick.
    const tables = [
      "disaster_alerts", "profiles", "market_contracts", "market_presence",
      "user_alert_events", "activity", "agtrans_drivers", "farmer_inputs",
      "buyer_orders", "handlers", "farm_qr_codes", "transport_notifications",
    ];
    let ch = supabase.channel("admin-overview-stream");
    tables.forEach((table) => {
      ch = ch.on("postgres_changes", { event: "*", schema: "public", table }, () => load());
    });
    ch.subscribe();
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
      ["drivers_total", counts.driversTotal, "all"],
      ["drivers_pending", counts.driversPending, "all"],
      ["drivers_approved", counts.driversApproved, "all"],
      ["transport_requests", counts.requestsTotal, range],
      ["transport_agreements", counts.agreementsTotal, range],
      ["active_trips", counts.activeTrips, range],
      ["completed_trips", counts.completedTrips, range],
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
    a.download = `agroclimate-admin-overview-${range}-${new Date().toISOString().slice(0, 10)}.csv`;
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

      <Card className={pendingApprovals > 0 ? "border-primary/60" : undefined}>
        <CardContent className="pt-4 flex items-center justify-between gap-3 flex-wrap">
          <div>
            <p className="text-sm font-semibold">Driver registrations awaiting approval</p>
            <p className="text-xs text-muted-foreground">Live queue from AGTrans partner sign-ups.</p>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-2xl font-bold">{pendingApprovals}</span>
            <Button size="sm" onClick={() => onNavigate?.("approvals")}>Review</Button>
          </div>
        </CardContent>
      </Card>



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

      <Card>
        <CardContent className="pt-4">
          <p className="text-sm font-semibold mb-2">AGTrans Drivers & Logistics ({range})</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
            <Metric label="Total drivers" value={counts.driversTotal} small />
            <Metric label="Pending approvals" value={counts.driversPending} small />
            <Metric label="Approved drivers" value={counts.driversApproved} small />
            <Metric label="Transport requests" value={counts.requestsTotal} small />
            <Metric label="Transport agreements" value={counts.agreementsTotal} small />
            <Metric label="Active trips" value={counts.activeTrips} small />
          </div>
        </CardContent>
      </Card>

      <Card className="border-emerald-500/20 bg-emerald-950/10">
        <CardContent className="pt-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <p className="text-sm font-bold flex items-center gap-2 text-foreground">
              <Database className="h-4 w-4 text-emerald-500" /> Agro-Climate Centralized Data Export Hub
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Extract anonymized operational CSV & JSON datasets across all 8 modules or download complete Linked Lifecycle Chains (Weather → Farm → Harvest → Market → Transport → Outcome).
            </p>
          </div>
          <Button
            size="sm"
            onClick={() => onNavigate?.("data-export")}
            className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs shrink-0"
          >
            <Download className="h-3.5 w-3.5 mr-1.5" /> Open Data Export Hub
          </Button>
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground">Use the sidebar to manage individual engines (Data Export, Alerts, AI, Flight, Market Link, Post-Harvest, Subscriptions, Security, System).</p>
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
 * AgroClimate admins authenticate centrally via Central Admin identity
 * and reach this workspace through the admin portal.
 * No local sign-in gate is rendered here — the central identity layer
 * controls workspace access. Anyone hitting this route lands on the
 * workspace immediately.
 */
export default function AdminDashboard() {
  const [activeEngine, setActiveEngine] = useState<EngineKey>("overview");
  const [sheetOpen, setSheetOpen] = useState(false);
  const { signOut } = useAuth();

  const handleSignOut = async () => {
    await signOut();
    window.location.assign("/");
  };

  const renderEngine = () => {
    switch (activeEngine) {
      case "agrofund": return <AgrofundPanel />;
      case "data-export": return <DataExporterPanel />;
      case "alert": return <AlertEngine />;
      case "ai": return <AIEngine />;
      case "flight": return <FlightEngine />;
      case "system": return <SystemControl />;
      case "settings": return <UserSettings />;
      case "security": return <SecurityPanel />;
      case "subscriptions": return <SubscriptionPanel />;
      case "post-harvest": return <PostHarvestAdminPanel />;
      case "market-link": return <MarketLinkAdminPanel />;
      case "maritime": return <MaritimeOperationsPanel />;
      case "agtrans": return <AdminAGTransPanel />;
      case "approvals": return <DriverApprovals />;
      default: return <OverviewPanel onNavigate={setActiveEngine} />;
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
    <ErrorBoundary fallbackTitle="Admin Workspace Recovery">
      <div className="flex min-h-screen bg-background">
        {/* Desktop sidebar */}
        <aside className="w-60 bg-card border-r border-border flex-col fixed h-full z-30 hidden md:flex">
          <div className="flex items-center gap-2 px-5 h-16 border-b border-border">
            <img src={agyenkwaIcon} alt="AgroClimate" className="h-8 w-8 rounded-lg" />
            <span className="font-bold text-lg text-foreground">Admin Workspace</span>
          </div>
          <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
            <NavButtons />
          </nav>
          <div className="px-3 py-4 border-t border-border">
            <button
              onClick={handleSignOut}
              className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            >
              <LogOut className="h-4 w-4" />
              Sign out
            </button>
          </div>
        </aside>

        {/* Mobile header + sheet */}
        <div className="md:hidden fixed top-0 left-0 right-0 z-40 bg-card border-b border-border px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <img src={agyenkwaIcon} alt="AgroClimate" className="h-7 w-7 rounded-lg" />
            <span className="font-bold text-sm">Admin Workspace</span>
          </div>
          <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon"><Menu className="h-5 w-5" /></Button>
            </SheetTrigger>
            <SheetContent side="left" className="bg-card w-64 p-4">
              <div className="flex items-center gap-2 mb-6">
                <img src={agyenkwaIcon} alt="AgroClimate" className="h-7 w-7 rounded-lg" />
                <span className="font-bold">Admin Workspace</span>
              </div>
              <nav className="space-y-1">
                <NavButtons onClick={() => setSheetOpen(false)} />
              </nav>
              <div className="mt-6 pt-4 border-t border-border">
                <button
                  onClick={() => { setSheetOpen(false); handleSignOut(); }}
                  className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                >
                  <LogOut className="h-4 w-4" />
                  Sign out
                </button>
              </div>
            </SheetContent>
          </Sheet>
        </div>

        {/* Content */}
        <main className="flex-1 md:ml-60 p-4 lg:p-6 pt-16 md:pt-6 overflow-y-auto">
          {renderEngine()}
        </main>
      </div>
    </ErrorBoundary>
  );
}
