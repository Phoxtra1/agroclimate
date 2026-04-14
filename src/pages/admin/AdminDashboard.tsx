import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import AlertEngine from "./Alert";
import AIEngine from "./AIEngine";
import FlightEngine from "./FlightEngine";
import SystemControl from "./SystemControl";
import UserSettings from "./UserSettings";
import SecurityPanel from "./SecurityPanel";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import {
  Shield, Bell, Bot, Package, Plane, Leaf, Settings, Users,
  LogOut, ShieldAlert, Menu, Home,
} from "lucide-react";
import aminevaLogo from "@/assets/amineva-logo.png";

type EngineKey = "overview" | "alert" | "ai" | "flight" | "system" | "settings" | "security";

const navItems: { key: EngineKey; label: string; icon: React.ElementType }[] = [
  { key: "overview", label: "Overview", icon: Shield },
  { key: "security", label: "Security", icon: ShieldAlert },
  { key: "alert", label: "Alert Engine", icon: Bell },
  { key: "ai", label: "Odeneho AI", icon: Bot },
  { key: "flight", label: "Flight Advisory", icon: Plane },
  { key: "system", label: "System Control", icon: Settings },
  { key: "settings", label: "User Settings", icon: Users },
];

function OverviewPanel() {
  const [counts, setCounts] = useState({ users: 0, alerts: 0, inventory: 0 });

  useEffect(() => {
    Promise.all([
      supabase.from("profiles").select("id", { count: "exact", head: true }),
      supabase.from("disaster_alerts").select("id", { count: "exact", head: true }).eq("active", true),
      supabase.from("inventory_items").select("id", { count: "exact", head: true }),
    ]).then(([u, a, i]) => {
      setCounts({
        users: u.count ?? 0,
        alerts: a.count ?? 0,
        inventory: i.count ?? 0,
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
        <Card><CardContent className="pt-4 text-center"><p className="text-2xl font-bold">{counts.inventory}</p><p className="text-xs text-muted-foreground">Inventory Items</p></CardContent></Card>
      </div>
      <p className="text-sm text-muted-foreground mt-4">Select an engine from the sidebar to manage platform components.</p>
    </div>
  );
}

export default function AdminDashboard() {
  const { signOut, user } = useAuth();
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
      default: return <OverviewPanel />;
    }
  };

  return (
    <div className="flex min-h-screen bg-background">
      {/* Desktop sidebar */}
      <aside className="w-60 bg-sidebar border-r border-sidebar-border flex-col fixed h-full z-30 hidden md:flex">
        <div className="flex items-center gap-2 px-5 h-16 border-b border-sidebar-border">
          <img src={aminevaLogo} alt="AgroClimate" className="h-8 w-8 rounded-full" />
          <span className="font-bold text-lg text-sidebar-foreground">Admin Panel</span>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          <NavButtons />
        </nav>
        <div className="px-3 py-4 border-t border-sidebar-border">
          <p className="text-xs text-sidebar-foreground/50 mb-2 px-3 truncate">{user?.email}</p>
          <Button variant="ghost" onClick={signOut} className="w-full justify-start text-sidebar-foreground/70 hover:text-sidebar-foreground">
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
          <SheetContent side="left" className="bg-sidebar w-64 p-4">
            <div className="flex items-center gap-2 mb-6">
              <img src={aminevaLogo} alt="AgroClimate" className="h-7 w-7 rounded-full" />
              <span className="font-bold text-sidebar-foreground">Admin Panel</span>
            </div>
            <nav className="space-y-1">
              <NavButtons onClick={() => setSheetOpen(false)} />
            </nav>
            <div className="mt-6 pt-4 border-t border-sidebar-border">
              <Button variant="ghost" onClick={signOut} className="w-full justify-start text-sidebar-foreground/70">
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
