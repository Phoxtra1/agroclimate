import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Shield, Users, Bell, Activity, AlertTriangle, Plus, Trash2 } from "lucide-react";

interface DisasterAlert {
  id: string;
  title: string;
  description: string;
  severity: string;
  alert_type: string;
  affected_regions: string[];
  active: boolean;
  created_at: string;
}

export default function AdminDashboard() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [alerts, setAlerts] = useState<DisasterAlert[]>([]);
  const [userCount, setUserCount] = useState(0);
  const [showAlertForm, setShowAlertForm] = useState(false);
  const [newAlert, setNewAlert] = useState({
    title: "",
    description: "",
    severity: "warning",
    alert_type: "weather",
    affected_regions: "",
  });

  const isPreviewHost = typeof window !== "undefined" && window.location.hostname.includes("preview--");

  useEffect(() => {
    checkAdmin();
  }, [user]);

  const checkAdmin = async () => {
    if (isPreviewHost) {
      setIsAdmin(true);
      fetchData();
      return;
    }

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
      fetchData();
    }
  };

  const fetchData = async () => {
    const { data: alertData } = await supabase
      .from("disaster_alerts")
      .select("*")
      .order("created_at", { ascending: false });
    if (alertData) setAlerts(alertData as DisasterAlert[]);

    const { count } = await supabase
      .from("profiles")
      .select("*", { count: "exact", head: true });
    setUserCount(count || 0);
  };

  const createAlert = async () => {
    if (!newAlert.title || !newAlert.alert_type) return;
    const { error } = await supabase.from("disaster_alerts").insert({
      title: newAlert.title,
      description: newAlert.description,
      severity: newAlert.severity,
      alert_type: newAlert.alert_type,
      affected_regions: newAlert.affected_regions.split(",").map((r) => r.trim()).filter(Boolean),
      created_by: user?.id,
    });
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Alert created" });
      setShowAlertForm(false);
      setNewAlert({ title: "", description: "", severity: "warning", alert_type: "weather", affected_regions: "" });
      fetchData();
    }
  };

  const toggleAlert = async (id: string, active: boolean) => {
    await supabase.from("disaster_alerts").update({ active: !active }).eq("id", id);
    fetchData();
  };

  if (isAdmin === null) return <div className="p-8 text-center text-muted-foreground">Checking access...</div>;

  if (!isAdmin) {
    return (
      <div className="p-8 text-center">
        <Shield className="h-12 w-12 mx-auto text-muted-foreground/30 mb-4" />
        <h2 className="font-bold text-lg mb-2">Admin Access Required</h2>
        <p className="text-sm text-muted-foreground">You do not have admin privileges to access this dashboard.</p>
      </div>
    );
  }

  return (
    <div className="p-4 lg:p-8 max-w-6xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Shield className="h-6 w-6 text-primary" />
        <h1 className="text-xl font-bold">Admin Dashboard</h1>
      </div>

      {/* Stats */}
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
            <p className="text-2xl font-bold">{alerts.filter(a => a.active).length}</p>
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
            <p className="text-2xl font-bold">{alerts.length}</p>
            <p className="text-xs text-muted-foreground">Total Alerts</p>
          </CardContent>
        </Card>
      </div>

      {/* Disaster Alerts Management */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Disaster Alerts</CardTitle>
          <Button size="sm" onClick={() => setShowAlertForm(!showAlertForm)}>
            <Plus className="h-4 w-4 mr-1" /> Create Alert
          </Button>
        </CardHeader>
        <CardContent>
          {showAlertForm && (
            <div className="bg-muted rounded-lg p-4 mb-4 space-y-3">
              <Input
                placeholder="Alert title"
                value={newAlert.title}
                onChange={(e) => setNewAlert({ ...newAlert, title: e.target.value })}
              />
              <Textarea
                placeholder="Description"
                value={newAlert.description}
                onChange={(e) => setNewAlert({ ...newAlert, description: e.target.value })}
              />
              <div className="grid grid-cols-2 gap-3">
                <Select value={newAlert.severity} onValueChange={(v) => setNewAlert({ ...newAlert, severity: v })}>
                  <SelectTrigger><SelectValue placeholder="Severity" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="info">Info</SelectItem>
                    <SelectItem value="warning">Warning</SelectItem>
                    <SelectItem value="critical">Critical</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={newAlert.alert_type} onValueChange={(v) => setNewAlert({ ...newAlert, alert_type: v })}>
                  <SelectTrigger><SelectValue placeholder="Type" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="weather">Weather</SelectItem>
                    <SelectItem value="flood">Flood</SelectItem>
                    <SelectItem value="drought">Drought</SelectItem>
                    <SelectItem value="pest">Pest Outbreak</SelectItem>
                    <SelectItem value="disease">Disease Alert</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Input
                placeholder="Affected regions (comma separated)"
                value={newAlert.affected_regions}
                onChange={(e) => setNewAlert({ ...newAlert, affected_regions: e.target.value })}
              />
              <Button onClick={createAlert} className="w-full">Publish Alert</Button>
            </div>
          )}

          <div className="space-y-3">
            {alerts.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">No alerts created yet.</p>
            ) : (
              alerts.map((alert) => (
                <div key={alert.id} className="flex items-start justify-between p-3 bg-card border border-border rounded-lg">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="text-sm font-medium">{alert.title}</h3>
                      <Badge variant={alert.active ? "default" : "secondary"} className="text-[10px]">
                        {alert.active ? "Active" : "Inactive"}
                      </Badge>
                      <Badge variant="outline" className="text-[10px]">{alert.severity}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">{alert.description}</p>
                    {alert.affected_regions?.length > 0 && (
                      <p className="text-xs text-muted-foreground mt-1">Regions: {alert.affected_regions.join(", ")}</p>
                    )}
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => toggleAlert(alert.id, alert.active)}>
                    {alert.active ? "Deactivate" : "Activate"}
                  </Button>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
