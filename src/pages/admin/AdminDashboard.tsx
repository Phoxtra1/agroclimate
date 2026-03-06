import { useState } from "react";
import AlertEngine from "./Alert";
import AIEngine from "./AIEngine";
import InventoryEngine from "./InventoryEngine";
import FlightEngine from "./FlightEngine";
import EnvironmentEngine from "./EnvironmentEngine";
import SystemControl from "./SystemControl";
import UserSettings from "./UserSettings";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Shield, Bell, Bot, Package, Plane, Leaf, Settings, Users } from "lucide-react";

type EngineKey = "overview" | "alert" | "ai" | "inventory" | "flight" | "environment" | "system" | "settings";

const navItems: { key: EngineKey; label: string; icon: React.ElementType }[] = [
  { key: "overview", label: "Overview", icon: Shield },
  { key: "alert", label: "Alert Engine", icon: Bell },
  { key: "ai", label: "Odeneho AI", icon: Bot },
  { key: "inventory", label: "Inventory", icon: Package },
  { key: "flight", label: "Flight Advisory", icon: Plane },
  { key: "environment", label: "Environment", icon: Leaf },
  { key: "system", label: "System Control", icon: Settings },
  { key: "settings", label: "User Settings", icon: Users },
];

export default function AdminDashboard() {
  const [activeEngine, setActiveEngine] = useState<EngineKey>("overview");

  const renderEngine = () => {
    switch (activeEngine) {
      case "alert": return <AlertEngine />;
      case "ai": return <AIEngine />;
      case "inventory": return <InventoryEngine />;
      case "flight": return <FlightEngine />;
      case "environment": return <EnvironmentEngine />;
      case "system": return <SystemControl />;
      case "settings": return <UserSettings />;
      default: return (
        <div className="space-y-4">
          <div className="flex items-center gap-3 mb-6">
            <Shield className="h-6 w-6 text-primary" />
            <h1 className="text-xl font-bold">Admin Dashboard</h1>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <Card><CardContent className="pt-4 text-center"><p className="text-2xl font-bold">0</p><p className="text-xs text-muted-foreground">Total Users</p></CardContent></Card>
            <Card><CardContent className="pt-4 text-center"><p className="text-2xl font-bold">0</p><p className="text-xs text-muted-foreground">Active Alerts</p></CardContent></Card>
            <Card><CardContent className="pt-4 text-center"><p className="text-2xl font-bold">Online</p><p className="text-xs text-muted-foreground">AI Status</p></CardContent></Card>
            <Card><CardContent className="pt-4 text-center"><p className="text-2xl font-bold">0</p><p className="text-xs text-muted-foreground">Inventory Items</p></CardContent></Card>
          </div>
          <p className="text-sm text-muted-foreground mt-4">Select an engine from the sidebar to manage platform components. Backend integration and AI training features will be connected in future updates.</p>
        </div>
      );
    }
  };

  return (
    <div className="flex h-full">
      {/* Sidebar */}
      <div className="w-56 p-3 border-r border-border space-y-1 flex-shrink-0 hidden md:block">
        {navItems.map((item) => (
          <Button
            key={item.key}
            variant={activeEngine === item.key ? "default" : "ghost"}
            onClick={() => setActiveEngine(item.key)}
            className="w-full justify-start gap-2 text-sm"
            size="sm"
          >
            <item.icon className="h-4 w-4" />
            {item.label}
          </Button>
        ))}
      </div>

      {/* Mobile nav */}
      <div className="md:hidden fixed top-14 left-0 right-0 z-30 bg-card border-b border-border overflow-x-auto">
        <div className="flex gap-1 p-2">
          {navItems.map((item) => (
            <button
              key={item.key}
              onClick={() => setActiveEngine(item.key)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs whitespace-nowrap transition-colors ${
                activeEngine === item.key ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
              }`}
            >
              <item.icon className="h-3 w-3" />
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {/* Engine Content */}
      <div className="flex-1 p-4 lg:p-6 overflow-y-auto pt-14 md:pt-4">
        {renderEngine()}
      </div>
    </div>
  );
}
