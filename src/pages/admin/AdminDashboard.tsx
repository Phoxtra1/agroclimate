import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
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
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import {
  Shield, Bell, Bot, Plane, Settings, Users,
  LogOut, ShieldAlert, Menu, CreditCard, Archive, Store,
} from "lucide-react";
import aminevaLogo from "@/assets/amineva-logo.png";

type EngineKey = "overview" | "alert" | "ai" | "flight" | "system" | "settings" | "security" | "subscriptions" | "post-harvest" | "market-link";

const navItems: { key: EngineKey; label: string; icon: React.ElementType }[] = [
  { key: "overview", label: "Overview", icon: Shield },
  { key: "alert", label: "Alert Engine", icon: Bell },
  { key: "ai", label: "Odeneho AI", icon: Bot },
  { key: "flight", label: "Flight Advisory", icon: Plane },
  { key: "post-harvest", label: "Post-Harvest", icon: Archive },
  { key: "market-link", label: "Market Link", icon: Store },
  { key: "subscriptions", label: "Subscriptions", icon: CreditCard },
  { key: "security", label: "Security", icon: ShieldAlert },
  { key: "system", label: "System Control", icon: Settings },
  { key: "settings", label: "Admin Settings", icon: Users },
];

function OverviewPanel() {
  const [counts, setCounts] = useState({ users: 0, alerts: 0 });

  useEffect(() => {
    Promise.all([
      supabase.from("profiles").select("id").then(r => r),
      supabase.from("disaster_alerts").select("id").then(r => r),
    ]).then(([u, a]) => {
      setCounts({
        users: (u.data || []).length,
        alerts: (a.data || []).length,
      });
    });
  }, []);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 mb-6">
        <Shield className="h-6 w-6 text-primary" />
        <h1 className="text-xl font-bold">Admin Overview</h1>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card><CardContent className="pt-4 text-center"><p className="text-2xl font-bold">{counts.users}</p><p className="text-xs text-muted-foreground">Total Users</p></CardContent></Card>
        <Card><CardContent className="pt-4 text-center"><p className="text-2xl font-bold">{counts.alerts}</p><p className="text-xs text-muted-foreground">Active Alerts</p></CardContent></Card>
        <Card><CardContent className="pt-4 text-center"><p className="text-2xl font-bold">Online</p><p className="text-xs text-muted-foreground">AI Status</p></CardContent></Card>
        <Card><CardContent className="pt-4 text-center"><p className="text-2xl font-bold">—</p><p className="text-xs text-muted-foreground">Subscriptions</p></CardContent></Card>
      </div>
      <p className="text-sm text-muted-foreground mt-4">Select an engine from the sidebar to manage platform components.</p>
    </div>
  );
}

export default function AdminDashboard() {
  const { user } = useAuth();
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
          <img src={aminevaLogo} alt="AgroClimate" className="h-8 w-8 rounded-full" />
          <span className="font-bold text-lg text-foreground">Admin Workspace</span>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          <NavButtons />
        </nav>
        <div className="px-3 py-4 border-t border-border">
          <p className="text-xs text-muted-foreground mb-2 px-3 truncate">{user?.email}</p>
          <Button variant="ghost" className="w-full justify-start text-muted-foreground hover:text-foreground">
            <LogOut className="h-4 w-4 mr-2" /> Sign Out
          </Button>
        </div>
      </aside>

      {/* Mobile header + sheet */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-40 bg-card border-b border-border px-4 h-14 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <img src={aminevaLogo} alt="AgroClimate" className="h-7 w-7 rounded-full" />
          <span className="font-bold text-sm">Admin Panel</span>
        </div>
        <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon"><Menu className="h-5 w-5" /></Button>
          </SheetTrigger>
          <SheetContent side="left" className="bg-card w-64 p-4">
            <div className="flex items-center gap-2 mb-6">
              <img src={aminevaLogo} alt="AgroClimate" className="h-7 w-7 rounded-full" />
              <span className="font-bold">Admin Panel</span>
            </div>
            <nav className="space-y-1">
              <NavButtons onClick={() => setSheetOpen(false)} />
            </nav>
            <div className="mt-6 pt-4 border-t border-border">
              <Button variant="ghost" className="w-full justify-start text-muted-foreground">
                <LogOut className="h-4 w-4 mr-2" /> Sign Out
              </Button>
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
