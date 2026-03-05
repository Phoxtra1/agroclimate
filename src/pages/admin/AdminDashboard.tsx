import { useState } from "react";
import AlertEngine from "./AlertEngine";
import AIEngine from "./AIEngine";
import InventoryEngine from "./InventoryEngine";
import FlightEngine from "./FlightEngine";
import EnvironmentEngine from "./EnvironmentEngine";
import SystemControl from "./SystemControl";
import UserSettings from "./UserSettings";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

type EngineKey = "overview" | "alert" | "ai" | "inventory" | "flight" | "environment" | "system" | "settings";

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
          <Card><CardContent>Total Users: 0</CardContent></Card>
          <Card><CardContent>Active Alerts: 0</CardContent></Card>
          <Card><CardContent>AI Status: Online</CardContent></Card>
          <Card><CardContent>Inventory Items: 0</CardContent></Card>
        </div>
      );
    }
  };

  return (
    <div className="flex h-full">
      {/* Sidebar CTA */}
      <div className="w-64 p-4 border-r border-border space-y-2">
        <Button onClick={() => setActiveEngine("overview")} className="w-full">Overview</Button>
        <Button onClick={() => setActiveEngine("alert")} className="w-full">Alert</Button>
        <Button onClick={() => setActiveEngine("ai")} className="w-full">Odeneho</Button>
        <Button onClick={() => setActiveEngine("inventory")} className="w-full">Inventory</Button>
        <Button onClick={() => setActiveEngine("flight")} className="w-full">Flight Advisory</Button>
        <Button onClick={() => setActiveEngine("environment")} className="w-full">Environment</Button>
        <Button onClick={() => setActiveEngine("system")} className="w-full">System Control</Button>
        <Button onClick={() => setActiveEngine("settings")} className="w-full">User Settings</Button>
      </div>

      {/* Engine Content */}
      <div className="flex-1 p-6 overflow-y-auto">
        {renderEngine()}
      </div>
    </div>
  );
}
