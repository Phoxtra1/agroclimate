// src/pages/admin/AdminDashboard.tsx
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Shield, Users, Bell, Activity, AlertTriangle } from "lucide-react";

// Engine imports
import Alert from "./components/Alert";
import AIEngine from "./components/AIEngine";
import InventoryEngine from "./components/InventoryEngine";
import FlightEngine from "./components/FlightEngine";
import EnvironmentEngine from "./components/EnvironmentEngine";
import UserSettings from "./components/UserSettings";

export default function AdminDashboard() {
  const { user } = useAuth();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [userCount, setUserCount] = useState(0);
  const [alertsCount, setAlertsCount] = useState(0);
  const [subscriptionsCount, setSubscriptionsCount] = useState(0);
  const [selectedEngine, setSelectedEngine] = useState<"Alert" | "Odeneho" | "Inventory" | "Flight Advisory" | "Environment" | "Settings" | null>(null);

  useEffect(() => {
    checkAdmin();
  }, [user]);

  const checkAdmin = async () => {
    if (!user) {
      setIsAdmin(false);
      return;
    }
    const { data } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .maybeSingle();

    setIsAdmin(!!data);
    if (data) {
      fetchStats();
    }
  };

  const fetchStats = async () => {
    // Users
    const { count: userCount } = await supabase
      .from("profiles")
      .select("*", { count: "exact", head: true });
    setUserCount(userCount || 0);

    // Alerts (crop/weather updates)
    const { count: alertCount } = await supabase
      .from("alerts") // make sure this table is for crop/weather updates
      .select("*", { count: "exact", head: true });
    setAlertsCount(alertCount || 0);

    // Subscriptions
    const { count: subscriptions } = await supabase
      .from("subscriptions")
      .select("*", { count: "exact", head: true });
    setSubscriptionsCount(subscriptions || 0);
  };

  if (isAdmin === null) return <div className="p-8 text-center text-muted-foreground">Checking access...</div>;
  if (!isAdmin) return (
    <div className="p-8 text-center">
      <Shield className="h-12 w-12 mx-auto text-muted-foreground/30 mb-4" />
      <h2 className="font-bold text-lg mb-2">Admin Access Required</h2>
      <p className="text-sm text-muted-foreground">You do not have admin privileges to access this dashboard.</p>
    </div>
  );

  return (
    <div className="p-4 lg:p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Shield className="h-6 w-6 text-primary" />
        <h1 className="text-xl font-bold">Admin Dashboard</h1>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardContent className="pt-4 text-center">
            <Users className="h-6 w-6 mx-auto text-primary mb-1" />
            <p className="text-2xl font-bold">{userCount}</p>
            <p className="text-xs text-muted-foreground">Total Users</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 text-center">
            <Bell className="h-6 w-6 mx-auto text-warning mb-1" />
            <p className="text-2xl font-bold">{alertsCount}</p>
            <p className="text-xs text-muted-foreground">Active Alerts</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 text-center">
            <Activity className="h-6 w-6 mx-auto text-success mb-1" />
            <p className="text-2xl font-bold">Online</p>
            <p className="text-xs text-muted-foreground">System Status</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 text-center">
            <AlertTriangle className="h-6 w-6 mx-auto text-destructive mb-1" />
            <p className="text-2xl font-bold">{subscriptionsCount}</p>
            <p className="text-xs text-muted-foreground">Subscriptions</p>
          </CardContent>
        </Card>
      </div>

      {/* Engine CTA Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
        <Button onClick={() => setSelectedEngine("Alert")}>Alert</Button>
        <Button onClick={() => setSelectedEngine("Odeneho")}>Odeneho</Button>
        <Button onClick={() => setSelectedEngine("Inventory")}>Inventory</Button>
        <Button onClick={() => setSelectedEngine("Flight Advisory")}>Flight Advisory</Button>
        <Button onClick={() => setSelectedEngine("Environment")}>Environment</Button>
        <Button onClick={() => setSelectedEngine("Settings")}>Settings</Button>
      </div>

      {/* Engine Display */}
      <div className="mt-4">
        {selectedEngine === "Alert" && <Alert />}
        {selectedEngine === "Odeneho" && <AIEngine />}
        {selectedEngine === "Inventory" && <InventoryEngine />}
        {selectedEngine === "Flight Advisory" && <FlightEngine />}
        {selectedEngine === "Environment" && <EnvironmentEngine />}
        {selectedEngine === "Settings" && <UserSettings />}
        {!selectedEngine && <p className="text-sm text-muted-foreground text-center py-4">Select a section to manage.</p>}
      </div>
    </div>
  );
}
