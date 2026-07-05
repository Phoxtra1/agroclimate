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
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import {
  Shield, Bell, Bot, Plane, Settings, Users,
  ShieldAlert, Menu, CreditCard, Archive, Store, Anchor, Truck, Download
} from "lucide-react";

import agyenkwaIcon from "@/assets/agyenkwa-icon.png";

type EngineKey =
  | "overview" | "alert" | "ai" | "flight" | "system"
  | "settings" | "security" | "subscriptions" | "post-harvest" | "market-link" | "agnav" | "agtrans";

const navItems: { key: EngineKey; label: string; icon: React.ElementType }[] = [
  { key: "overview", label: "Overview", icon: Shield },
  { key: "alert", label: "Alert Engine", icon: Bell },
  { key: "ai", label: "Odeneho AI", icon: Bot },
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
  });
  const [byType, setByType] = useState<Record<string, number>>({});
  const [bySeverity, setBySeverity] = useState<Record<string, number>>({});
  const [byFarmerType, setByFarmerType] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const since = rangeStart(range).toISOString();
    const todayStart = rangeStart("today").toISOString();
    const last24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    const [profiles, alerts, alertsRange, alertsToday, activeWindow, contracts, supply, demand, farms, handlers, sos] = await Promise.all([
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
    ]);

    const fType: Record<string, number> = {};
    (profiles.data || []).forEach((p: any) => { fType[p.farmer_type || "smallholder"] = (fType[p.farmer_type || "smallholder"] || 0) + 1; });

    const at: Record<string, number> = {}; const sv: Record<string, number> = {};
    (alertsRange.data || []).forEach((a: any) => {
      at[a.alert_type || "other"] = (at[a.alert_type || "other"] || 0) + 1;
      sv[a.severity || "info"] = (sv[a.severity || "info"] || 0) + 1;
    });

    setByFarmerType(fType);
    setByType(at);
    setBySeverity(sv);
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
      .subscribe();
    return () => { supabase.removeChannel(ch); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range]);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <Shield className="h-6 w-6 text-primary" />
          <h1 className="text-xl font-bold">Admin Overview</h1>
          {loading && <span className="text-xs text-muted-foreground">refreshing…</span>}
        </div>
        <div className="flex items-center gap-1 bg-muted rounded-lg p-1 text-xs">
          {(["today", "7d", "30d"] as Range[]).map((r) => (
            <button key={r} onClick={() => setRange(r)} className={`px-3 py-1 rounded-md font-medium ${range === r ? "bg-card shadow-sm" : "text-muted-foreground"}`}>
              {r === "today" ? "Today" : r === "7d" ? "Last 7 days" : "Last 30 days"}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Metric label="Total Users" value={counts.totalUsers} />
        <Metric label="Active (24h)" value={counts.activeUsers} />
        <Metric label="Alerts Today" value={counts.alertsToday} />
        <Metric label="Alerts Total" value={counts.alertsTotal} />
      </div>

      <Card>
        <CardContent className="pt-4">
          <p className="text-sm font-semibold mb-2">User breakdown</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
            {Object.entries(byFarmerType).map(([k, v]) => (
              <div key={k} className="border rounded-md p-2"><div className="text-[11px] text-muted-foreground capitalize">{k}</div><div className="font-bold">{v}</div></div>
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

function Metric({ label, value, small }: { label: string; value: number; small?: boolean }) {
  return (
    <Card><CardContent className="pt-4 text-center">
      <p className={small ? "text-xl font-bold" : "text-2xl font-bold"}>{value.toLocaleString()}</p>
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
